"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { LogIn, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { loginAction, AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [showPassword, setShowPassword] = useState(false);
  const initialState: AuthState = { error: null };
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center pb-6">
        <div className="flex flex-col items-center gap-2.5 mx-auto">
          {/* ONLY Icon is a clickable link to home */}
          <Link href="/" className="group" title="홈으로 이동">
            <Image
              src="/icons/icon-192.png"
              alt="묵호 갤러리"
              width={48}
              height={48}
              className="h-12 w-12 rounded-2xl border border-zinc-700/80 shadow-lg object-cover group-hover:scale-105 transition-transform"
              priority
            />
          </Link>
          <CardTitle className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white select-none">
            로그인
          </CardTitle>
        </div>
        <CardDescription className="text-zinc-500 dark:text-zinc-400">
          갤러리와 실시간 채팅 서비스를 이용하려면 로그인해주세요.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              이메일
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                비밀번호
              </label>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                tabIndex={-1}
                title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 shadow-lg shadow-blue-600/30 font-bold"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                로그인
              </>
            )}
          </Button>

          <p className="text-center text-xs text-zinc-400">
            아직 계정이 없으신가요?{" "}
            <Link
              href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
              className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
            >
              회원가입하기
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
