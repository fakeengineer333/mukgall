"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { UploadCloud, X, Loader2, ImagePlus } from "lucide-react";
import { uploadImageToStorage } from "@/lib/storage";

interface ImageUploaderProps {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ imageUrls, onChange, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processAndUploadFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      setError(null);
      setUploading(true);

      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        // 10MB limit per file
        if (file.size > 10 * 1024 * 1024) {
          setError(`파일 '${file.name}'의 크기가 10MB를 초과합니다.`);
          continue;
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { url, error: uploadErr } = await uploadImageToStorage("gallery-images", fileName, file);

        if (uploadErr) {
          setError(`이미지 업로드 실패: ${uploadErr}`);
        } else if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...imageUrls, ...uploadedUrls]);
      }
      setUploading(false);
    },
    [imageUrls, onChange]
  );

  // File Input Handler
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await processAndUploadFiles(files);
    e.target.value = "";
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || uploading) return;

    const files = Array.from(e.dataTransfer.files || []);
    await processAndUploadFiles(files);
  };

  // Global & Container Clipboard Paste Handler (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            // Give generated screenshot a readable filename
            const namedFile = new File(
              [file],
              `clipboard-${Date.now()}.${file.type.split("/")[1] || "png"}`,
              { type: file.type }
            );
            pastedFiles.push(namedFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        await processAndUploadFiles(pastedFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [processAndUploadFiles]);

  const removeImage = (indexToRemove: number) => {
    onChange(imageUrls.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <ImagePlus className="h-4 w-4 text-blue-500" />
          갤러리 이미지 ({imageUrls.length}장 등록됨)
        </label>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          단일 파일 최대 10MB • 클립보드 붙여넣기(Ctrl+V) 지원
        </span>
      </div>

      {/* Preview Grid */}
      {imageUrls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {imageUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 group shadow-sm"
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
                aria-label={`이미지 ${idx + 1} 삭제`}
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

      {/* Upload Dropzone & Drag Over */}
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label
          htmlFor="gallery-image-input"
          className={`flex flex-col items-center justify-center w-full h-28 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
              : "border-zinc-300 dark:border-zinc-800 hover:border-blue-500/60 bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-xs font-semibold">이미지 업로드 중...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-zinc-500 dark:text-zinc-400 text-center px-4">
              <UploadCloud className={`h-6 w-6 ${isDragging ? "text-blue-500 animate-bounce" : "text-zinc-400 dark:text-zinc-500"}`} />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isDragging ? "여기에 사진을 놓으세요!" : "사진 추가하기 (클릭 또는 파일 드래그)"}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                JPG, PNG, WebP, GIF 지원 • 캡처 후 붙여넣기(Ctrl+V) 가능
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
          onChange={handleFileInput}
          disabled={disabled || uploading}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>
      )}
    </div>
  );
}
