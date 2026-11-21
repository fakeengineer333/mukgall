const CONTROL_CHARS_REGEX = /[\r\n\t\0]/;

/**
 * Validates that a redirect target is a safe relative internal path.
 * Rejects protocol-relative URLs (//evil.com), backslash prefixes (/\evil.com),
 * absolute URLs, and control characters.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  if (CONTROL_CHARS_REGEX.test(raw)) {
    return fallback;
  }

  const trimmed = raw.trim();
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\")
  ) {
    return fallback;
  }

  try {
    const resolved = new URL(trimmed, "http://localhost");
    if (resolved.origin !== "http://localhost") {
      return fallback;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Strips characters that can break or inject extra clauses into PostgREST .or() filter strings.
 */
export function sanitizePostgrestFilterValue(raw: string): string {
  return raw
    .trim()
    .replace(/[,()"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * Parses a positive integer (>= 1) from query/route parameters, returning fallback on invalid input.
 */
export function parsePositiveInt(
  raw: string | undefined | null,
  fallback = 1
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

/**
 * Checks whether cookies contain a Supabase auth token cookie (standard or chunked).
 */
export function hasSupabaseAuthCookie(
  cookiesList: readonly { name: string }[]
): boolean {
  return cookiesList.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
}

/**
 * Extracts an internal Mukgall post ID only if the URL is a relative post path
 * or matches the configured application hostname.
 */
export function extractInternalPostId(
  rawUrl: string,
  appUrl?: string
): number | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  // Relative post path (/posts/123 or posts/123)
  if (trimmed.startsWith("/posts/") || trimmed.startsWith("posts/")) {
    const relMatch = trimmed.match(/^\/?posts\/(\d+)\/?(?:[?#].*)?$/);
    if (relMatch?.[1]) {
      const id = Number.parseInt(relMatch[1], 10);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    }
    return null;
  }

  // Absolute URL: must match the app hostname
  const configuredAppUrl = appUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredAppUrl) {
    return null;
  }

  try {
    const targetUrl = new URL(trimmed);
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      return null;
    }

    const expectedAppUrl = new URL(configuredAppUrl);
    if (targetUrl.hostname.toLowerCase() !== expectedAppUrl.hostname.toLowerCase()) {
      return null;
    }

    const pathMatch = targetUrl.pathname.match(/^\/posts\/(\d+)\/?$/);
    if (pathMatch?.[1]) {
      const id = Number.parseInt(pathMatch[1], 10);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}
