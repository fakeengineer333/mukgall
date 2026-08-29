"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Loader2, ChevronDown, CornerDownRight } from "lucide-react";
import { Message, Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { FormattedText } from "@/components/common/FormattedText";
import { ImageViewerModal } from "@/components/common/ImageViewerModal";
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

// Format: yyyy년 MM월 dd일 *요일 (예: 2026년 08월 26일 수요일)
function formatChatDateDivider(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const dayName = days[d.getDay()];
  return `${yyyy}년 ${mm}월 ${dd}일 ${dayName}`;
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
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; expiresAt: number }>>({});
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

  // Periodic cleanup for typing indicator (expires after 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const updated = { ...prev };
        let changed = false;
        for (const [uid, val] of Object.entries(updated)) {
          if (val.expiresAt <= now) {
            delete updated[uid];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

      return participants.filter(
        (p) =>
          p.user_id !== msg.sender_id &&
          (!p.last_read_at || new Date(p.last_read_at).getTime() < msgTime)
      ).length;
    },
    [participants]
  );

  // Load older messages (infinite scroll up)
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    setLoadingOlder(true);
    const oldest = messages[0];
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;

    try {
      const older = await fetchOlderMessagesAction({
        roomId,
        beforeTimestamp: oldest.created_at,
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

    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom > 180) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
      setUnreadNewCount(0);
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

  // Supabase WebSocket Realtime Subscription (Messages + Read Updates + Typing Broadcast)
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    const addMessageSafely = (msg: Message & { sender?: Profile | null }) => {
      if (!msg || !msg.id) return;
      setMessages((prev) => {
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

        const container = scrollContainerRef.current;
        if (container && msg.sender_id !== currentUserId) {
          const isFar = container.scrollHeight - container.scrollTop - container.clientHeight > 180;
          if (isFar) {
            setShowScrollBottom(true);
            setUnreadNewCount((count) => count + 1);
          }
        }

        return [...prev, msg];
      });
      markRoomAsRead(roomId);
    };

    const channel = supabase
      .channel(`chat_room_view_${roomId}`)
      // 1. Durable Postgres Changes on Messages
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

          const { data: fullMsg } = await supabase
            .from("messages")
            .select("*, sender:profiles(*)")
            .eq("id", newMsg.id)
            .maybeSingle();

          const toAdd = (fullMsg as unknown as Message & { sender?: Profile | null }) || newMsg;
          addMessageSafely(toAdd);
        }
      )
      // 2. Real-time Read Receipt updates
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
      // 3. Realtime Typing Indicator Broadcast
      .on("broadcast", { event: "typing" }, (payload: any) => {
        const payloadData = payload?.payload;
        if (payloadData?.userId && payloadData.userId !== currentUserId) {
          setTypingUsers((prev) => ({
            ...prev,
            [payloadData.userId]: {
              username: payloadData.username || "상대방",
              expiresAt: Date.now() + 3000,
            },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, markRoomAsRead, participants, currentUserId]);

  // Quote Reply Trigger
  const handleQuoteReply = (targetMsg: Message & { sender?: Profile | null }) => {
    const isMe = targetMsg.sender_id === currentUserId;
    const senderName = isMe ? "나" : (targetMsg.sender?.username || "상대방");
    let preview = targetMsg.content || (targetMsg.image_url ? "사진" : "");
    // Clean existing quote prefix
    preview = preview.replace(/^>\s*\[답장:[^\]]+\][^\n]*\n?/, "").slice(0, 50);

    window.dispatchEvent(
      new CustomEvent(`chat:quote-reply-${roomId}`, {
        detail: {
          messageId: targetMsg.id,
          senderName,
          textPreview: preview,
        },
      })
    );
  };

  const activeTypingNames = Object.values(typingUsers).map((u) => u.username);

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
              className="rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/80 px-3.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shadow-sm">
                    {formatChatDateDivider(msg.created_at)}
                  </span>
                </div>
              )}
              <div className="flex justify-center my-3">
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 shadow-sm">
                  {msg.content}
                </span>
              </div>
            </div>
          );
        }

        const isMe = msg.sender_id === currentUserId;

        return (
          <div key={msg.id} className="space-y-3 group/msg">
            {/* Date Divider between different calendar days */}
            {showDateDivider && (
              <div className="flex justify-center my-4">
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/80 px-3.5 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shadow-sm">
                  {formatChatDateDivider(msg.created_at)}
                </span>
              </div>
            )}

            {isMe ? (
              /* MY MESSAGE (Right-aligned) */
              <div className="flex items-end justify-end gap-1.5 group/me">
                {/* Reply action button on hover */}
                <button
                  type="button"
                  onClick={() => handleQuoteReply(msg)}
                  className="opacity-0 group-hover/me:opacity-100 transition-opacity p-1 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 mb-0.5 cursor-pointer"
                  title="답장"
                  aria-label="이 메시지에 답장"
                >
                  <CornerDownRight className="h-3 w-3" />
                </button>

                {/* Unread Count '1' & Timestamp */}
                <div className="flex flex-col items-end shrink-0 mb-0.5 select-none">
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 leading-none mb-0.5">
                      {unreadCount}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none">
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

                  {/* Text content with Quote rendering */}
                  {msg.content && (
                    <FormattedText
                      content={msg.content}
                      bubbleStyle="me"
                      compactPreview={true}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* OTHER USER MESSAGE (Left-aligned) */
              <div className="flex items-start gap-2 justify-start group/other">
                <Avatar
                  src={msg.sender?.avatar_url}
                  fallbackText={msg.sender?.username || "유저"}
                  size="sm"
                  className="h-7 w-7 mt-0.5"
                />

                <div className="flex flex-col max-w-[78%] sm:max-w-[65%] items-start">
                  {/* Sender Name */}
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold mb-1 pl-1">
                    {msg.sender?.username || "대화 상대"}
                  </span>

                  <div className="flex items-end gap-1.5">
                    {/* Message Bubble */}
                    <div className="rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm leading-relaxed bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200 dark:border-zinc-700/50">
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

                      {/* Text content with Quote rendering */}
                      {msg.content && (
                        <FormattedText
                          content={msg.content}
                          bubbleStyle="other"
                          compactPreview={true}
                        />
                      )}
                    </div>

                    {/* Unread Count '1' & Timestamp */}
                    <div className="flex flex-col items-start shrink-0 mb-0.5 select-none">
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 leading-none mb-0.5">
                          {unreadCount}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none">
                        {new Date(msg.created_at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Reply action button on hover */}
                    <button
                      type="button"
                      onClick={() => handleQuoteReply(msg)}
                      className="opacity-0 group-hover/other:opacity-100 transition-opacity p-1 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 mb-0.5 cursor-pointer"
                      title="답장"
                      aria-label="이 메시지에 답장"
                    >
                      <CornerDownRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Realtime Typing Indicator */}
      {activeTypingNames.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 w-fit animate-in fade-in slide-in-from-bottom-2 duration-150 select-none shadow-sm">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {activeTypingNames.join(", ")}님이 입력 중
          </span>
          <span className="flex gap-1 items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce"></span>
          </span>
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* Floating Scroll to Bottom & New Message Alert Pill */}
      {showScrollBottom && (
        <div className="sticky bottom-3 z-30 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => {
              scrollToBottom();
              setShowScrollBottom(false);
              setUnreadNewCount(0);
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xl shadow-blue-600/40 backdrop-blur-md transition-all active:scale-95 border border-blue-400/40 select-none animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-pointer"
          >
            <ChevronDown className="h-4 w-4" />
            <span>
              {unreadNewCount > 0 ? `새 메시지 ${unreadNewCount}개 도착 ↓` : "맨 아래로 이동"}
            </span>
          </button>
        </div>
      )}

      {/* High Quality Lightbox / Vertical Scroll Image Viewer */}
      {previewImage && (
        <ImageViewerModal
          isOpen={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          images={
            messages.filter((m) => Boolean(m.image_url)).map((m) => m.image_url as string).length > 0
              ? messages.filter((m) => Boolean(m.image_url)).map((m) => m.image_url as string)
              : [previewImage]
          }
          initialIndex={Math.max(
            0,
            messages
              .filter((m) => Boolean(m.image_url))
              .map((m) => m.image_url as string)
              .indexOf(previewImage)
          )}
          title="채팅 사진"
        />
      )}
    </div>
  );
}
