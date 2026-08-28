"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { Send, ImagePlus, Loader2, X, CornerDownRight } from "lucide-react";
import Image from "next/image";
import { sendMessageAction } from "@/app/actions/chat";
import { uploadImageToStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Profile } from "@/types";

interface ChatMessageInputProps {
  roomId: string;
  currentUserId?: string;
  currentUserProfile?: Profile | null;
}

interface QuoteTarget {
  messageId: string | number;
  senderName: string;
  textPreview: string;
}

export function ChatMessageInput({
  roomId,
  currentUserId,
  currentUserProfile,
}: ChatMessageInputProps) {
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quoteReply, setQuoteReply] = useState<QuoteTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Quote Reply custom events dispatched from ChatMessageList
  useEffect(() => {
    const handleQuoteEvent = (e: Event) => {
      const customEvt = e as CustomEvent<QuoteTarget>;
      if (customEvt.detail) {
        setQuoteReply(customEvt.detail);
        inputRef.current?.focus();
      }
    };

    window.addEventListener(`chat:quote-reply-${roomId}`, handleQuoteEvent);
    return () => {
      window.removeEventListener(`chat:quote-reply-${roomId}`, handleQuoteEvent);
    };
  }, [roomId]);

  // Broadcast Realtime Typing Indicator
  const broadcastTyping = useCallback(() => {
    if (!currentUserId) return;
    try {
      const supabase = createClient();
      const channel = supabase.channel(`chat_room_view_${roomId}`);
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId: currentUserId,
          username: currentUserProfile?.username || "상대방",
        },
      });
    } catch (e) {
      // Non-critical
    }
  }, [roomId, currentUserId, currentUserProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);

    if (val.trim().length > 0 && currentUserId) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        broadcastTyping();
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
      }, 2500);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !selectedImage) || uploading) return;

    let imageUrl: string | undefined = undefined;

    if (selectedImage) {
      setUploading(true);
      const fileName = `${roomId}/${Date.now()}-${selectedImage.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { url, error } = await uploadImageToStorage("chat-images", fileName, selectedImage);
      setUploading(false);

      if (error) {
        alert(`이미지 전송 실패: ${error}`);
        return;
      }
      imageUrl = url || undefined;
    }

    const rawText = content.trim();
    // Prepend quote block if replying
    let textToSend = rawText;
    if (quoteReply && rawText) {
      textToSend = `> [답장: ${quoteReply.senderName}] ${quoteReply.textPreview}\n${rawText}`;
    }

    const imageToSend = imageUrl;
    const msgType = imageToSend ? "IMAGE" : "TEXT";
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // ⚡ 0.000s INSTANT OPTIMISTIC UI DISPATCH
    if (typeof window !== "undefined" && (textToSend || imageToSend)) {
      const optimisticMsg = {
        id: tempId,
        room_id: roomId,
        sender_id: currentUserId || "",
        content: textToSend || null,
        image_url: imageToSend || imagePreview || null,
        message_type: msgType,
        created_at: new Date().toISOString(),
        sender: currentUserProfile || {
          id: currentUserId || "",
          username: "나",
          avatar_url: null,
          role: "USER" as const,
          bio: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      window.dispatchEvent(
        new CustomEvent(`chat:send-optimistic-${roomId}`, {
          detail: optimisticMsg,
        })
      );
    }

    // Reset input state immediately
    setContent("");
    setSelectedImage(null);
    setImagePreview(null);
    setQuoteReply(null);
    isTypingRef.current = false;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // Background server action
    startTransition(async () => {
      const res = (await sendMessageAction({
        roomId,
        content: textToSend || (imageToSend ? "" : undefined),
        imageUrl: imageToSend,
        messageType: msgType,
      })) as any;

      if (!res?.success) {
        window.dispatchEvent(
          new CustomEvent(`chat:send-failed-${roomId}`, {
            detail: { id: tempId, error: res?.error },
          })
        );
      }
    });
  };

  return (
    <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 p-3 sm:p-4 backdrop-blur-md">
      {/* Quote Reply Banner if active */}
      {quoteReply && (
        <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-600 dark:text-blue-400 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="flex items-center gap-1.5 truncate">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
            <span className="font-bold shrink-0">{quoteReply.senderName}님에게 답장:</span>
            <span className="truncate text-zinc-600 dark:text-zinc-400">"{quoteReply.textPreview}"</span>
          </div>
          <button
            type="button"
            onClick={() => setQuoteReply(null)}
            className="rounded-full p-0.5 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
            aria-label="답장 취소"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image Preview Banner if selected */}
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 p-2 border border-zinc-200 dark:border-zinc-800">
          <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 shrink-0">
            <Image src={imagePreview} alt="Selected preview" fill className="object-cover" />
          </div>
          <span className="text-xs text-zinc-700 dark:text-zinc-300">이미지 첨부됨</span>
          <button
            type="button"
            onClick={() => {
              setSelectedImage(null);
              setImagePreview(null);
            }}
            className="rounded-full bg-zinc-200 dark:bg-zinc-800 p-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            aria-label="첨부 이미지 삭제"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2">
        {/* Hidden File Input for Images */}
        <input
          type="file"
          id="chat-image-input"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          disabled={uploading}
        />

        <label
          htmlFor="chat-image-input"
          aria-label="사진 첨부"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </label>

        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={handleInputChange}
          placeholder={quoteReply ? `${quoteReply.senderName}님에게 답장 입력...` : "메시지를 입력하세요..."}
          aria-label="채팅 메시지 입력창"
          className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />

        <Button
          type="submit"
          size="sm"
          disabled={(!content.trim() && !selectedImage) || uploading}
          aria-label="메시지 전송"
          className="h-10 px-3.5 font-bold shadow-md shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
