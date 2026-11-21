"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendChatNotification, isNotificationSupported } from "@/lib/notifications";
import { updateLastReadAction } from "@/app/actions/chat";
import { Message } from "@/types";

interface ChatContextType {
  unreadCount: number;
  unreadRoomsMap: Record<string, number>;
  activeRoomId: string | null;
  latestMessage: Message | null;
  setActiveRoomId: (roomId: string | null) => void;
  markRoomAsRead: (roomId: string) => void;
  refreshUnread: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  currentUserId: initialUserId,
}: {
  children: React.ReactNode;
  currentUserId?: string | null;
}) {
  const pathname = usePathname();
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const currentUserId = initialUserId ?? clientUserId;

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadRoomsMap, setUnreadRoomsMap] = useState<Record<string, number>>({});

  const pathnameRoomId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]?.split("/")[0] || null
    : null;
  const [activeRoomOverride, setActiveRoomOverride] = useState<{
    pathname: string;
    roomId: string | null;
  } | null>(null);

  const activeRoomId =
    activeRoomOverride && activeRoomOverride.pathname === pathname
      ? activeRoomOverride.roomId
      : pathnameRoomId;

  const setActiveRoomId = useCallback(
    (roomId: string | null) => {
      setActiveRoomOverride({ pathname, roomId });
    },
    [pathname]
  );

  const [latestMessage, setLatestMessage] = useState<Message | null>(null);

  const activeRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Fallback: resolve user ID if not provided from server
  useEffect(() => {
    if (!currentUserId) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.id) {
          setClientUserId(data.user.id);
        }
      });
    }
  }, [currentUserId]);

  // Query database for all unread counts per room (in parallel)
  const refreshUnread = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const supabase = createClient();

      const { data: participations } = await supabase
        .from("chat_participants")
        .select("room_id, last_read_at")
        .eq("user_id", currentUserId)
        .is("left_at", null);

      const typedParticipations = (participations || []) as {
        room_id: string;
        last_read_at: string | null;
      }[];

      if (typedParticipations.length === 0) {
        setUnreadCount(0);
        setUnreadRoomsMap({});
        return;
      }

      // Parallelize unread count queries across all rooms
      const results = await Promise.all(
        typedParticipations.map(async (part) => {
          const rId = part.room_id;
          const lastRead = part.last_read_at || "1970-01-01T00:00:00Z";

          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("room_id", rId)
            .neq("sender_id", currentUserId)
            .gt("created_at", lastRead);

          return { roomId: rId, count: count || 0 };
        })
      );

      let total = 0;
      const newMap: Record<string, number> = {};
      for (const res of results) {
        newMap[res.roomId] = res.count;
        total += res.count;
      }

      setUnreadRoomsMap(newMap);
      setUnreadCount(total);
    } catch (err) {
      console.warn("[ChatProvider] Refresh unread error:", err);
    }
  }, [currentUserId]);

  // Instant mark as read in memory and sync with server
  const markRoomAsRead = useCallback((roomId: string) => {
    setUnreadRoomsMap((prev) => {
      const roomUnread = prev[roomId] || 0;
      if (roomUnread === 0) return prev;

      setUnreadCount((c) => Math.max(0, c - roomUnread));
      return {
        ...prev,
        [roomId]: 0,
      };
    });

    // Update in database in background
    updateLastReadAction(roomId);
  }, []);

  // Initial unread fetch scheduled asynchronously
  useEffect(() => {
    if (!currentUserId) return;
    const timer = setTimeout(() => {
      void refreshUnread();
    }, 0);
    return () => clearTimeout(timer);
  }, [currentUserId, refreshUnread]);

  // Re-fetch on focus / popstate / visibilitychange
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    };

    window.addEventListener("focus", handleSync);
    window.addEventListener("popstate", handleSync);
    window.addEventListener("visibilitychange", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("popstate", handleSync);
      window.removeEventListener("visibilitychange", handleSync);
    };
  }, [refreshUnread]);

  // SINGLE GLOBAL REALTIME WEBSOCKET SUBSCRIPTION (Single Source of Truth)
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const channelName = `global_chat_provider_${currentUserId}`;

    async function setupRealtime() {
      // Authenticate Realtime socket before subscribing
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isCancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (isCancelled) return;

      const handleIncomingMessage = async (newMsg: Message) => {
        if (!newMsg || !newMsg.room_id || newMsg.sender_id === currentUserId) return;

        // Broadcast to consumers via latestMessage state
        setLatestMessage(newMsg);

        const currentActive = activeRoomIdRef.current;
        const isCurrentlyLooking = currentActive === newMsg.room_id;

        if (isCurrentlyLooking) {
          // User is actively in this room -> immediately mark as read
          markRoomAsRead(newMsg.room_id);
        } else {
          // User is NOT in this room -> increment unread count & map
          setUnreadRoomsMap((prev) => ({
            ...prev,
            [newMsg.room_id]: (prev[newMsg.room_id] || 0) + 1,
          }));
          setUnreadCount((prev) => prev + 1);

          // Fetch sender username & avatar for push notification
          let senderName = "새 메시지";
          let senderAvatar: string | undefined = undefined;
          if (newMsg.sender_id) {
            const { data: rawSenderProf } = await supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", newMsg.sender_id)
              .maybeSingle();
            const senderProf = rawSenderProf as {
              username?: string | null;
              avatar_url?: string | null;
            } | null;
            if (senderProf?.username) {
              senderName = senderProf.username;
              senderAvatar = senderProf.avatar_url || undefined;
            }
          }

          // Trigger OS System Notification with Chat Room / Sender Avatar Icon
          sendChatNotification({
            title: `💬 ${senderName}`,
            body: newMsg.content || "사진을 보냈습니다.",
            roomId: newMsg.room_id,
            icon: senderAvatar || "/icons/icon-chat.png",
          });
        }
      };

      // Create new channel and attach all listeners BEFORE subscribing
      channel = supabase.channel(channelName);

      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (newMsg) {
              void handleIncomingMessage(newMsg);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_participants",
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            void refreshUnread();
          }
        )
        .subscribe();
    }

    void setupRealtime();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, markRoomAsRead, refreshUnread]);

  // Request browser notification permission politely on first interaction
  useEffect(() => {
    if (
      currentUserId &&
      isNotificationSupported() &&
      Notification.permission === "default"
    ) {
      const handleFirstClick = () => {
        Notification.requestPermission();
        window.removeEventListener("click", handleFirstClick);
      };
      window.addEventListener("click", handleFirstClick, { once: true });
      return () => {
        window.removeEventListener("click", handleFirstClick);
      };
    }
  }, [currentUserId]);

  return (
    <ChatContext.Provider
      value={{
        unreadCount,
        unreadRoomsMap,
        activeRoomId,
        latestMessage,
        setActiveRoomId,
        markRoomAsRead,
        refreshUnread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
