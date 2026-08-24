"use client";

import { useState, useTransition } from "react";
import { Send, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { sendMessageAction } from "@/app/actions/chat";
import { uploadImageToStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Profile } from "@/types";

interface ChatMessageInputProps {
  roomId: string;
  currentUserId?: string;
  currentUserProfile?: Profile | null;
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
  const [isPending, startTransition] = useTransition();

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
      const fileName = `${roomId}/${Date.now()}-${selectedImage.name}`;
      const { url, error } = await uploadImageToStorage("chat-images", fileName, selectedImage);
      setUploading(false);

      if (error) {
        alert(`이미지 전송 실패: ${error}`);
        return;
      }
      imageUrl = url || undefined;
    }

    const textToSend = content.trim();
    const imageToSend = imageUrl;
    const msgType = imageToSend ? "IMAGE" : "TEXT";
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // ⚡ 0.000s INSTANT OPTIMISTIC UI DISPATCH (KakaoTalk / Discord Speed)
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

    // Clear input field instantly (0ms delay for continuous typing)
    setContent("");
    setSelectedImage(null);
    setImagePreview(null);

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
    <div className="shrink-0 z-20 border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur-md">
      {/* Image Preview Banner if selected */}
      {imagePreview && (
        <div className="relative mb-2.5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-1.5 pr-3 shadow-lg">
          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-black">
            <Image src={imagePreview} alt="Attached Preview" fill className="object-cover" />
          </div>
          <span className="text-xs text-zinc-300">이미지 첨부됨</span>
          <button
            type="button"
            onClick={() => {
              setSelectedImage(null);
              setImagePreview(null);
            }}
            className="rounded-full bg-zinc-800 p-1 text-zinc-400 hover:text-white"
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
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </label>

        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="h-10 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />

        <Button
          type="submit"
          size="sm"
          disabled={(!content.trim() && !selectedImage) || uploading}
          className="h-10 px-3.5 font-bold shadow-md shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
