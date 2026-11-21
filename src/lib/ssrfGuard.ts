import net from "node:net";
import dns from "node:dns/promises";
import crypto from "node:crypto";

export interface LookupAddress {
  address: string;
  family: number;
}

export type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<LookupAddress[]>;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

function expandIpv6ToWords(ip: string): number[] | null {
  let target = ip.toLowerCase();
  const zoneIndex = target.indexOf("%");
  if (zoneIndex !== -1) {
    target = target.slice(0, zoneIndex);
  }

  // Convert embedded trailing IPv4 (e.g. ::ffff:127.0.0.1) into two 16-bit hex words
  const lastColon = target.lastIndexOf(":");
  if (lastColon !== -1 && target.slice(lastColon + 1).includes(".")) {
    const ipv4Part = target.slice(lastColon + 1);
    if (net.isIP(ipv4Part) !== 4) return null;
    const octets = ipv4Part.split(".").map((n) => Number.parseInt(n, 10));
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    target = `${target.slice(0, lastColon)}:${high}:${low}`;
  }

  const parts = target.split("::");
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(":").filter(Boolean) : [];

  const missing = 8 - (left.length + right.length);
  if (parts.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;

  const fullHex = [
    ...left,
    ...Array<string>(missing).fill("0"),
    ...right,
  ];

  if (fullHex.length !== 8) return null;

  const words: number[] = [];
  for (const hex of fullHex) {
    if (!/^[0-9a-f]{1,4}$/i.test(hex)) return null;
    words.push(Number.parseInt(hex, 16));
  }
  return words;
}

/**
 * Returns true if the given IP string is private, loopback, link-local,
 * multicast, unspecified, reserved, or unparseable (fail-closed).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 0) {
    return true;
  }

  if (version === 4) {
    const [a, b, c] = ip.split(".").map((n) => Number.parseInt(n, 10));
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (Benchmark)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
    return false;
  }

  const words = expandIpv6ToWords(ip);
  if (!words) {
    return true;
  }

  // :: (unspecified)
  if (words.every((w) => w === 0)) return true;
  // ::1 (loopback)
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true;
  // fc00::/7 (Unique local address)
  if ((words[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 (Link-local)
  if ((words[0] & 0xffc0) === 0xfe80) return true;
  // ff00::/8 (Multicast)
  if ((words[0] & 0xff00) === 0xff00) return true;

  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  const isIpv4Mapped =
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0xffff;

  if (isIpv4Mapped) {
    const embeddedIpv4 = `${(words[6] >> 8) & 0xff}.${words[6] & 0xff}.${(words[7] >> 8) & 0xff}.${words[7] & 0xff}`;
    return isPrivateOrReservedIp(embeddedIpv4);
  }

  return false;
}

/**
 * Checks whether a hostname targets localhost, internal DNS suffixes, metadata hosts,
 * or a private/reserved IP literal.
 */
export function isBlockedHostname(hostname: string): boolean {
  const clean = hostname
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (!clean) {
    return true;
  }

  if (
    BLOCKED_HOSTNAMES.has(clean) ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal")
  ) {
    return true;
  }

  if (net.isIP(clean) !== 0) {
    return isPrivateOrReservedIp(clean);
  }

  return false;
}

const defaultLookup: LookupFn = async (hostname, options) => {
  return dns.lookup(hostname, options);
};

/**
 * Validates that a URL is safe for server-side fetching:
 * - http/https only, no embedded credentials, only default/80/443 ports
 * - not a blocked internal hostname or private/reserved IP
 * - DNS resolution resolves exclusively to public IP addresses
 */
export async function assertSafePublicUrl(
  rawUrl: string,
  lookupFn: LookupFn = defaultLookup
): Promise<URL> {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed");
  }

  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Port is not allowed");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Blocked hostname");
  }

  const cleanHost = parsed.hostname
    .trim()
    .replace(/\.+$/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (net.isIP(cleanHost) === 0) {
    const resolved = await lookupFn(cleanHost, { all: true, verbatim: true });
    if (!resolved || resolved.length === 0) {
      throw new Error("DNS resolution returned no addresses");
    }

    for (const entry of resolved) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error("Resolved to a private or reserved IP address");
      }
    }
  }

  return parsed;
}

/**
 * Computes a deterministic SHA-256 fingerprint for client IP + User-Agent + optional salt.
 */
export function hashClientFingerprint(
  ip: string,
  userAgent: string,
  salt = ""
): string {
  const payload = salt ? `${ip}-${userAgent}-${salt}` : `${ip}-${userAgent}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
