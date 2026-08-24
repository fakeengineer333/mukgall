"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadCloud, X, Loader2, ImagePlus } from "lucide-react";
import { uploadImageToStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ imageUrls, onChange, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // 10MB limit per file
      if (file.size > 10 * 1024 * 1024) {
        setError(`파일 '${file.name}'의 크기가 10MB를 초과합니다.`);
        continue;
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { url, error: uploadErr } = await uploadImageToStorage("gallery-images", fileName, file);

      if (uploadErr) {
        setError(`이미지 업로드 실패: ${uploadErr}`);
      } else if (url) {
        uploadedUrls.push(url);
      }
    }

    onChange([...imageUrls, ...uploadedUrls]);
    setUploading(false);
    // Reset file input
    e.target.value = "";
  };

  const removeImage = (indexToRemove: number) => {
    onChange(imageUrls.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <ImagePlus className="h-4 w-4 text-blue-400" />
          갤러리 이미지 ({imageUrls.length}장 등록됨)
        </label>
        <span className="text-[11px] text-zinc-500">단일 파일 최대 10MB</span>
      </div>

      {/* Preview Grid */}
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {imageUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 group"
            >
              <Image
                src={url}
                alt={`Uploaded image ${idx + 1}`}
                fill
                sizes="150px"
                className="object-cover transition-transform group-hover:scale-105"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow"
                disabled={disabled || uploading}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  대표
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Dropzone / Button */}
      <div className="relative">
        <label
          htmlFor="gallery-image-input"
          className="flex flex-col items-center justify-center w-full h-28 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-blue-500/50 bg-zinc-950/40 hover:bg-zinc-900/50 cursor-pointer transition-colors"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1.5 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-xs font-semibold">이미지 업로드 중...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-zinc-400">
              <UploadCloud className="h-6 w-6 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-300">
                사진 추가하기 (다중 선택 가능)
              </span>
              <span className="text-[10px] text-zinc-500">
                JPG, PNG, WebP, GIF 지원
              </span>
            </div>
          )}
        </label>
        <input
          id="gallery-image-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={disabled || uploading}
        />
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
