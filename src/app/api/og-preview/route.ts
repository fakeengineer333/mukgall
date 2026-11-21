import { NextRequest, NextResponse } from "next/server";
import { getLinkPreviewAction } from "@/app/actions/linkPreview";
import { checkRateLimit } from "@/lib/ratelimit";
import { hashClientFingerprint } from "@/lib/ssrfGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "";
  const ipHash = hashClientFingerprint(clientIp, userAgent);

  const rateLimitRes = await checkRateLimit(`og_preview:${ipHash}`, 60, 60);
  if (!rateLimitRes.success) {
    return NextResponse.json(
      { error: "Too many preview requests" },
      { status: 429 }
    );
  }

  try {
    const data = await getLinkPreviewAction(targetUrl);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    });
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
