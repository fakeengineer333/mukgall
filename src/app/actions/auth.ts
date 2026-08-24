"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ratelimit";

const RESERVED_USERNAMES = [
  "묵호",
  "mukho",
  "admin",
  "운영자",
  "관리자",
  "administrator",
  "root",
];

function isReservedUsername(username: string): boolean {
  const clean = username.trim().toLowerCase();
  return RESERVED_USERNAMES.some(
    (reserved) => clean === reserved.toLowerCase()
  );
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const loginSchema = z.object({
  email: z
    .string()
    .email("올바른 이메일 주소를 입력해주세요.")
    .regex(EMAIL_REGEX, "올바른 이메일 형식(예: user@example.com)을 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
});

const signupSchema = z.object({
  email: z
    .string()
    .email("올바른 이메일 주소를 입력해주세요.")
    .regex(EMAIL_REGEX, "올바른 이메일 형식(예: user@example.com)을 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  username: z
    .string()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다.")
    .regex(/^[a-zA-Z0-9가-힣_-]+$/, "닉네임에는 영문, 한글, 숫자, -, _만 사용할 수 있습니다."),
  bio: z.string().max(200, "한 줄 소개는 최대 200자까지 가능합니다.").optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export interface AuthState {
  error?: string | null;
  success?: boolean;
  needsVerification?: boolean;
  email?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
}

export async function checkUsernameAvailabilityAction(
  username: string
): Promise<{ available: boolean; message: string }> {
  const trimmed = username.trim();
  if (!trimmed) {
    return { available: false, message: "닉네임을 입력해주세요." };
  }

  if (trimmed.length < 2 || trimmed.length > 20) {
    return { available: false, message: "닉네임은 2자 이상 20자 이하여야 합니다." };
  }

  if (!/^[a-zA-Z0-9가-힣_-]+$/.test(trimmed)) {
    return { available: false, message: "영문, 한글, 숫자, -, _만 사용할 수 있습니다." };
  }

  // 1. Reserved nickname check
  if (isReservedUsername(trimmed)) {
    return {
      available: false,
      message: "생성할 수 없는 닉네임입니다.",
    };
  }

  // 2. Database duplicate check
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", trimmed)
    .maybeSingle();

  if (data) {
    return { available: false, message: "이미 사용 중인 닉네임입니다." };
  }

  return { available: true, message: "사용 가능한 닉네임입니다." };
}

export async function checkEmailAvailabilityAction(
  email: string
): Promise<{ available: boolean; message: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { available: false, message: "이메일을 입력해주세요." };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      available: false,
      message: "올바른 이메일 형식(예: user@example.com)을 입력해주세요.",
    };
  }

  const supabase = await createClient();

  // 1. Try RPC check_email_exists
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exists, error } = await (supabase as any).rpc("check_email_exists", {
      p_email: trimmed,
    });

    if (!error && typeof exists === "boolean") {
      if (exists) {
        return { available: false, message: "이미 가입된 이메일입니다." };
      }
      return { available: true, message: "가입 가능한 이메일입니다." };
    }
  } catch (e) {
    console.warn("[checkEmailAvailability] RPC check notice:", e);
  }

  // 2. Admin client listUsers check (if service role key is configured)
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient.auth.admin.listUsers();
    if (data?.users) {
      const userExists = data.users.some(
        (u) => u.email?.toLowerCase() === trimmed.toLowerCase()
      );
      if (userExists) {
        return { available: false, message: "이미 가입된 이메일입니다." };
      }
    }
  } catch (e) {
    console.warn("[checkEmailAvailability] Admin list fallback notice:", e);
  }

  return { available: true, message: "가입 가능한 이메일입니다." };
}

