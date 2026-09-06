"use client";

import React from "react";
import { Play, ExternalLink } from "lucide-react";

interface YouTubeEmbedProps {
  videoId: string;
  startTime?: number;
  originalUrl?: string;
  title?: string;
}

export function YouTubeEmbed({
  videoId,
  startTime,
  originalUrl,
  title = "YouTube 동영상 플레이어",
}: YouTubeEmbedProps) {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${
    startTime ? `&start=${startTime}` : ""
  }`;

  const watchUrl = originalUrl || `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className="my-3 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-950 shadow-lg">
      {/* 16:9 Responsive Video Container */}
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>

      {/* Video Footer Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/90 text-[11px] text-zinc-400 border-t border-zinc-800/60">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white">
            <Play className="h-2.5 w-2.5 fill-white" />
          </span>
          <span>YouTube 동영상</span>
        </div>

        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors py-0.5 px-1.5 rounded hover:bg-zinc-800"
          title="유튜브 앱/웹에서 직접 보기"
        >
          <span>YouTube에서 열기</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
