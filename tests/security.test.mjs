import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeRedirectPath,
  sanitizePostgrestFilterValue,
  parsePositiveInt,
  extractInternalPostId,
  hasSupabaseAuthCookie,
} from "../src/lib/urlSafety.ts";
import {
  isPrivateOrReservedIp,
  isBlockedHostname,
  assertSafePublicUrl,
  hashClientFingerprint,
} from "../src/lib/ssrfGuard.ts";

describe("urlSafety utilities", () => {
  it("allows safe internal relative paths in sanitizeRedirectPath", () => {
    assert.equal(sanitizeRedirectPath("/"), "/");
    assert.equal(sanitizeRedirectPath("/posts/123"), "/posts/123");
    assert.equal(
      sanitizeRedirectPath("/?view=chat&tab=all#top"),
      "/?view=chat&tab=all#top"
    );
  });

  it("blocks open redirect attempts and control characters in sanitizeRedirectPath", () => {
    assert.equal(sanitizeRedirectPath(null), "/");
    assert.equal(sanitizeRedirectPath(undefined), "/");
    assert.equal(sanitizeRedirectPath(""), "/");
    assert.equal(sanitizeRedirectPath("//evil.com"), "/");
    assert.equal(sanitizeRedirectPath("/\\evil.com"), "/");
    assert.equal(sanitizeRedirectPath("https://evil.com/login"), "/");
    assert.equal(sanitizeRedirectPath("javascript:alert(1)"), "/");
    assert.equal(sanitizeRedirectPath("/posts/1\r\nSet-Cookie: a=b"), "/");
    assert.equal(sanitizeRedirectPath("/posts/1\0"), "/");
    assert.equal(sanitizeRedirectPath("https://evil.com", "/login"), "/login");
  });

  it("sanitizes PostgREST .or() filter values", () => {
    assert.equal(sanitizePostgrestFilterValue("  hello, world() "), "hello world");
    assert.equal(
      sanitizePostgrestFilterValue("a,title.ilike.%admin%"),
      "a title.ilike.%admin%"
    );
    assert.equal(sanitizePostgrestFilterValue(`"quoted"'\\'`), "quoted");
    assert.equal(sanitizePostgrestFilterValue("x".repeat(150)).length, 100);
  });

  it("parses positive integers safely with fallback", () => {
    assert.equal(parsePositiveInt("1"), 1);
    assert.equal(parsePositiveInt("12"), 12);
    assert.equal(parsePositiveInt("0"), 1);
    assert.equal(parsePositiveInt("-5"), 1);
    assert.equal(parsePositiveInt("abc"), 1);
    assert.equal(parsePositiveInt(undefined, 3), 3);
  });

  it("extracts internal post IDs only for relative paths or matching app hostname", () => {
    assert.equal(extractInternalPostId("/posts/42"), 42);
    assert.equal(extractInternalPostId("posts/42?ref=chat#top"), 42);
    assert.equal(
      extractInternalPostId("https://mukgall.example.com/posts/99", "https://mukgall.example.com"),
      99
    );
    assert.equal(
      extractInternalPostId("https://evil.com/posts/99", "https://mukgall.example.com"),
      null
    );
    assert.equal(extractInternalPostId("//evil.com/posts/99"), null);
    assert.equal(extractInternalPostId("/posts/abc"), null);
  });

  it("detects Supabase auth token cookies including chunked variants", () => {
    assert.equal(hasSupabaseAuthCookie([]), false);
    assert.equal(
      hasSupabaseAuthCookie([{ name: "theme" }, { name: "recommended_post_1" }]),
      false
    );
    assert.equal(
      hasSupabaseAuthCookie([{ name: "sb-abcdefgh-auth-token" }]),
      true
    );
    assert.equal(
      hasSupabaseAuthCookie([{ name: "sb-abcdefgh-auth-token.0" }]),
      true
    );
  });
});

describe("ssrfGuard utilities", () => {
  it("identifies private, loopback, metadata, CGNAT, and reserved IPv4/IPv6 addresses", () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("172.16.5.4"), true);
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true);
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
    assert.equal(isPrivateOrReservedIp("100.64.0.1"), true);
    assert.equal(isPrivateOrReservedIp("0.0.0.0"), true);
    assert.equal(isPrivateOrReservedIp("224.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("255.255.255.255"), true);

    assert.equal(isPrivateOrReservedIp("::"), true);
    assert.equal(isPrivateOrReservedIp("::1"), true);
    assert.equal(isPrivateOrReservedIp("fc00::1"), true);
    assert.equal(isPrivateOrReservedIp("fd12:3456::1"), true);
    assert.equal(isPrivateOrReservedIp("fe80::1"), true);
    assert.equal(isPrivateOrReservedIp("ff02::1"), true);
    assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIp("::ffff:7f00:1"), true);
    assert.equal(isPrivateOrReservedIp("not-an-ip"), true);

    assert.equal(isPrivateOrReservedIp("93.184.216.34"), false);
    assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
    assert.equal(isPrivateOrReservedIp("2606:4700:4700::1111"), false);
    assert.equal(isPrivateOrReservedIp("::ffff:1.1.1.1"), false);
  });

  it("blocks internal hostnames and private IP literals", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("LOCALHOST."), true);
    assert.equal(isBlockedHostname("api.localhost"), true);
    assert.equal(isBlockedHostname("printer.local"), true);
    assert.equal(isBlockedHostname("db.internal"), true);
    assert.equal(isBlockedHostname("metadata.google.internal"), true);
    assert.equal(isBlockedHostname("127.0.0.1"), true);
    assert.equal(isBlockedHostname("[::1]"), true);
    assert.equal(isBlockedHostname("example.com"), false);
  });

  it("enforces protocol, credentials, port, and DNS resolution in assertSafePublicUrl", async () => {
    const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const privateLookup = async () => [{ address: "10.0.0.5", family: 4 }];
    const mixedLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ];

    const okUrl = await assertSafePublicUrl("https://example.com/article", publicLookup);
    assert.equal(okUrl.hostname, "example.com");

    await assert.rejects(() => assertSafePublicUrl("file:///etc/passwd", publicLookup));
    await assert.rejects(() => assertSafePublicUrl("https://user:pass@example.com/", publicLookup));
    await assert.rejects(() => assertSafePublicUrl("https://example.com:8080/", publicLookup));
    await assert.rejects(() => assertSafePublicUrl("http://127.0.0.1/admin", publicLookup));
    await assert.rejects(() => assertSafePublicUrl("https://rebind.example.com/", privateLookup));
    await assert.rejects(() => assertSafePublicUrl("https://mixed.example.com/", mixedLookup));
    await assert.rejects(() => assertSafePublicUrl("https://empty.example.com/", async () => []));
  });

  it("produces deterministic SHA-256 fingerprints", () => {
    const h1 = hashClientFingerprint("1.2.3.4", "Mozilla/5.0");
    const h2 = hashClientFingerprint("1.2.3.4", "Mozilla/5.0");
    const h3 = hashClientFingerprint("1.2.3.4", "Mozilla/5.0", "2026-11-21");

    assert.equal(h1.length, 64);
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
  });
});
