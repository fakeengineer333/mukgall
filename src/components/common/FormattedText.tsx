"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CornerDownRight } from "lucide-react";
import { LinkPreviewCard } from "@/components/common/LinkPreviewCard";

interface FormattedTextProps {
  content: string;
  showPreview?: boolean;
  compactPreview?: boolean;
  bubbleStyle?: "default" | "me" | "other" | "post" | "comment";
  className?: string;
}

// Regex to capture full URLs (https?://...), internal post links (/posts/123), www...., and common web domains
const URL_REGEX =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|\/posts\/\d+|(?:www\.)[^\s<]+[^<.,:;"')\]\s]|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|kr|co\.kr|io|dev|app|me|ai|tv|xyz|info)(?:\/[^\s<]*[^<.,:;"')\]\s])?)/gi;

function toValidHref(rawUrl: string): string {
  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  return `https://${rawUrl}`;
}

export function FormattedText({
  content,
  showPreview = true,
  compactPreview = false,
  bubbleStyle = "default",
  className = "",
}: FormattedTextProps) {
  // Check for quote reply pattern: "> [답장: {author}] {quoteText}\n{actualBody}"
  const { quoteInfo, cleanContent } = useMemo(() => {
    const quoteMatch = content.match(/^>\s*\[답장:\s*([^\]]+)\]\s*([^\n]+)\n?([\s\S]*)$/);
    if (quoteMatch) {
      return {
        quoteInfo: {
          author: quoteMatch[1].trim(),
          text: quoteMatch[2].trim(),
        },
        cleanContent: quoteMatch[3].trim(),
      };
    }
    return { quoteInfo: null, cleanContent: content };
  }, [content]);

  // Extract unique URLs for previews
  const urls = useMemo(() => {
    const matches = cleanContent.match(URL_REGEX);
    if (!matches) return [];
    const normalizedList = matches.map((m) => toValidHref(m));
    return Array.from(new Set(normalizedList)).slice(0, 2);
  }, [cleanContent]);

  // Tokenize text into plain text chunks and clickable URL links
  const renderedContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const regex = new RegExp(URL_REGEX);

    while ((match = regex.exec(cleanContent)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;
      const validHref = toValidHref(matchedText);

      // Push preceding plain text
      if (matchIndex > lastIndex) {
        parts.push(cleanContent.substring(lastIndex, matchIndex));
      }

      // Link style based on container
      let linkClass = "underline underline-offset-2 break-all transition-colors font-medium";
      if (bubbleStyle === "me") {
        linkClass += " text-blue-100 hover:text-white underline-offset-4";
      } else {
        linkClass += " text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300";
      }

      // Push clickable link (Next.js Link if internal)
      const isInternal = validHref.startsWith("/");
      parts.push(
        isInternal ? (
          <Link
            key={`link-${matchIndex}`}
            href={validHref}
            onClick={(e) => e.stopPropagation()}
            className={linkClass}
          >
            {matchedText}
          </Link>
        ) : (
          <a
            key={`link-${matchIndex}`}
            href={validHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={linkClass}
          >
            {matchedText}
          </a>
        )
      );

      lastIndex = regex.lastIndex;
    }

    // Push remaining plain text
    if (lastIndex < cleanContent.length) {
      parts.push(cleanContent.substring(lastIndex));
    }

    return parts;
  }, [cleanContent, bubbleStyle]);

  const cardVariant: "default" | "me" | "other" =
    bubbleStyle === "me" ? "me" : bubbleStyle === "other" ? "other" : "default";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Quote Box if present */}
      {quoteInfo && (
        <div
          className={`mb-2 p-2 rounded-lg border-l-4 text-xs select-none transition-colors ${
            bubbleStyle === "me"
              ? "border-l-blue-300 bg-blue-700/60 text-blue-100"
              : "border-l-blue-500 bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5 opacity-90">
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span>답장: {quoteInfo.author}</span>
          </div>
          <p className="truncate opacity-80 pl-4">{quoteInfo.text}</p>
        </div>
      )}

      {/* Clickable text with preserved whitespace and word-break */}
      <p className="whitespace-pre-wrap break-words leading-relaxed text-left">
        {renderedContent}
      </p>

      {/* OpenGraph Rich Preview Cards */}
      {showPreview && urls.length > 0 && (
        <div className="space-y-2 pt-1 w-full overflow-hidden">
          {urls.map((targetUrl) => (
            <LinkPreviewCard
              key={targetUrl}
              url={targetUrl}
              variant={cardVariant}
              compact={compactPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
