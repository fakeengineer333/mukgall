"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Image as ImageIcon,
  MessageSquare,
  ThumbsUp,
  Search,
  PenSquare,
  Sparkles,
  Flame,
  ChevronLeft,
  ChevronRight,
  Shield,
  Trash2,
} from "lucide-react";
import { Post, Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface DcPostListProps {
  posts: Post[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentTab: string;
  searchQuery: string;
  searchType: string;
  isAdmin?: boolean;
}

// Format date like DCInside (HH:mm if today, MM.DD if past) in KST
function formatDcDate(dateString: string) {
  if (!dateString) return "";
  const d = new Date(dateString);

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const nowParts = formatter.formatToParts(new Date());
  const getNow = (type: string) => nowParts.find((p) => p.type === type)?.value || "";

  const isToday = get("month") === getNow("month") && get("day") === getNow("day");
  if (isToday) {
    return `${get("hour")}:${get("minute")}`;
  }
  return `${get("month")}.${get("day")}`;
}

export function DcPostList({
  posts,
  totalCount,
  currentPage,
  pageSize,
  currentTab,
  searchQuery,
  searchType,
  isAdmin,
}: DcPostListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchQuery);
  const [type, setType] = useState(searchType || "all");

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
      params.set("type", type);
    } else {
      params.delete("search");
      params.delete("type");
    }
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  };

  // Generate pagination page numbers
  const maxPageButtons = 5;
  const startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="space-y-4">
      {/* Top Header: Tabs & Write Button */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
        {/* DC Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTabChange("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              currentTab === "all"
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
            }`}
          >
            전체글
          </button>
          <button
            onClick={() => handleTabChange("recommend")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              currentTab === "recommend"
                ? "bg-amber-600 text-white"
                : "text-zinc-400 hover:text-amber-400 hover:bg-zinc-900"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            개념글
          </button>
          <button
            onClick={() => handleTabChange("image")}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              currentTab === "image"
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            사진
          </button>
        </div>

        {/* Quick Write Button */}
        <Link href="/posts/create">
          <Button size="sm" className="h-8 gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
            <PenSquare className="h-3.5 w-3.5" />
            글쓰기
          </Button>
        </Link>
      </div>

      {/* DCInside Style Table View */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
        {/* Desktop / Tablet Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 font-bold select-none">
                <th className="py-2.5 px-3 text-center w-14">번호</th>
                <th className="py-2.5 px-3">제목</th>
                <th className="py-2.5 px-3 w-32 text-left">글쓴이</th>
                <th className="py-2.5 px-3 text-center w-16">작성일</th>
                <th className="py-2.5 px-3 text-center w-14">조회</th>
                <th className="py-2.5 px-3 text-center w-14">추천</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500 text-xs">
                    등록된 게시글이 없습니다.
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const hasImage = post.image_urls && post.image_urls.length > 0;
                  const commentCount = post.comments_count || 0;
                  const isDeleted = Boolean(post.deleted_at);
                  const isAuthorAdmin = post.author?.role === "ADMIN";

                  return (
                    <tr
                      key={post.id}
                      className={`hover:bg-zinc-800/50 transition-colors ${
                        isDeleted ? "bg-red-950/10 opacity-70" : ""
                      }`}
                    >
                      {/* 번호 */}
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-500 text-[11px]">
                        {post.id}
                      </td>

                      {/* 제목 */}
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/posts/${post.id}`}
                          className="group inline-flex items-center gap-1.5 max-w-md truncate align-middle font-medium hover:text-blue-400 transition-colors"
                        >
                          {/* Image Icon Indicator */}
                          {hasImage && (
                            <span className="shrink-0 p-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-400">
                              <ImageIcon className="h-3 w-3" />
                            </span>
                          )}

                          <span className="truncate text-zinc-200 group-hover:text-blue-400">
                            {post.title}
                          </span>

                          {/* Comment Count in DC Style: [3] */}
                          {commentCount > 0 && (
                            <span className="font-bold text-[11px] text-blue-400 shrink-0">
                              [{commentCount}]
                            </span>
                          )}

                          {/* Soft-deleted indicator for admin */}
                          {isDeleted && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                              삭제됨
                            </Badge>
                          )}
                        </Link>
                      </td>

                      {/* 글쓴이 */}
                      <td className="py-2.5 px-3 text-left">
                        <div className="flex items-center gap-1 truncate max-w-[120px]">
                          <span className="text-zinc-300 truncate">
                            {post.author?.username || "ㅇㅇ"}
                          </span>
                          {isAuthorAdmin && (
                            <Shield className="h-3 w-3 text-amber-400 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* 작성일 */}
                      <td
                        suppressHydrationWarning
                        className="py-2.5 px-3 text-center text-zinc-400 text-[11px] whitespace-nowrap"
                      >
                        {post.formatted_date || formatDcDate(post.created_at)}
                      </td>

                      {/* 조회 */}
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-400 text-[11px]">
                        {post.view_count}
                      </td>

                      {/* 추천 */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold">
                        <span
                          className={
                            (post.like_count || 0) >= 3
                              ? "text-amber-400 font-black inline-flex items-center gap-0.5"
                              : (post.like_count || 0) > 0
                              ? "text-zinc-300"
                              : "text-zinc-500"
                          }
                        >
                          {(post.like_count || 0) >= 3 && <Flame className="h-3 w-3 text-amber-400" />}
                          {post.like_count || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Compact List View */}
        <div className="sm:hidden divide-y divide-zinc-800/60">
          {posts.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              등록된 게시글이 없습니다.
            </div>
          ) : (
            posts.map((post) => {
              const hasImage = post.image_urls && post.image_urls.length > 0;
              const commentCount = post.comments_count || 0;
              const isDeleted = Boolean(post.deleted_at);

              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="block p-3.5 hover:bg-zinc-800/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      {post.id}
                    </span>
                    {hasImage && (
                      <span className="shrink-0 p-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-400">
                        <ImageIcon className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <span className="text-xs font-semibold text-zinc-200 line-clamp-1 flex-1">
                      {post.title}
                    </span>
                    {commentCount > 0 && (
                      <span className="text-[11px] font-bold text-blue-400 shrink-0">
                        [{commentCount}]
                      </span>
                    )}
                    {isDeleted && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                        삭제됨
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400">{post.author?.username || "ㅇㅇ"}</span>
                      <span>•</span>
                      <span suppressHydrationWarning>{post.formatted_date || formatDcDate(post.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2.5 font-mono">
                      <span>조회 {post.view_count}</span>
                      <span className={(post.like_count || 0) > 0 ? "text-amber-400 font-bold" : ""}>
                        추천 {post.like_count || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Controls: Pagination & Search */}
      <div className="flex flex-col items-center gap-4 pt-2">
        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 select-none">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`flex h-8 min-w-8 px-2 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  currentPage === page
                    ? "bg-blue-600 text-white shadow"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search Bar & Write Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 pt-2">
          {/* DC Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 w-full sm:w-auto">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">글쓴이</option>
            </select>

            <div className="relative flex-1 sm:w-48">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="검색어 입력..."
                className="h-9 text-xs pl-3 pr-8"
              />
            </div>

            <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 text-xs font-semibold">
              <Search className="h-3.5 w-3.5" />
            </Button>
          </form>

          {/* Bottom Write Button */}
          <Link href="/posts/create" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto h-9 gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <PenSquare className="h-4 w-4" />
              글쓰기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
