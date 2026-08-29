"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ScrollText,
  ExternalLink,
  Download,
} from "lucide-react";

export interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}

type ViewMode = "fit-screen" | "fit-width"; // fit-screen: 전체 한눈에, fit-width: 세로 스크롤(웹툰/긴 캡처 모드)

export function ImageViewerModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [viewMode, setViewMode] = useState<ViewMode>("fit-screen");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLongImage, setIsLongImage] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync initialIndex when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomLevel(1);
    }
  }, [isOpen, initialIndex]);

  const currentImageUrl = images[currentIndex] || "";

  // Reset zoom on index or mode change
  useEffect(() => {
    setZoomLevel(1);
  }, [currentIndex, viewMode]);

  // Check image aspect ratio when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const isTall = img.naturalHeight / img.naturalWidth >= 1.35;
    setIsLongImage(isTall);

    // Auto-switch to fit-width if the image is very tall on first load
    if (isTall && viewMode === "fit-screen") {
      setViewMode("fit-width");
    }
  };

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "fit-screen" ? "fit-width" : "fit-screen"));
    setZoomLevel(1);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleResetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !currentImageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 뷰어"
    >
      {/* 1. TOP HEADER TOOLBAR */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-zinc-950/80 border-b border-zinc-800/80 text-white z-20">
        <div className="flex items-center gap-3 min-w-0">
          {title && (
            <span className="text-xs sm:text-sm font-semibold truncate max-w-[180px] sm:max-w-md text-zinc-200">
              {title}
            </span>
          )}
          {images.length > 1 && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold text-zinc-300">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          {isLongImage && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-blue-900/60 border border-blue-700/60 px-2 py-0.5 text-[10px] font-bold text-blue-300">
              <ScrollText className="h-3 w-3" />
              세로 긴 이미지 (스크롤 모드)
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Fit Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleViewMode}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === "fit-width"
                ? "bg-blue-600 text-white shadow"
                : "bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
            title={viewMode === "fit-width" ? "화면 맞춤 모드로 전환" : "가로폭 맞춤 (세로 스크롤) 모드로 전환"}
          >
            {viewMode === "fit-width" ? (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">화면 맞춤</span>
              </>
            ) : (
              <>
                <ScrollText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">스크롤 보기</span>
              </>
            )}
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="확대 (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="축소 (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {/* Zoom Reset */}
          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[10px] font-bold"
              title="줌 초기화 (0)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* Open Original in New Tab */}
          <a
            href={currentImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="새 탭에서 원본 열기"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Download Original Image */}
          <a
            href={currentImageUrl}
            download={`mukgall-${Date.now()}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="이미지 저장"
          >
            <Download className="h-4 w-4" />
          </a>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white transition-colors ml-1 cursor-pointer"
            title="닫기 (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN IMAGE CONTAINER */}
      <div
        ref={containerRef}
        onClick={(e) => {
          if (e.target === containerRef.current) {
            onClose();
          }
        }}
        className={`flex-1 relative w-full overflow-auto flex items-center justify-center p-2 sm:p-4 ${
          viewMode === "fit-width" ? "overflow-y-auto block" : "overflow-hidden"
        }`}
      >
        {/* Navigation Arrows for Multi-image */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 shadow-2xl backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
              title="이전 사진 (←)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 shadow-2xl backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
              title="다음 사진 (→)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Rendered Image */}
        <div
          className={`flex items-center justify-center transition-transform duration-150 ${
            viewMode === "fit-width"
              ? "w-full max-w-3xl sm:max-w-4xl mx-auto py-4"
              : "w-full h-full"
          }`}
          style={{
            transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imgRef}
            src={currentImageUrl}
            alt={title || `Image ${currentIndex + 1}`}
            onLoad={handleImageLoad}
            className={`rounded-lg shadow-2xl transition-all ${
              viewMode === "fit-width"
                ? "w-full h-auto object-contain cursor-default"
                : "max-h-[calc(100vh-6.5rem)] max-w-[calc(100vw-2rem)] object-contain"
            }`}
          />
        </div>
      </div>

      {/* 3. BOTTOM THUMBNAILS BAR (if multiple images) */}
      {images.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 p-2.5 bg-zinc-950/80 border-t border-zinc-800/80 overflow-x-auto z-20">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative h-12 w-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                currentIndex === idx
                  ? "border-blue-500 scale-105 ring-2 ring-blue-500/30"
                  : "border-zinc-800 opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}