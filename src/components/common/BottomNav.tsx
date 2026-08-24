"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, MessageSquare, PlusCircle, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface BottomNavProps {
  userRole?: UserRole | null;
  currentUserId?: string | null;
}

export function BottomNav({ userRole, currentUserId: initialUserId }: BottomNavProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId || null);

  // Calculate unread count across user's active rooms
  const checkUnreadCount = useCallback(async (uid: string) => {
    try {
      const supabase = createClient();

      // 1. Get user's active rooms and their last_read_at
      const { data: participations } = await supabase
        .from("chat_participants")
        .select("room_id, last_read_at")
        .eq("user_id", uid)
        .is("left_at", null);

      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        return;
      }

      // 2. Count messages after each room's last_read_at where sender != user
      let totalUnread = 0;
      for (const part of participations) {
        const lastRead = (part as any).last_read_at || "1970-01-01T00:00:00Z";
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", (part as any).room_id)
          .neq("sender_id", uid)
          .gt("created_at", lastRead);

        totalUnread += count || 0;
      }

      setUnreadCount(totalUnread);
    } catch (e) {
      console.warn("[BottomNav] Check unread failed:", e);
    }
  }, []);

  // Initialize current user and unread count
  useEffect(() => {
    const supabase = createClient();

    if (!currentUserId) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setCurrentUserId(data.user.id);
          checkUnreadCount(data.user.id);
        }
      });
    } else {
      checkUnreadCount(currentUserId);
    }
  }, [currentUserId, checkUnreadCount]);

  // Recalculate when navigating to/from chat pages
  useEffect(() => {
    if (currentUserId) {
      checkUnreadCount(currentUserId);
    }
  }, [pathname, currentUserId, checkUnreadCount]);

  // Real-time listener for incoming messages to toggle red dot/badge instantly (Broadcast + Postgres Changes)
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();

    const handleNewMessage = (newMsg: { room_id?: string; sender_id?: string }) => {
      if (!newMsg || newMsg.sender_id === currentUserId) return;
      // If user is currently looking at this room, don't show badge
      if (pathname === `/chat/${newMsg.room_id}`) return;
      setUnreadCount((prev) => prev + 1);
    };

    const channel = supabase
      .channel("bottom_nav_global_unread_sync", {
        config: { broadcast: { self: true } },
      })
      .on("broadcast", { event: "NEW_MESSAGE" }, (payload) => {
        const data = payload.payload as { roomId?: string; message?: { room_id?: string; sender_id?: string } };
        if (data?.message) {
          handleNewMessage(data.message);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as { room_id?: string; sender_id?: string };
          if (newMsg) {
            handleNewMessage(newMsg);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, pathname]);

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
