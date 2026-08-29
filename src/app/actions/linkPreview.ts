"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  hostname: string;
}

// In-memory cache for OpenGraph metadata (TTL: 24 hours)
interface CacheEntry {
  data: LinkPreviewData | null;
  expiresAt: number;
}

const ogCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cleanUrl(rawUrl: string): string | null {
  try {
    let normalized = rawUrl.trim();
    if (normalized.startsWith("/")) {
      return normalized;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveUrl(relativeOrAbsolute: string | null | undefined, baseUrl: string): string | null {
  if (!relativeOrAbsolute) return null;
  try {
    return new URL(relativeOrAbsolute, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

function extractMetaTag(html: string, propertyOrName: string): string | null {
  // Regex to match <meta property="..." content="..."> or <meta name="..." content="...">
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${propertyOrName}["']\\s+content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].trim());
  }

  // Reverse attribute order: <meta content="..." property="...">
  const reverseRegex = new RegExp(
    `<meta\\s+(?:[^>]*?\\s+)?content=["']([^"']*)["']\\s+(?:property|name)=["']${propertyOrName}["']`,
    "i"
  );
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch && reverseMatch[1]) {
    return decodeHtmlEntities(reverseMatch[1].trim());
  }

  return null;
}

export async function getLinkPreviewAction(rawUrl: string): Promise<LinkPreviewData | null> {
  // 1. FAST-PATH: Direct DB lookup for internal Mukho Gallery post links (/posts/123 or https://.../posts/123)
  const postMatch = rawUrl.match(/(?:\/posts\/|^posts\/)(\d+)(?:[/?#]|$)/);
  if (postMatch && postMatch[1]) {
    try {
      const postId = parseInt(postMatch[1], 10);
      const supabase = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: post } = await (supabase.from("posts") as any)
        .select("id, title, content, image_urls, created_at, author:profiles(username, avatar_url)")
        .eq("id", postId)
        .is("deleted_at", null)
        .maybeSingle();

      if (post) {
        const authorName = (post.author as any)?.username || "익명";
        const thumbnail = Array.isArray(post.image_urls) && post.image_urls.length > 0
          ? post.image_urls[0]
          : null;
        return {
          url: `/posts/${postId}`,
          title: post.title,
          description: "묵호 커뮤니티 사이트",
          image: thumbnail,
          siteName: `묵갤 • ${authorName}`,
          favicon: "/icons/icon-192x192.png",
          hostname: "묵갤 (Mukho Gallery)",
        };
      }
    } catch (e) {
      console.warn("[getLinkPreviewAction] Internal post lookup notice:", e);
    }
  }

  const url = cleanUrl(rawUrl);
  if (!url) return null;

  // Check in-memory cache
  const cached = ogCache.get(url);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    // Abort controller with 4s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      ogCache.set(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      ogCache.set(url, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const html = await response.text();

    // Extract OpenGraph / Twitter metadata
    const ogTitle =
      extractMetaTag(html, "og:title") ||
      extractMetaTag(html, "twitter:title");

    let title = ogTitle;
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = decodeHtmlEntities(titleMatch[1].trim());
      }
    }

    const ogDesc =
      extractMetaTag(html, "og:description") ||
      extractMetaTag(html, "description") ||
      extractMetaTag(html, "twitter:description");

    const ogImageRaw =
      extractMetaTag(html, "og:image") ||
      extractMetaTag(html, "og:image:secure_url") ||
      extractMetaTag(html, "twitter:image") ||
      extractMetaTag(html, "twitter:image:src");

    const image = resolveUrl(ogImageRaw, url);

    const siteName =
      extractMetaTag(html, "og:site_name") ||
      extractMetaTag(html, "application-name") ||
      hostname;

    // Favicon extraction
    let faviconRaw: string | null = null;
    const faviconMatch = html.match(
      /<link\s+[^>]*?rel=["'](?:shortcut\s+)?icon["'][^>]*?href=["']([^"']*)["']/i
    );
    if (faviconMatch && faviconMatch[1]) {
      faviconRaw = faviconMatch[1];
    } else {
      faviconRaw = "/favicon.ico";
    }
    const favicon = resolveUrl(faviconRaw, url);

    // If at least title or description or image is found
    if (!title && !ogDesc && !image) {
      ogCache.set(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }

    const result: LinkPreviewData = {
      url,
      title: title || hostname,
      description: ogDesc || null,
      image,
      siteName,
      favicon,
      hostname,
    };

    // Cache successful result
    ogCache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    ogCache.set(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
    return null;
  }
}