export async function loginAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  const validated = loginSchema.safeParse({ email, password });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력값이 올바르지 않습니다." };
  }

  // Rate Limiting on Login: Max 10 attempts per minute per email
  const rateLimitRes = await checkRateLimit(`login:${email.toLowerCase()}`, 10, 60);
  if (!rateLimitRes.success) {
    return { error: "로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "이메일 인증이 완료되지 않았습니다. 이메일에서 인증 링크 또는 코드를 확인해주세요.",
        needsVerification: true,
        email,
      };
    }
    return { error: error.message || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요." };
  }

  if (data.user) {
    await recordAuditLog({
      actorId: data.user.id,
      action: "AUTH_LOGIN",
      targetType: "profiles",
      targetId: data.user.id,
      metadata: { email: data.user.email },
    });
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signupAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const username = (formData.get("username") as string)?.trim();
  const bio = (formData.get("bio") as string) || "";
  const avatar_url = (formData.get("avatar_url") as string) || "";
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  const validated = signupSchema.safeParse({
    email,
    password,
    username,
    bio,
    avatar_url: avatar_url || undefined,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력값이 올바르지 않습니다." };
  }

  // Rate Limiting on Signup: Max 5 signups per 5 minutes per email
  const signupRateLimit = await checkRateLimit(`signup:${email.toLowerCase()}`, 5, 300);
  if (!signupRateLimit.success) {
    return { error: "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." };
  }

  // 1. Check reserved username
  if (isReservedUsername(username)) {
    return {
      error: "생성할 수 없는 닉네임입니다.",
    };
  }

  const supabase = await createClient();

  // 2. Check username duplicate in profiles
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile) {
    return { error: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요." };
  }

  // 3. Check email duplicate via RPC
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exists } = await (supabase as any).rpc("check_email_exists", {
      p_email: email,
    });
    if (exists === true) {
      return { error: "이미 가입된 이메일 주소입니다. 로그인해주세요." };
    }
  } catch {}

  const userRole = "USER";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        bio,
        avatar_url: avatar_url || null,
        role: userRole,
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("user already exists")
    ) {
      return { error: "이미 가입된 이메일 주소입니다. 로그인해주세요." };
    }
    return { error: error.message || "회원가입에 실패했습니다." };
  }

  // In Supabase, if email is already registered and email confirmation is on,
  // signUp returns a user object with empty identities array ([])
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "이미 가입된 이메일 주소입니다. 로그인해주세요." };
  }

  if (data.user) {
    // If email confirmation is required (no active session yet)
    if (!data.session) {
      return {
        success: true,
        needsVerification: true,
        email,
        username,
        bio,
        avatar_url,
      };
    }

    // Direct login session established
    const supabaseAdmin = createAdminClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from("profiles") as any).upsert({
        id: data.user.id,
        username,
        role: userRole,
        bio: bio || null,
        avatar_url: avatar_url || null,
      });
    } catch (e) {
      console.warn("[Signup] Profile upsert fallback warning:", e);
    }

    await recordAuditLog({
      actorId: data.user.id,
      action: "AUTH_SIGNUP",
      targetType: "profiles",
      targetId: data.user.id,
      metadata: { email, username, role: userRole },
    });

    revalidatePath("/", "layout");
    redirect(redirectTo);
  }

  return { error: "회원가입 처리 중 문제가 발생했습니다." };
}

export async function verifySignupOtpAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const token = (formData.get("token") as string)?.trim();
  const username = (formData.get("username") as string)?.trim() || "";
  const bio = (formData.get("bio") as string) || "";
  const avatar_url = (formData.get("avatar_url") as string) || "";
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  if (!email || !token) {
    return {
      ...prevState,
      error: "이메일과 8자리 인증 코드를 입력해주세요.",
    };
  }

  const supabase = await createClient();

  // Try verifying OTP with signup type
  let { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    // Fallback: try with 'email' type
    const fallbackRes = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error || !data.user) {
    return {
      ...prevState,
      error: `인증 실패: ${error?.message || "인증 코드가 올바르지 않거나 만료되었습니다."}`,
    };
  }

  const user = data.user;
  const finalUsername =
    username ||
    (user.user_metadata?.username as string) ||
    email.split("@")[0];

  const userRole = "USER";

  const supabaseAdmin = createAdminClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("profiles") as any).upsert({
      id: user.id,
      username: finalUsername,
      role: userRole,
      bio: bio || (user.user_metadata?.bio as string) || null,
      avatar_url: avatar_url || (user.user_metadata?.avatar_url as string) || null,
    });
  } catch (e) {
    console.warn("[VerifyOtp] Profile upsert notice:", e);
  }

  await recordAuditLog({
    actorId: user.id,
    action: "AUTH_SIGNUP",
    targetType: "profiles",
    targetId: user.id,
    metadata: { email, username: finalUsername, role: userRole, method: "OTP_VERIFIED" },
  });

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function resendSignupOtpAction(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const rateLimitRes = await checkRateLimit(`resend_otp:${cleanEmail}`, 3, 300);
    if (!rateLimitRes.success) {
      return { success: false, error: "인증 코드 재발송 요청이 너무 많습니다. 5분 후 다시 시도해주세요." };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await recordAuditLog({
      actorId: user.id,
      action: "AUTH_LOGOUT",
      targetType: "profiles",
      targetId: user.id,
      metadata: { email: user.email },
    });
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
