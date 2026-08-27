"use client";

import useSWR from "swr";
import { ExternalLink, Globe } from "lucide-react";
import { getLinkPreviewAction, LinkPreviewData } from "@/app/actions/linkPreview";

interface LinkPreviewCardProps {
  url: string;
  className?: string;
  compact?: boolean;
  variant?: "default" | "me" | "other";
}

const fetcher = async (targetUrl: string): Promise<LinkPreviewData | null> => {
  try {
    const res = await fetch(`/api/og-preview?url=${encodeURIComponent(targetUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch {}
  return getLinkPreviewAction(targetUrl);
};

export function LinkPreviewCard({
  url,
  className = "",
  compact = false,
  variant = "default",
}: LinkPreviewCardProps) {
  const { data: preview, isLoading } = useSWR<LinkPreviewData | null>(
    url ? `og-preview:${url}` : null,
    () => fetcher(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000,
      shouldRetryOnError: false,
    }
  );

  const isMe = variant === "me";

  if (isLoading) {
    return (
      <div
        className={`my-1.5 rounded-xl border p-2.5 animate-pulse flex gap-2.5 w-full ${
          compact ? "max-w-xs sm:max-w-sm" : "max-w-lg"
        } ${
          isMe
            ? "border-blue-400/30 bg-blue-700/60"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60"
        } ${className}`}
      >
        <div
          className={`h-14 w-14 rounded-lg shrink-0 ${
            isMe ? "bg-blue-600/60" : "bg-zinc-200 dark:bg-zinc-800"
          }`}
        />
        <div className="flex-1 space-y-1.5 py-0.5">
          <div
            className={`h-3 w-3/4 rounded ${
              isMe ? "bg-blue-500/60" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
          <div
            className={`h-2.5 w-full rounded ${
              isMe ? "bg-blue-500/40" : "bg-zinc-200 dark:bg-zinc-800/60"
            }`}
          />
          <div
            className={`h-2 w-1/3 rounded ${
              isMe ? "bg-blue-500/30" : "bg-zinc-200 dark:bg-zinc-800/40"
            }`}
          />
        </div>
      </div>
    );
  }

  if (!preview || (!preview.title && !preview.description && !preview.image)) {
    return null;
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group my-1.5 block rounded-xl border shadow-sm transition-all overflow-hidden w-full ${
        compact ? "max-w-xs sm:max-w-sm" : "max-w-lg"
      } ${
        isMe
          ? "bg-blue-700/90 hover:bg-blue-700 border-blue-400/40 text-white"
          : "bg-white dark:bg-zinc-900/95 hover:border-blue-500/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100"
      } ${className}`}
    >
      {/* Thumbnail Banner */}
      {preview.image && (
        <div
          className={`relative w-full overflow-hidden bg-black/20 ${
            compact ? "h-28 sm:h-32" : "h-36 sm:h-44"
          }`}
        >
          <img
            src={preview.image}
            alt={preview.title || "Preview"}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Content Box */}
      <div className="p-2.5 sm:p-3 space-y-1">
        {/* Site Name & Favicon */}
        <div
          className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] ${
            isMe ? "text-blue-200" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {preview.favicon ? (
            <img
              src={preview.favicon}
              alt=""
              className="h-3.5 w-3.5 rounded shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate font-medium">{preview.siteName || preview.hostname}</span>
        </div>

        {/* Title */}
        {preview.title && (
          <p
            className={`text-xs sm:text-sm font-bold line-clamp-2 leading-snug transition-colors ${
              isMe
                ? "text-white group-hover:text-blue-200"
                : "text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
            }`}
          >
            {preview.title}
          </p>
        )}

        {/* Description */}
        {preview.description && (
          <p
            className={`text-[10px] sm:text-xs line-clamp-2 leading-relaxed ${
              isMe ? "text-blue-100/80" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {preview.description}
          </p>
        )}

        {/* Footer / Hostname */}
        <div
          className={`flex items-center justify-between pt-1.5 mt-0.5 border-t text-[10px] ${
            isMe
              ? "border-blue-500/30 text-blue-200/80"
              : "border-zinc-100 dark:border-zinc-800/60 text-zinc-400 dark:text-zinc-500"
          }`}
        >
          <span className="truncate max-w-[180px]">{preview.hostname}</span>
          <ExternalLink
            className={`h-3 w-3 shrink-0 ml-1 ${
              isMe ? "text-blue-200" : "text-blue-500"
            }`}
          />
        </div>
      </div>
    </a>
  );
}
