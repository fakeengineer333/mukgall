"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Message, Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { useChat } from "@/providers/ChatProvider";
import { fetchOlderMessagesAction } from "@/app/actions/chat";

interface ParticipantReadInfo {
  user_id: string;
  last_read_at: string;
  username?: string;
  avatar_url?: string | null;
}

interface ChatMessageListProps {
  roomId: string;
  initialMessages: (Message & { sender?: Profile | null })[];
  initialParticipants?: ParticipantReadInfo[];
  currentUserId: string;
  currentUserProfile?: Profile | null;
}

// Format: yyyy-MM-dd 요일 (예: 2026-08-25 화요일)
function formatChatDateDivider(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[d.getDay()];
  return `${yyyy}-${mm}-${dd} ${dayName}`;
}

function isDifferentCalendarDay(date1Str: string, date2Str?: string): boolean {
  if (!date2Str) return true;
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

export function ChatMessageList({
  roomId,
  initialMessages,
  initialParticipants = [],
  currentUserId,
}: ChatMessageListProps) {
  const { markRoomAsRead } = useChat();
  const [messages, setMessages] = useState<(Message & { sender?: Profile | null })[]>(initialMessages);
  const [participants, setParticipants] = useState<ParticipantReadInfo[]>(initialParticipants);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 30);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isInitialMountRef = useRef(true);

  const lastMsgTimeRef = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].created_at
      : new Date().toISOString()
  );

  // Sync initialParticipants if updated
  useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);

  // Auto scroll to bottom on new incoming messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isInitialMountRef.current) {
      // First mount -> scroll instantly to bottom
      messagesEndRef.current?.scrollIntoView();
      isInitialMountRef.current = false;
    } else {
      // Only smooth scroll if near bottom
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        if (isNearBottom) {
          scrollToBottom();
        }
      }
    }

    if (messages.length > 0) {
      lastMsgTimeRef.current = messages[messages.length - 1].created_at;
    }
  }, [messages, scrollToBottom]);

  // ⚡ 0.000s OPTIMISTIC MESSAGE LISTENER
  useEffect(() => {
    const handleOptimistic = (e: Event) => {
      const customEvt = e as CustomEvent<Message & { sender?: Profile | null }>;
      if (customEvt.detail) {
        setMessages((prev) => [...prev, customEvt.detail]);
        // Force scroll down immediately
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    };

    const handleFailed = (e: Event) => {
      const customEvt = e as CustomEvent<{ id: string; error?: string }>;
      if (customEvt.detail?.id) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(customEvt.detail.id)));
        alert(`메시지 전송에 실패했습니다: ${customEvt.detail.error || "네트워크 오류"}`);
      }
    };

    window.addEventListener(`chat:send-optimistic-${roomId}`, handleOptimistic);
    window.addEventListener(`chat:send-failed-${roomId}`, handleFailed);

    return () => {
      window.removeEventListener(`chat:send-optimistic-${roomId}`, handleOptimistic);
      window.removeEventListener(`chat:send-failed-${roomId}`, handleFailed);
    };
  }, [roomId]);

  // Keep unread count synchronized in ChatProvider on mount & unmount
  useEffect(() => {
    markRoomAsRead(roomId);
    return () => {
      markRoomAsRead(roomId);
    };
  }, [roomId, markRoomAsRead]);

  // Calculate unread count for each message (KakaoTalk style '1' disappearing)
  const getMessageUnreadCount = useCallback(
    (msg: Message) => {
      if (!msg.created_at || participants.length === 0) return 0;
      const msgTime = new Date(msg.created_at).getTime();

      // Count participants who haven't read this message yet (excluding the sender)
      return participants.filter(
        (p) =>
          p.user_id !== msg.sender_id &&
          new Date(p.last_read_at || 0).getTime() < msgTime
      ).length;
    },
    [participants]
  );

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    setLoadingOlder(true);
    const container = scrollContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      const oldestMsg = messages[0];
      const older = await fetchOlderMessagesAction({
        roomId,
        beforeTimestamp: oldestMsg.created_at,
        limit: 30,
      });

      if (older.length < 30) {
        setHasMore(false);
      }

      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = older.filter((m) => !existingIds.has(m.id));
          return [...toAdd, ...prev];
        });

        // Maintain relative scroll position to avoid jump
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch (e) {
      console.warn("[ChatMessageList] Load older messages failed:", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, messages, roomId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop < 60 && hasMore && !loadingOlder) {
      loadOlderMessages();
    }
  };

  // Catch-up sync: fetch any messages created after latest known message
  const syncNewMessages = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: latest } = await supabase
        .from("messages")
        .select("*, sender:profiles(*)")
        .eq("room_id", roomId)
        .gt("created_at", lastMsgTimeRef.current)
        .order("created_at", { ascending: true });

      if (latest && latest.length > 0) {
        const typedLatest = latest as unknown as (Message & { sender?: Profile | null })[];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = typedLatest.filter((m) => !existingIds.has(m.id));
          if (toAdd.length === 0) return prev;
          return [...prev, ...toAdd];
        });
        markRoomAsRead(roomId);
      }
    } catch (e) {
      console.warn("[ChatMessageList] Catch-up sync error:", e);
    }
  }, [roomId, markRoomAsRead]);

  // Visibility / Focus listener for instant catch-up when switching back
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncNewMessages();
        markRoomAsRead(roomId);
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [syncNewMessages, roomId, markRoomAsRead]);

  // Supabase WebSocket Realtime Subscription (Messages + Participant Read Updates)
  useEffect(() => {
    const supabase = createClient();

    // Authenticate Realtime socket with user's session JWT on load/refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    const addMessageSafely = (msg: Message & { sender?: Profile | null }) => {
      if (!msg || !msg.id) return;
      setMessages((prev) => {
        // Reconcile optimistic message with real server message
        const optimisticIndex = prev.findIndex(
          (m) =>
            m.id === msg.id ||
            (String(m.id).startsWith("optimistic-") &&
              m.sender_id === msg.sender_id &&
              m.content === msg.content &&
              Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 10000)
        );

        if (optimisticIndex !== -1) {
          const updated = [...prev];
          updated[optimisticIndex] = msg;
          return updated;
        }

        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      markRoomAsRead(roomId);
    };

    const channel = supabase
      .channel(`chat_room_view_${roomId}_${Math.random().toString(36).slice(2)}`)
      // Durable Postgres Changes on Messages
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg || !newMsg.id) return;

          // ⚡ Fast-path: Check if sender profile is already in cached participants
          const cachedSender = participants.find((p) => p.user_id === newMsg.sender_id);
          if (cachedSender && cachedSender.username) {
            addMessageSafely({
              ...newMsg,
              sender: {
                id: cachedSender.user_id,
                username: cachedSender.username,
                avatar_url: cachedSender.avatar_url || null,
                role: "USER",
                bio: null,
                created_at: "",
                updated_at: "",
              },
            });
            return;
          }

          // Fallback: Fetch full message record with sender profile
          const { data: fullMsg } = await supabase
            .from("messages")
            .select("*, sender:profiles(*)")
            .eq("id", newMsg.id)
            .maybeSingle();

          const toAdd = (fullMsg as unknown as Message & { sender?: Profile | null }) || newMsg;
          addMessageSafely(toAdd);
        }
      )
      // Real-time Read Receipt updates (when other participants read)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string };
          if (updated?.user_id && updated?.last_read_at) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === updated.user_id
                  ? { ...p, last_read_at: updated.last_read_at }
                  : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, markRoomAsRead, participants]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 overscroll-contain"
    >
      {/* Loading Spinner / Load More Trigger at top */}
      {hasMore && (
        <div className="flex justify-center py-2">
          {loadingOlder ? (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span>이전 대화 불러오는 중...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={loadOlderMessages}
              className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              이전 대화 더보기
            </button>
          )}
        </div>
      )}

      {messages.map((msg, index) => {
        const prevMsg = index > 0 ? messages[index - 1] : undefined;
        const showDateDivider = isDifferentCalendarDay(msg.created_at, prevMsg?.created_at);
        const unreadCount = getMessageUnreadCount(msg);

        // 1. SYSTEM MESSAGE
        if (msg.message_type === "SYSTEM") {
          return (
            <div key={msg.id} className="space-y-3">
              {showDateDivider && (
                <div className="flex justify-center my-4">
                  <span className="rounded-full bg-zinc-900/90 border border-zinc-800/80 px-3.5 py-1 text-[11px] font-semibold text-zinc-400 shadow-sm">
                    {formatChatDateDivider(msg.created_at)}
                  </span>
                </div>
              )}
              <div className="flex justify-center my-3">
                <span className="rounded-full bg-zinc-900 border border-zinc-800/80 px-3 py-1 text-[11px] font-medium text-zinc-400 shadow-sm">
                  {msg.content}
                </span>
              </div>
            </div>
          );
        }

        const isMe = msg.sender_id === currentUserId;

        return (
          <div key={msg.id} className="space-y-3">
            {/* Date Divider between different calendar days */}
            {showDateDivider && (
              <div className="flex justify-center my-4">
                <span className="rounded-full bg-zinc-900/90 border border-zinc-800/80 px-3.5 py-1 text-[11px] font-semibold text-zinc-400 shadow-sm">
                  {formatChatDateDivider(msg.created_at)}
                </span>
              </div>
            )}

            {isMe ? (
              /* MY MESSAGE (Right-aligned) */
              <div className="flex items-end justify-end gap-1.5">
                {/* Unread Count '1' & Timestamp */}
                <div className="flex flex-col items-end shrink-0 mb-0.5 select-none">
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 leading-none mb-0.5">
                      {unreadCount}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 leading-none">
                    {new Date(msg.created_at).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div className="max-w-[78%] sm:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm leading-relaxed bg-blue-600 text-white rounded-br-none">
                  {/* Image attachment */}
                  {msg.image_url && (
                    <div
                      className="relative aspect-video w-48 sm:w-60 rounded-xl overflow-hidden mb-1.5 cursor-pointer bg-zinc-950"
                      onClick={() => setPreviewImage(msg.image_url)}
                    >
                      <Image
                        src={msg.image_url}
                        alt="Chat Attachment"
                        fill
                        sizes="240px"
                        className="object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  )}

                  {/* Text content */}
                  {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                </div>
              </div>
            ) : (
              /* OTHER USER MESSAGE (Left-aligned) */
              <div className="flex items-start gap-2 justify-start">
                <Avatar
                  src={msg.sender?.avatar_url}
                  fallbackText={msg.sender?.username || "유저"}
                  size="sm"
                  className="h-7 w-7 mt-0.5"
                />

                <div className="flex flex-col max-w-[78%] sm:max-w-[65%] items-start">
                  {/* Sender Name */}
                  <span className="text-[11px] text-zinc-400 font-semibold mb-1 pl-1">
                    {msg.sender?.username || "대화 상대"}
                  </span>

                  <div className="flex items-end gap-1.5">
                    {/* Message Bubble */}
                    <div className="rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm leading-relaxed bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/50">
                      {/* Image attachment */}
                      {msg.image_url && (
                        <div
                          className="relative aspect-video w-48 sm:w-60 rounded-xl overflow-hidden mb-1.5 cursor-pointer bg-zinc-950"
                          onClick={() => setPreviewImage(msg.image_url)}
                        >
                          <Image
                            src={msg.image_url}
                            alt="Chat Attachment"
                            fill
                            sizes="240px"
                            className="object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      )}

                      {/* Text content */}
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                    </div>

                    {/* Unread Count '1' & Timestamp */}
                    <div className="flex flex-col items-start shrink-0 mb-0.5 select-none">
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 leading-none mb-0.5">
                          {unreadCount}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 leading-none">
                        {new Date(msg.created_at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div ref={messagesEndRef} />

      {/* Image Modal Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full h-full flex items-center justify-center">
            <Image
              src={previewImage}
              alt="Expanded Preview"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
