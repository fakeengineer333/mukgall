"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { extractInternalPostId } from "@/lib/urlSafety";
import { assertSafePublicUrl } from "@/lib/ssrfGuard";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  hostname: string;
}

interface CacheEntry {
  data: LinkPreviewData | null;
  expiresAt: number;
}

const ogCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 256 * 1024;

function setOgCache(key: string, entry: CacheEntry) {
  if (ogCache.has(key)) {
    ogCache.delete(key);
  } else if (ogCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = ogCache.keys().next().value;
    if (oldestKey !== undefined) {
      ogCache.delete(oldestKey);
    }
  }
  ogCache.set(key, entry);
}

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

function resolveUrl(
  relativeOrAbsolute: string | null | undefined,
  baseUrl: string
): string | null {
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
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${propertyOrName}["']\\s+content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].trim());
  }

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

async function fetchSafeHtml(
  initialUrl: string,
  signal: AbortSignal
): Promise<{ response: Response; finalUrl: string } | null> {
  let currentUrl = initialUrl;

  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const safeUrl = await assertSafePublicUrl(currentUrl);
    const response = await fetch(safeUrl.toString(), {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location || hops === MAX_REDIRECTS) {
        return null;
      }
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }

    return { response, finalUrl: safeUrl.toString() };
  }

  return null;
}

async function readBoundedHtml(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, MAX_HTML_BYTES);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let totalBytes = 0;
  let html = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      const remaining = MAX_HTML_BYTES - totalBytes;
      if (remaining <= 0) {
        await reader.cancel().catch(() => {});
        break;
      }

      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      totalBytes += chunk.byteLength;
      html += decoder.decode(chunk, { stream: true });

      if (html.toLowerCase().includes("</head>") || totalBytes >= MAX_HTML_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    html += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return html;
}

interface InternalPostPreviewRow {
  id: number;
  title: string;
  image_urls: string[] | null;
  author: { username: string | null } | null;
}

export async function getLinkPreviewAction(
  rawUrl: string
): Promise<LinkPreviewData | null> {
  // 1. FAST-PATH: Direct DB lookup strictly for internal Mukho Gallery post links
  const internalPostId = extractInternalPostId(rawUrl);
  if (internalPostId !== null) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("posts")
        .select("id, title, image_urls, author:profiles(username)")
        .eq("id", internalPostId)
        .is("deleted_at", null)
        .maybeSingle();

      const post = data as unknown as InternalPostPreviewRow | null;
      if (post) {
        const authorName = post.author?.username || "익명";
        const thumbnail =
          Array.isArray(post.image_urls) && post.image_urls.length > 0
            ? post.image_urls[0]
            : null;
        return {
          url: `/posts/${internalPostId}`,
          title: post.title,
          description: "묵호 커뮤니티 사이트",
          image: thumbnail,
          siteName: `묵갤 • ${authorName}`,
          favicon: "/icons/icon-192.png",
          hostname: "묵갤 (Mukho Gallery)",
        };
      }
    } catch (e) {
      console.warn("[getLinkPreviewAction] Internal post lookup notice:", e);
    }
  }

  const url = cleanUrl(rawUrl);
  if (!url || url.startsWith("/")) return null;

  const cached = ogCache.get(url);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const fetched = await fetchSafeHtml(url, controller.signal);
    if (!fetched) {
      setOgCache(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }

    const { response, finalUrl } = fetched;
    const parsedUrl = new URL(finalUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      setOgCache(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      await response.body?.cancel().catch(() => {});
      setOgCache(url, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const html = await readBoundedHtml(response);

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

    const image = resolveUrl(ogImageRaw, finalUrl);

    const siteName =
      extractMetaTag(html, "og:site_name") ||
      extractMetaTag(html, "application-name") ||
      hostname;

    let faviconRaw: string | null = null;
    const faviconMatch = html.match(
      /<link\s+[^>]*?rel=["'](?:shortcut\s+)?icon["'][^>]*?href=["']([^"']*)["']/i
    );
    if (faviconMatch && faviconMatch[1]) {
      faviconRaw = faviconMatch[1];
    } else {
      faviconRaw = "/favicon.ico";
    }
    const favicon = resolveUrl(faviconRaw, finalUrl);

    if (!title && !ogDesc && !image) {
      setOgCache(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
      return null;
    }

    const result: LinkPreviewData = {
      url: finalUrl,
      title: title || hostname,
      description: ogDesc || null,
      image,
      siteName,
      favicon,
      hostname,
    };

    setOgCache(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    setOgCache(url, { data: null, expiresAt: Date.now() + 60 * 1000 });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
