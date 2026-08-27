"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const { unreadCount } = useChat();
  const [mounted, setMounted] = useState(false);

  const isHome = pathname === "/";
  const [currentTab, setCurrentTab] = useState<string>("gallery");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync tab with URL searchParams & PopState on client
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view") || "gallery";
      setCurrentTab(view);
    }
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === "/") {
        const params = new URLSearchParams(window.location.search);
        setCurrentTab(params.get("view") || "gallery");
      }
    };

    const handleSwitch = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      if (customEvt.detail) {
        setCurrentTab(customEvt.detail);
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("app:switch-tab", handleSwitch);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("app:switch-tab", handleSwitch);
    };
  }, []);

  // Hide on auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  const handleTabClick = (
    e: React.MouseEvent,
    tabKey: "gallery" | "chat" | "mypage",
    fallbackHref: string
  ) => {
    if (isHome) {
      e.preventDefault();
      setCurrentTab(tabKey);
      const newUrl = tabKey === "gallery" ? "/" : `/?view=${tabKey}`;
      window.history.pushState(null, "", newUrl);
      window.dispatchEvent(
        new CustomEvent("app:switch-tab", { detail: tabKey })
      );
    } else {
      e.preventDefault();
      router.push(fallbackHref);
    }
  };

  const navItems = [
    {
      key: "gallery",
      label: "갤러리",
      href: "/",
      icon: ImageIcon,
      active:
        (isHome && currentTab === "gallery") ||
        (pathname.startsWith("/posts/") && !pathname.includes("/create")),
      onClick: (e: React.MouseEvent) => handleTabClick(e, "gallery", "/"),
    },
    {
      key: "chat",
      label: "메시지",
      href: "/chat",
      icon: MessageSquare,
      active: (isHome && currentTab === "chat") || pathname.startsWith("/chat"),
      badge: mounted && unreadCount > 0 ? unreadCount : undefined,
      onClick: (e: React.MouseEvent) => handleTabClick(e, "chat", "/?view=chat"),
    },
    {
      key: "create",
      label: "글쓰기",
      href: "/posts/create",
      icon: PlusCircle,
      active: pathname === "/posts/create",
      highlight: true,
      onClick: undefined,
    },
    {
      key: "mypage",
      label: "마이",
      href: "/mypage",
      icon: User,
      active: (isHome && currentTab === "mypage") || pathname.startsWith("/mypage"),
      onClick: (e: React.MouseEvent) => handleTabClick(e, "mypage", "/?view=mypage"),
    },
  ];

  if (userRole === "ADMIN") {
    navItems.push({
      key: "admin",
      label: "관리자",
      href: "/admin",
      icon: Shield,
      active: pathname.startsWith("/admin"),
      badge: undefined,
      highlight: false,
      onClick: undefined,
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] transition-colors">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={item.onClick}
              prefetch={true}
              className={cn(
                "relative flex flex-col items-center justify-center py-1 px-3 text-xs font-medium transition-all select-none cursor-pointer",
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
