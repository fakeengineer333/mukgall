"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserPlus,
  AlertCircle,
  Sparkles,
  Loader2,
  Camera,
  MailCheck,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Mail,
} from "lucide-react";
import {
  signupAction,
  verifySignupOtpAction,
  resendSignupOtpAction,
  checkUsernameAvailabilityAction,
  checkEmailAvailabilityAction,
  AuthState,
} from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { uploadImageToStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  // Step 1: Initial signup action state
  const initialSignupState: AuthState = { error: null };
  const [signupState, signupFormAction, isSignupPending] = useActionState(
    signupAction,
    initialSignupState
  );

  // Step 2: OTP verification action state
  const initialOtpState: AuthState = { error: null };
  const [otpState, otpFormAction, isOtpPending] = useActionState(
    verifySignupOtpAction,
    initialOtpState
  );

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Duplicate check status
  const [usernameCheck, setUsernameCheck] = useState<{ checked: boolean; available: boolean; message: string } | null>(null);
  const [emailCheck, setEmailCheck] = useState<{ checked: boolean; available: boolean; message: string } | null>(null);
  const [isCheckingUsername, startUsernameCheck] = useTransition();
  const [isCheckingEmail, startEmailCheck] = useTransition();

  // Resend state
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, startResendTransition] = useTransition();

  // Determine if in Step 2 (verification mode)
  const isVerificationStep = Boolean(signupState?.needsVerification || otpState?.needsVerification);
  const activeEmail = signupState?.email || otpState?.email || email;

  // Real-time listener: If user clicks the email link on another tab or device, auto-redirect!
  useEffect(() => {
    if (!isVerificationStep) return;

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        router.push(redirectTo);
        router.refresh();
      }
    });

    // Polling fallback every 3s
    const timer = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        router.push(redirectTo);
        router.refresh();
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [isVerificationStep, redirectTo, router]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setUploadingAvatar(true);
    const fileName = `temp-${Date.now()}-${file.name}`;
    const { url, error } = await uploadImageToStorage("avatars", fileName, file);
    setUploadingAvatar(false);

    if (error) {
      console.warn("Avatar upload notice:", error);
    } else if (url) {
      setAvatarUrl(url);
    }
  };

  const handleCheckUsername = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameCheck({ checked: true, available: false, message: "닉네임을 입력해주세요." });
      return;
    }
    startUsernameCheck(async () => {
      const res = await checkUsernameAvailabilityAction(trimmed);
      setUsernameCheck({ checked: true, available: res.available, message: res.message });
    });
  };

  const handleCheckEmail = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailCheck({ checked: true, available: false, message: "이메일을 입력해주세요." });
      return;
    }
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailCheck({
        checked: true,
        available: false,
        message: "올바른 이메일 형식(예: user@example.com)을 입력해주세요.",
      });
      return;
    }
    startEmailCheck(async () => {
      const res = await checkEmailAvailabilityAction(trimmed);
      setEmailCheck({ checked: true, available: res.available, message: res.message });
    });
  };

  const handleResendOtp = () => {
    if (!activeEmail) return;
    setResendStatus(null);
    startResendTransition(async () => {
      const res = await resendSignupOtpAction(activeEmail);
      if (res.success) {
        setResendStatus("인증 메일을 다시 발송했습니다. 메일함을 확인해주세요.");
      } else {
        setResendStatus(`재전송 실패: ${res.error}`);
      }
    });
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 text-center pb-5">
        <Link href="/" className="inline-flex flex-col items-center gap-2 group mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
            {isVerificationStep ? <MailCheck className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
            {isVerificationStep ? "이메일 인증 안내" : "묵호 갤러리 회원가입"}
          </CardTitle>
        </Link>
        <CardDescription className="text-zinc-400">
          {isVerificationStep
            ? "발송된 이메일을 확인하여 인증을 완료해주세요."
            : "간단한 프로필을 생성하고 갤러리 커뮤니티에 참여하세요."}
        </CardDescription>
      </CardHeader>

      {/* STEP 2: Email Verification & OTP View */}
      {isVerificationStep ? (
        <form action={otpFormAction}>
          <CardContent className="space-y-4">
            {otpState?.error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{otpState.error}</span>
              </div>
            )}

            {resendStatus && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
                {resendStatus}
              </div>
            )}

            {/* Email Address Indicator */}
            <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800 text-center space-y-1.5">
              <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                <Mail className="h-3.5 w-3.5 text-blue-400" />
                인증 메일 수신처
              </p>
              <p className="text-sm font-mono font-bold text-white break-all">{activeEmail}</p>
            </div>

            {/* Verification Instructions (Link Click & OTP Code) */}
            <div className="rounded-xl bg-blue-950/30 border border-blue-800/40 p-4 space-y-2 text-xs text-zinc-300 leading-relaxed">
              <p className="font-bold text-blue-300 flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                인증 방법 안내
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-300 text-[11px]">
                <li>
                  수신된 메일에서 <strong className="text-white">[Confirm your mail]</strong> 링크를 클릭하시면 즉시 로그인이 완료됩니다.
                </li>
                <li>
                  또는 메일 본문에 8자리 코드가 포함되어 있는 경우 아래에 입력하세요.
                </li>
              </ol>
            </div>

            <input type="hidden" name="email" value={activeEmail} />
            <input type="hidden" name="username" value={signupState?.username || username} />
            <input type="hidden" name="bio" value={signupState?.bio || bio} />
            <input type="hidden" name="avatar_url" value={signupState?.avatar_url || avatarUrl} />
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {/* Optional 8-digit OTP code input */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="token" className="text-xs font-semibold text-zinc-300">
                8자리 인증 코드 (코드 수신 시에만 입력)
              </label>
              <Input
                id="token"
                name="token"
                type="text"
                placeholder="12345678"
                maxLength={10}
                className="text-center font-mono text-lg tracking-widest h-11"
                disabled={isOtpPending}
              />
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending || isOtpPending}
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
              >
                <RotateCcw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                {isResending ? "재전송 중..." : "인증 메일 다시 보내기"}
              </button>

              <Link
                href="/signup"
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <ArrowLeft className="h-3 w-3" />
                정보 다시 입력
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2 shadow-lg shadow-blue-600/30 font-bold"
              disabled={isOtpPending}
            >
              {isOtpPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  인증 확인 중...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  인증 코드로 완료하기
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      ) : (
        /* STEP 1: Initial Profile & Email Input View */
        <form action={signupFormAction}>
          <CardContent className="space-y-4">
            {signupState?.error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{signupState.error}</span>
              </div>
            )}

            <input type="hidden" name="redirectTo" value={redirectTo} />
            <input type="hidden" name="avatar_url" value={avatarUrl} />

            {/* Avatar Picker */}
            <div className="flex flex-col items-center justify-center space-y-2 pt-1 pb-2">
              <div className="relative group cursor-pointer">
                <Avatar
                  src={avatarPreview || avatarUrl}
                  fallbackText={username || "User"}
                  size="lg"
                  className="border-2 border-zinc-700"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isSignupPending || uploadingAvatar}
                />
              </div>
              <label
                htmlFor="avatar-upload"
                className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-200"
              >
                {uploadingAvatar ? "이미지 업로드 중..." : "프로필 사진 선택 (선택)"}
              </label>
            </div>

            {/* Username with Duplicate & Reserved Check */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="username" className="text-xs font-semibold text-zinc-300">
                  닉네임
                </label>
                <button
                  type="button"
                  onClick={handleCheckUsername}
                  disabled={isCheckingUsername || isSignupPending || !username.trim()}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-40"
                >
                  {isCheckingUsername ? "확인 중..." : "중복 확인"}
                </button>
              </div>

              <div className="flex gap-2">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="닉네임 입력 (2~20자)"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameCheck(null);
                  }}
                  onBlur={() => {
                    if (username.trim() && !usernameCheck) {
                      handleCheckUsername();
                    }
                  }}
                  required
                  autoComplete="username"
                  disabled={isSignupPending}
                  className="flex-1"
                />
              </div>

              {usernameCheck && (
                <p
                  className={`flex items-center gap-1 text-[11px] font-medium ${
                    usernameCheck.available ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {usernameCheck.available ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {usernameCheck.message}
                </p>
              )}
            </div>

            {/* Email with Duplicate Check */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="email" className="text-xs font-semibold text-zinc-300">
                  이메일
                </label>
                <button
                  type="button"
                  onClick={handleCheckEmail}
                  disabled={isCheckingEmail || isSignupPending || !email.trim()}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-40"
                >
                  {isCheckingEmail ? "확인 중..." : "중복 확인"}
                </button>
              </div>

              <div className="flex gap-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailCheck(null);
                  }}
                  onBlur={() => {
                    if (email.trim() && !emailCheck) {
                      handleCheckEmail();
                    }
                  }}
                  required
                  autoComplete="email"
                  disabled={isSignupPending}
                  className="flex-1"
                />
              </div>

              {emailCheck && (
                <p
                  className={`flex items-center gap-1 text-[11px] font-medium ${
                    emailCheck.available ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {emailCheck.available ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {emailCheck.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-300">
                비밀번호
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="최소 6자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isSignupPending}
              />
            </div>

            {/* Bio (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="bio" className="text-xs font-semibold text-zinc-300">
                한 줄 소개 (선택)
              </label>
              <Input
                id="bio"
                name="bio"
                type="text"
                placeholder="자신을 자유롭게 소개해보세요."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                disabled={isSignupPending}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2 shadow-lg shadow-blue-600/30 font-bold"
              disabled={
                isSignupPending ||
                uploadingAvatar ||
                (usernameCheck !== null && !usernameCheck.available) ||
                (emailCheck !== null && !emailCheck.available)
              }
            >
              {isSignupPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  인증 메일 전송 중...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  이메일 인증 및 가입 요청
                </>
              )}
            </Button>

            <p className="text-center text-xs text-zinc-400">
              이미 계정이 있으신가요?{" "}
              <Link
                href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
                className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                로그인하기
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
