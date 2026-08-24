"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Message, Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { useChat } from "@/providers/ChatProvider";

interface ChatMessageListProps {
  roomId: string;
  initialMessages: (Message & { sender?: Profile | null })[];
  currentUserId: string;
}

export function ChatMessageList({
  roomId,
  initialMessages,
  currentUserId,
}: ChatMessageListProps) {
  const { markRoomAsRead } = useChat();
  const [messages, setMessages] = useState<(Message & { sender?: Profile | null })[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const lastMsgTimeRef = useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].created_at
      : new Date().toISOString()
  );

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      lastMsgTimeRef.current = messages[messages.length - 1].created_at;
    }
  }, [messages]);

  // Keep unread count synchronized in ChatProvider on mount & unmount
  useEffect(() => {
    markRoomAsRead(roomId);
    return () => {
      markRoomAsRead(roomId);
    };
  }, [roomId, markRoomAsRead]);

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

  // Periodic fast catch-up interval (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncNewMessages();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [syncNewMessages]);

  // Supabase WebSocket Realtime Subscription (Auth Token Set + Broadcast + Postgres Changes)
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
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      markRoomAsRead(roomId);
    };

    const channel = supabase
      .channel(`chat_messages_${roomId}_${Math.random().toString(36).slice(2)}`, {
        config: { broadcast: { self: true } },
      })
      // 1. Instant 0.001s bubble via Broadcast
      .on("broadcast", { event: "NEW_MESSAGE" }, (payload) => {
        const msg = payload.payload as Message & { sender?: Profile | null };
        if (msg && msg.room_id === roomId) {
          addMessageSafely(msg);
        }
      })
      // 2. Durable Postgres Changes
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

          // Fetch full message record with sender profile
          const { data: fullMsg } = await supabase
            .from("messages")
            .select("*, sender:profiles(*)")
            .eq("id", newMsg.id)
            .maybeSingle();

          const toAdd = (fullMsg as unknown as Message & { sender?: Profile | null }) || newMsg;
          addMessageSafely(toAdd);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, markRoomAsRead]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 overscroll-contain">
      {messages.map((msg) => {
        // 1. SYSTEM MESSAGE
        if (msg.message_type === "SYSTEM") {
          return (
            <div key={msg.id} className="flex justify-center my-3">
              <span className="rounded-full bg-zinc-900 border border-zinc-800/80 px-3 py-1 text-[11px] font-medium text-zinc-400 shadow-sm">
                {msg.content}
              </span>
            </div>
          );
        }

        const isMe = msg.sender_id === currentUserId;

        return (
          <div
            key={msg.id}
            className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
          >
            {/* Other User Avatar */}
            {!isMe && (
              <Avatar
                src={msg.sender?.avatar_url}
                fallbackText={msg.sender?.username || "유저"}
                size="sm"
                className="h-7 w-7 mb-0.5"
              />
            )}

            {/* Bubble & Time wrapper */}
            <div
              className={`flex flex-col max-w-[78%] sm:max-w-[65%] ${
                isMe ? "items-end" : "items-start"
              }`}
            >
              {/* Sender Name if not me */}
              {!isMe && (
                <span className="text-[11px] text-zinc-400 font-semibold mb-1 pl-1">
                  {msg.sender?.username || "대화 상대"}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm leading-relaxed ${
                  isMe
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/50"
                }`}
              >
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

              {/* Timestamp */}
              <span className="text-[10px] text-zinc-500 mt-1 px-1">
                {new Date(msg.created_at).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
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
