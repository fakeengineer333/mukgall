"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shield, LogIn } from "lucide-react";
import { Profile } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  userProfile?: Profile | null;
}

export function Header({ userProfile }: HeaderProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (isAuthPage) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Title */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-black tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <Image
            src="/icons/icon-192.png"
            alt="묵호 갤러리 로고"
            width={32}
            height={32}
            className="h-8 w-8 rounded-xl object-cover border border-zinc-700/60 shadow-md group-hover:scale-105 transition-transform"
            priority
          />
          <span className="text-lg font-black tracking-tight">묵호 갤러리</span>
        </Link>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {userProfile ? (
            <div className="flex items-center gap-2">
              {userProfile.role === "ADMIN" && (
                <Link href="/admin">
                  <Badge
                    variant="admin"
                    className="flex items-center gap-1 cursor-pointer hover:bg-amber-500/20 transition-colors"
                  >
                    <Shield className="h-3 w-3" />
                    관리자
                  </Badge>
                </Link>
              )}
              <Link
                href="/mypage"
                className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <Avatar
                  src={userProfile.avatar_url}
                  fallbackText={userProfile.username}
                  size="sm"
                />
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 shadow hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
