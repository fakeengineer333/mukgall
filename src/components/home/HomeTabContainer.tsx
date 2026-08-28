"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare, PenSquare, User, LogIn, Loader2 } from "lucide-react";
import { fetchUserChatRoomsAction } from "@/app/actions/chat";
import { fetchUserActivityAction } from "@/app/actions/post";
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

  // In-memory cached data states
  const [rooms, setRooms] = useState<ChatRoom[]>(chatProps.rooms);
  const [userPosts, setUserPosts] = useState<Post[]>(myPageProps.posts);
  const [userComments, setUserComments] = useState<Comment[]>(myPageProps.comments);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingMyPage, setLoadingMyPage] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(chatProps.rooms.length > 0);
  const [myPageLoaded, setMyPageLoaded] = useState(myPageProps.posts.length > 0 || myPageProps.comments.length > 0);

  // Sync state if initialView changes
  useEffect(() => {
    if (initialView && initialView !== activeView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  // Idle Background Prefetching: Quietly prefetch Chat & MyPage in the background when browser is idle
  useEffect(() => {
    if (!userProfile) return;

    const prefetchIdle = () => {
      // 1. Prefetch Chat Rooms in background
      if (!chatLoaded && !loadingChat) {
        fetchUserChatRoomsAction()
          .then((data) => {
            setRooms(data);
            setChatLoaded(true);
          })
          .catch(() => {});
      }

      // 2. Prefetch MyPage Activity in background
      if (!myPageLoaded && !loadingMyPage) {
        fetchUserActivityAction()
          .then((data) => {
            setUserPosts(data.posts);
            setUserComments(data.comments);
            setMyPageLoaded(true);
          })
          .catch(() => {});
      }
    };

    // Use requestIdleCallback if supported, else setTimeout
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(prefetchIdle, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(prefetchIdle, 600);
      return () => clearTimeout(timer);
    }
  }, [userProfile, chatLoaded, myPageLoaded, loadingChat, loadingMyPage]);

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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  window.history.pushState(null, "", "/?view=chat");
                  setActiveView("chat");
                }}
                className="flex-1 sm:flex-none h-9 gap-1.5 font-bold text-xs border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200"
              >
                <MessageSquare className="h-4 w-4 text-blue-400" />
                채팅방
              </Button>
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
          loadingChat && !chatLoaded ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70">
                  <div className="h-11 w-11 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ChatRoomList
              rooms={rooms as any}
              currentUserId={userProfile.id}
            />
          )
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
          loadingMyPage && !myPageLoaded ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-44 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70" />
              <div className="h-60 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70" />
            </div>
          ) : (
            <>
              <ProfileCard
                profile={userProfile}
                postsCount={userPosts.length}
                commentsCount={userComments.length}
              />
              <MyActivityList
                posts={userPosts}
                comments={userComments}
              />
            </>
          )
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
