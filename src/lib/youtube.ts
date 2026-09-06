export interface YouTubeInfo {
  videoId: string;
  startTime?: number;
  originalUrl: string;
}

/**
 * Extracts YouTube video ID and start time from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - Support for &t=120 or &t=1m30s
 */
export function extractYouTubeInfo(rawUrl: string): YouTubeInfo | null {
  try {
    let target = rawUrl.trim();
    if (target.startsWith("/")) return null;
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }

    const parsed = new URL(target);
    const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");

    let videoId: string | null = null;
    let startTime: number | undefined = undefined;

    // Parse start timestamp if present
    const tParam = parsed.searchParams.get("t") || parsed.searchParams.get("start");
    if (tParam) {
      if (/^\d+$/.test(tParam)) {
        startTime = parseInt(tParam, 10);
      } else {
        const timeMatch = tParam.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
        if (timeMatch) {
          const h = parseInt(timeMatch[1] || "0", 10);
          const m = parseInt(timeMatch[2] || "0", 10);
          const s = parseInt(timeMatch[3] || "0", 10);
          const total = h * 3600 + m * 60 + s;
          if (total > 0) startTime = total;
        }
      }
    }

    if (host === "youtube.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || null;
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || null;
      } else if (parsed.pathname.startsWith("/live/")) {
        videoId = parsed.pathname.split("/")[2] || null;
      }
    } else if (host === "youtu.be") {
      videoId = parsed.pathname.replace(/^\//, "").split("/")[0] || null;
    }

    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return {
        videoId,
        startTime,
        originalUrl: rawUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}
