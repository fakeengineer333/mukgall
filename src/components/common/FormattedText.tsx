"use client";

import React, { useMemo } from "react";
import { LinkPreviewCard } from "@/components/common/LinkPreviewCard";

interface FormattedTextProps {
  content: string;
  showPreview?: boolean;
  compactPreview?: boolean;
  bubbleStyle?: "default" | "me" | "other" | "post" | "comment";
  className?: string;
}

// Regex to capture full URLs (https?://...), www...., and common web domains
const URL_REGEX =
  /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|(?:www\.)[^\s<]+[^<.,:;"')\]\s]|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|kr|co\.kr|io|dev|app|me|ai|tv|xyz|info)(?:\/[^\s<]*[^<.,:;"')\]\s])?)/gi;

function toValidHref(rawUrl: string): string {
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
  // Extract unique URLs for previews
  const urls = useMemo(() => {
    const matches = content.match(URL_REGEX);
    if (!matches) return [];
    // Normalize and return up to 2 unique URLs to prevent preview flooding
    const normalizedList = matches.map((m) => toValidHref(m));
    return Array.from(new Set(normalizedList)).slice(0, 2);
  }, [content]);

  // Tokenize text into plain text chunks and clickable URL links
  const renderedContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex lastIndex
    const regex = new RegExp(URL_REGEX);

    while ((match = regex.exec(content)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;
      const validHref = toValidHref(matchedText);

      // Push preceding plain text
      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      // Link style based on container
      let linkClass =
        "underline underline-offset-2 break-all transition-colors font-medium";
      if (bubbleStyle === "me") {
        linkClass += " text-blue-100 hover:text-white underline-offset-4";
      } else {
        linkClass +=
          " text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300";
      }

      // Push clickable link
      parts.push(
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
      );

      lastIndex = regex.lastIndex;
    }

    // Push remaining plain text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts;
  }, [content, bubbleStyle]);

  const cardVariant: "default" | "me" | "other" =
    bubbleStyle === "me" ? "me" : bubbleStyle === "other" ? "other" : "default";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Clickable text with preserved whitespace and word-break */}
      <p className="whitespace-pre-wrap break-words">{renderedContent}</p>

      {/* Rich OpenGraph Link Previews */}
      {showPreview && urls.length > 0 && (
        <div className="space-y-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
          {urls.map((url) => (
            <LinkPreviewCard
              key={url}
              url={url}
              compact={compactPreview}
              variant={cardVariant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
