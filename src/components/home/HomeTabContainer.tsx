"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare, PenSquare, User, LogIn } from "lucide-react";
import { DcPostList } from "@/components/gallery/DcPostList";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { MyActivityList } from "@/components/profile/MyActivityList";
import { Button } from "@/components/ui/button";
import { Post, Profile, ChatRoom, Comment } from "@/types";

interface HomeTabContainerProps {
  initialView?: "gallery" | "chat" | "mypage";
  userProfile: Profile | null;
  // Gallery Props
  galleryProps: {
    posts: Post[];
    totalCount: number;
    currentPage: number;
    pageSize: number;
    currentTab: string;
    searchQuery: string;
    searchType: string;
    isAdmin: boolean;
  };
  // Chat Props
  chatProps: {
    rooms: ChatRoom[];
    currentUserId?: string;
  };
  // MyPage Props
  myPageProps: {
    posts: Post[];
    comments: Comment[];
  };
}

export function HomeTabContainer({
  initialView = "gallery",
  userProfile,
  galleryProps,
  chatProps,
  myPageProps,
}: HomeTabContainerProps) {
  const [activeView, setActiveView] = useState<"gallery" | "chat" | "mypage">(initialView);

  // Sync state if initialView changes
  useEffect(() => {
    if (initialView && initialView !== activeView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  // Listen to browser Back / Forward (PopState)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view === "chat" || view === "mypage") {
        setActiveView(view);
      } else {
        setActiveView("gallery");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Listen to custom fast tab switch event from BottomNav
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvt = e as CustomEvent<"gallery" | "chat" | "mypage">;
      if (customEvt.detail) {
        setActiveView(customEvt.detail);
      }
    };

    window.addEventListener("app:switch-tab", handleSwitchTab);
    return () => window.removeEventListener("app:switch-tab", handleSwitchTab);
  }, []);

  return (
    <div className="w-full">
      {/* 1. GALLERY TAB (Keep-Alive: Stays mounted in DOM to preserve scroll position) */}
      <div className={activeView === "gallery" ? "block space-y-5 pb-8" : "hidden"}>
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/80 via-zinc-900 to-indigo-950/80 p-5 sm:p-6 border border-blue-900/30 shadow-lg">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Image
                src="/icons/icon-192.png"
                alt="묵호 갤러리"
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-2xl border border-zinc-700/80 shadow-md object-cover"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  묵호 갤러리
                </h1>
                <p className="text-xs text-zinc-300 dark:text-zinc-400 mt-0.5">
                  반갑다. 묵호 갤러리다.
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link href="/posts/create" className="flex-1 sm:flex-none">
                <Button size="sm" className="w-full h-9 gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
                  <PenSquare className="h-4 w-4" />
                  글쓰기
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState(null, "", "/?view=chat");
                  setActiveView("chat");
                }}
                className="flex-1 sm:flex-none"
              >
                <Button size="sm" variant="outline" className="w-full h-9 gap-1.5 font-bold text-xs border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  채팅방
                </Button>
              </button>
            </div>
          </div>
        </section>

        {/* DCInside Style Board List with Pagination */}
        <DcPostList
          posts={galleryProps.posts}
          totalCount={galleryProps.totalCount}
          currentPage={galleryProps.currentPage}
          pageSize={galleryProps.pageSize}
          currentTab={galleryProps.currentTab}
          searchQuery={galleryProps.searchQuery}
          searchType={galleryProps.searchType}
          isAdmin={galleryProps.isAdmin}
        />
      </div>

      {/* 2. CHAT TAB (Keep-Alive / Instant 0ms View) */}
      <div className={activeView === "chat" ? "block space-y-6 max-w-2xl mx-auto pb-10" : "hidden"}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            메시지
          </h1>
          {userProfile && <NewChatModal />}
        </div>

        {userProfile ? (
          <ChatRoomList
            rooms={chatProps.rooms as any}
            currentUserId={userProfile.id}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-lg dark:shadow-none backdrop-blur-md space-y-4">
            <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-200">로그인이 필요한 기능입니다</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">실시간 1:1 대화 및 단체 채팅을 시작해보세요.</p>
            </div>
            <Link href="/login?redirectTo=/?view=chat">
              <Button size="sm" className="gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <LogIn className="h-3.5 w-3.5" />
                로그인하기
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 3. MYPAGE TAB (Keep-Alive / Instant 0ms View) */}
      <div className={activeView === "mypage" ? "block space-y-6 max-w-2xl mx-auto pb-10" : "hidden"}>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <User className="h-6 w-6 text-blue-500" />
          마이페이지
        </h1>

        {userProfile ? (
          <>
            <ProfileCard
              profile={userProfile}
              postsCount={myPageProps.posts.length}
              commentsCount={myPageProps.comments.length}
            />
            <MyActivityList
              posts={myPageProps.posts}
              comments={myPageProps.comments}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-lg dark:shadow-none backdrop-blur-md space-y-4">
            <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              <User className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-200">로그인이 필요합니다</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">내 프로필, 작성 글, 댓글을 관리하려면 로그인하세요.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/login?redirectTo=/?view=mypage">
                <Button size="sm" className="gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <LogIn className="h-3.5 w-3.5" />
                  로그인
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="outline" className="font-bold text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                  회원가입
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
