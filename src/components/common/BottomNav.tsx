"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, MessageSquare, PlusCircle, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { useChat } from "@/providers/ChatProvider";

interface BottomNavProps {
  userRole?: UserRole | null;
  currentUserId?: string | null;
}

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();
  const { unreadCount } = useChat();

  // Hide on auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  const navItems = [
    {
      label: "갤러리",
      href: "/",
      icon: ImageIcon,
      active: pathname === "/" || (pathname.startsWith("/posts/") && !pathname.includes("/create")),
    },
    {
      label: "메시지",
      href: "/chat",
      icon: MessageSquare,
      active: pathname.startsWith("/chat"),
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: "글쓰기",
      href: "/posts/create",
      icon: PlusCircle,
      active: pathname === "/posts/create",
      highlight: true,
    },
    {
      label: "마이",
      href: "/mypage",
      icon: User,
      active: pathname.startsWith("/mypage"),
    },
  ];

  if (userRole === "ADMIN") {
    navItems.push({
      label: "관리자",
      href: "/admin",
      icon: Shield,
      active: pathname.startsWith("/admin"),
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-1 px-3 text-xs font-medium transition-all",
                item.active
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
            >
              <div className="relative">
                {item.highlight ? (
                  <div
                    className={cn(
                      "flex h-9 w-9 -mt-3 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95",
                      item.active && "ring-4 ring-blue-500/20"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      item.active && "scale-110"
                    )}
                  />
                )}

                {/* Red Badge / Dot on Unread Messages */}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-md shadow-red-600/50 animate-pulse">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] leading-none",
                  item.highlight && "mt-1.5"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
