"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, MessageSquare, PlusCircle, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { sendChatNotification, isNotificationSupported } from "@/lib/notifications";

interface BottomNavProps {
  userRole?: UserRole | null;
  currentUserId?: string | null;
}

export function BottomNav({ userRole, currentUserId: initialUserId }: BottomNavProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId || null);
  const pathnameRef = useRef(pathname);

  // Keep pathname ref synced without triggering effects
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Sync initialUserId prop
  useEffect(() => {
    if (initialUserId && initialUserId !== currentUserId) {
      setCurrentUserId(initialUserId);
    }
  }, [initialUserId, currentUserId]);

  // Fallback: resolve user ID if not provided
  useEffect(() => {
    if (!currentUserId) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.id) {
          setCurrentUserId(data.user.id);
        }
      });
    }
  }, [currentUserId]);

  // Calculate unread count across user's active rooms
  const refreshUnreadCount = useCallback(async (uid: string) => {
    try {
      const supabase = createClient();

      const { data: participations } = await supabase
        .from("chat_participants")
        .select("room_id, last_read_at")
        .eq("user_id", uid)
        .is("left_at", null);

      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        return;
      }

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
      console.warn("[BottomNav] Count unread failed:", e);
    }
  }, []);

  // Recalculate unread count on pathname or user changes
  useEffect(() => {
    if (currentUserId) {
      refreshUnreadCount(currentUserId);
    }
  }, [pathname, currentUserId, refreshUnreadCount]);

  // Single Realtime subscription for incoming messages & OS Notifications
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();

    const handleIncomingMessage = (newMsg: {
      room_id?: string;
      sender_id?: string;
      content?: string;
      sender?: { username?: string };
    }) => {
      if (!newMsg || !newMsg.room_id || newMsg.sender_id === currentUserId) return;

      const currentPath = pathnameRef.current;
      const isViewingCurrentRoom = currentPath === `/chat/${newMsg.room_id}`;

      // Update badge if not currently in this room
      if (!isViewingCurrentRoom) {
        setUnreadCount((prev) => prev + 1);
      }

      // Fire OS System Notification if in another tab, app background, or not in that chat room
      const senderName = newMsg.sender?.username || "새 메시지";
      const messageSnippet = newMsg.content || "사진을 보냈습니다.";

      sendChatNotification({
        title: `💬 ${senderName}`,
        body: messageSnippet,
        roomId: newMsg.room_id,
      });
    };

    // Isolated channel for BottomNav to avoid collisions with any other components
    const channel = supabase
      .channel(`bottom_nav_${currentUserId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMsg = payload.new as {
            id?: string;
            room_id?: string;
            sender_id?: string;
            content?: string;
          };
          if (!newMsg || !newMsg.room_id || newMsg.sender_id === currentUserId) return;

          // Fetch sender username for notification
          let senderUsername = "새 메시지";
          if (newMsg.sender_id) {
            const { data: senderProf } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", newMsg.sender_id)
              .maybeSingle();
            if (senderProf && (senderProf as any).username) {
              senderUsername = (senderProf as any).username;
            }
          }

          handleIncomingMessage({
            ...newMsg,
            sender: { username: senderUsername },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Auto request notification permission on user's first click if supported
  useEffect(() => {
    if (currentUserId && isNotificationSupported() && Notification.permission === "default") {
      const handleFirstInteraction = () => {
        Notification.requestPermission().then((p) => {
          if (p === "granted") {
            localStorage.setItem("mukgall_notifications_enabled", "true");
          }
        });
        window.removeEventListener("click", handleFirstInteraction);
      };
      window.addEventListener("click", handleFirstInteraction, { once: true });
      return () => {
        window.removeEventListener("click", handleFirstInteraction);
      };
    }
  }, [currentUserId]);

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
