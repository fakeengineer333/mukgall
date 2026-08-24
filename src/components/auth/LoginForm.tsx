"use client";

import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";
import { loginAction, AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const initialState: AuthState = { error: null };
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 text-center pb-6">
        <Link href="/" className="inline-flex flex-col items-center gap-2.5 group mx-auto">
          <Image
            src="/icons/icon-192.png"
            alt="묵호 갤러리"
            width={48}
            height={48}
            className="h-12 w-12 rounded-2xl border border-zinc-700/80 shadow-lg object-cover group-hover:scale-105 transition-transform"
            priority
          />
          <CardTitle className="text-2xl font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
            묵호 갤러리 로그인
          </CardTitle>
        </Link>
        <CardDescription className="text-zinc-400">
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
              className="text-xs font-semibold text-zinc-300"
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
                className="text-xs font-semibold text-zinc-300"
              >
                비밀번호
              </label>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={isPending}
            />
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
