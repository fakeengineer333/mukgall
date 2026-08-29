"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { createChatRoomAction } from "@/app/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface UserActionMenuProps {
  userId?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  userRole?: string | null;
  bio?: string | null;
  currentUserId?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function UserActionMenu({
  userId,
  username,
  avatarUrl,
  userRole,
  bio,
  currentUserId,
  children,
  className = "",
}: UserActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSelf = Boolean(currentUserId && userId && currentUserId === userId);
  const displayName = username || "익명";

  // Calculate coordinates and open menu
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!userId && !username) return;

    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = 135;

      // Calculate horizontal position (keep within viewport)
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }

      // Calculate vertical position (open upwards if close to bottom)
      let top = rect.bottom + 6;
      if (rect.bottom + menuHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - menuHeight - 6);
      }

      setMenuPos({ top, left });
    }

    setIsOpen((prev) => !prev);
  };

  // Close menu on click outside, scroll, resize, or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const handleViewPosts = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (username) {
      router.push(`/?search=${encodeURIComponent(username)}&type=author&page=1`);
    }
  };

  const handleStartChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;

    startTransition(async () => {
      // Create or find existing 1:1 chat room (or self chat)
      const res = await createChatRoomAction({
        targetUserIds: isSelf ? [] : [userId],
        isGroup: false,
      });

      if (res.success && res.roomId) {
        setIsOpen(false);
        router.push(`/chat/${res.roomId}`);
      } else {
        if (res.error?.includes("로그인") || res.error?.includes("인증")) {
          setIsOpen(false);
          router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        } else {
          alert(res.error || "대화방 연결에 실패했습니다.");
        }
      }
    });
  };

  return (
    <>
      {/* Trigger element inside the parent DOM */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className={`cursor-pointer inline-flex items-center select-none ${className}`}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {children}
      </div>

      {/* Global React Portal Menu: Placed on document.body to prevent clipping & z-index overlap */}
      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99999] min-w-[210px] sm:min-w-[230px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none text-zinc-900 dark:text-zinc-100"
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
          >
            {/* User Profile Header */}
            <div className="flex items-center gap-2.5 p-2 border-b border-zinc-100 dark:border-zinc-800/80 mb-1.5">
              <Avatar
                src={avatarUrl}
                fallbackText={displayName}
                size="md"
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-100">
                    {displayName}
                  </span>
                  {userRole === "ADMIN" && (
                    <Badge variant="admin" className="text-[9px] px-1 py-0 h-4">
                      관리자
                    </Badge>
                  )}
                  {isSelf && (
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      나
                    </span>
                  )}
                </div>
                {bio && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {bio}
                  </p>
                )}
              </div>
            </div>

            {/* Action List */}
            <div className="space-y-1">
              {/* 1. 작성글 보기 */}
              <button
                type="button"
                onClick={handleViewPosts}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
              >
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span>{isSelf ? "내 작성글 보기" : "작성글 보기"}</span>
              </button>

              {/* 2. 메시지 하기 (1:1 채팅) */}
              {userId && (
                <button
                  type="button"
                  onClick={handleStartChat}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 text-emerald-500 animate-spin shrink-0" />
                  ) : isSelf ? (
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  <span>
                    {isPending
                      ? "대화방 연결 중..."
                      : isSelf
                      ? "나와의 채팅"
                      : "1:1 메시지 하기"}
                  </span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
