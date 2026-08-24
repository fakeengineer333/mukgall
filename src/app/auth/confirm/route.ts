import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await recordAuditLog({
        actorId: data.user.id,
        action: "AUTH_SIGNUP",
        targetType: "profiles",
        targetId: data.user.id,
        metadata: { method: "EMAIL_CONFIRM_CODE", email: data.user.email },
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (!error && data.user) {
      await recordAuditLog({
        actorId: data.user.id,
        action: "AUTH_SIGNUP",
        targetType: "profiles",
        targetId: data.user.id,
        metadata: { method: "EMAIL_CONFIRM_TOKEN_HASH", email: data.user.email },
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("이메일 인증에 실패했거나 만료되었습니다.")}`
  );
}
