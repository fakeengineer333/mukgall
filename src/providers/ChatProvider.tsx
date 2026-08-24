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
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId || null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadRoomsMap, setUnreadRoomsMap] = useState<Record<string, number>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);

  const activeRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Sync initialUserId
  useEffect(() => {
    if (initialUserId && initialUserId !== currentUserId) {
      setCurrentUserId(initialUserId);
    }
  }, [initialUserId, currentUserId]);

  // Fallback: resolve user ID if not provided
  useEffect(() => {
    if (!currentUserId) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.id) {
          setCurrentUserId(data.user.id);
        }
      });
    }
  }, [currentUserId]);

  // Auto detect activeRoomId from pathname
  useEffect(() => {
    if (pathname.startsWith("/chat/")) {
      const parts = pathname.split("/chat/");
      if (parts[1]) {
        const roomId = parts[1].split("/")[0];
        setActiveRoomId(roomId);
      }
    } else {
      setActiveRoomId(null);
    }
  }, [pathname]);

  // Query database for all unread counts per room
  const refreshUnread = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const supabase = createClient();

      const { data: participations } = await supabase
        .from("chat_participants")
        .select("room_id, last_read_at")
        .eq("user_id", currentUserId)
        .is("left_at", null);

      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        setUnreadRoomsMap({});
        return;
      }

      let total = 0;
      const newMap: Record<string, number> = {};

      for (const part of participations) {
        const rId = (part as any).room_id;
        const lastRead = (part as any).last_read_at || "1970-01-01T00:00:00Z";

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", rId)
          .neq("sender_id", currentUserId)
          .gt("created_at", lastRead);

        const roomCount = count || 0;
        newMap[rId] = roomCount;
        total += roomCount;
      }

      setUnreadRoomsMap(newMap);
      setUnreadCount(total);
    } catch (err) {
      console.warn("[ChatProvider] Refresh unread error:", err);
    }
  }, [currentUserId]);

  // Instant mark as read in memory and sync with server
  const markRoomAsRead = useCallback(
    (roomId: string) => {
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
    },
    []
  );

  // Initial unread fetch
  useEffect(() => {
    if (currentUserId) {
      refreshUnread();
    }
  }, [currentUserId, refreshUnread]);

  // Re-fetch on focus / popstate / visibilitychange
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === "visible") {
        refreshUnread();
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
    let channel: any = null;

    async function setupRealtime() {
      // Authenticate Realtime socket before subscribing
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

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
            [newMsg.room_id!]: (prev[newMsg.room_id!] || 0) + 1,
          }));
          setUnreadCount((prev) => prev + 1);

          // Fetch sender username for push notification
          let senderName = "새 메시지";
          if (newMsg.sender_id) {
            const { data: senderProf } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", newMsg.sender_id)
              .maybeSingle();
            if (senderProf && (senderProf as any).username) {
              senderName = (senderProf as any).username;
            }
          }

          // Trigger OS System Notification
          sendChatNotification({
            title: `💬 ${senderName}`,
            body: newMsg.content || "사진을 보냈습니다.",
            roomId: newMsg.room_id,
          });
        }
      };

      channel = supabase
        .channel(`global_chat_provider_${currentUserId}_${Date.now()}`)
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
              handleIncomingMessage(newMsg);
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
            refreshUnread();
          }
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, markRoomAsRead, refreshUnread]);

  // Request browser notification permission politely on first interaction
  useEffect(() => {
    if (currentUserId && isNotificationSupported() && Notification.permission === "default") {
      const handleFirstClick = () => {
        Notification.requestPermission().then((p) => {
          if (p === "granted") {
            localStorage.setItem("mukgall_notifications_enabled", "true");
          }
        });
        window.removeEventListener("click", handleFirstClick);
      };
      window.addEventListener("click", handleFirstClick, { once: true });
      return () => {
        window.removeEventListener("click", handleFirstClick);
      };
    }
  }, [currentUserId]);

  const contextValue = React.useMemo(
    () => ({
      unreadCount,
      unreadRoomsMap,
      activeRoomId,
      latestMessage,
      setActiveRoomId,
      markRoomAsRead,
      refreshUnread,
    }),
    [
      unreadCount,
      unreadRoomsMap,
      activeRoomId,
      latestMessage,
      markRoomAsRead,
      refreshUnread,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>
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
