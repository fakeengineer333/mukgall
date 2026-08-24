"use client";

import { useState, useTransition } from "react";
import { Send, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { sendMessageAction } from "@/app/actions/chat";
import { uploadImageToStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ChatMessageInputProps {
  roomId: string;
}

export function ChatMessageInput({ roomId }: ChatMessageInputProps) {
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
    if ((!content.trim() && !selectedImage) || isPending || uploading) return;

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

    setContent("");
    setSelectedImage(null);
    setImagePreview(null);

    startTransition(async () => {
      await sendMessageAction({
        roomId,
        content: textToSend || (imageToSend ? "" : undefined),
        imageUrl: imageToSend,
        messageType: msgType,
      });
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
        {/* Image Attachment Button */}
        <label
          htmlFor="chat-image-input"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </label>
        <input
          id="chat-image-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          disabled={isPending || uploading}
        />

        {/* Text Input */}
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={isPending || uploading}
          className="flex-1 h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />

        {/* Send Button */}
        <Button
          type="submit"
          disabled={(!content.trim() && !selectedImage) || isPending || uploading}
          className="h-11 px-4 rounded-xl font-bold gap-1.5 shadow-md shadow-blue-600/30"
        >
          {isPending || uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">전송</span>
        </Button>
      </form>
    </div>
  );
}
