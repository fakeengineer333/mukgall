"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, Search, ImageOff } from "lucide-react";
import { Post } from "@/types";
import { PostCard } from "@/components/gallery/PostCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PostGridProps {
  posts: Post[];
  isAdmin?: boolean;
}

export function PostGrid({ posts, isAdmin }: PostGridProps) {
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  // Filter posts based on search query and deleted toggle
  const filteredPosts = posts.filter((post) => {
    // If not admin, already filtered out deleted_at by query, but double check
    if (!isAdmin && post.deleted_at) return false;
    if (isAdmin && !showDeleted && post.deleted_at) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      post.title.toLowerCase().includes(q) ||
      post.content.toLowerCase().includes(q) ||
      post.author?.username.toLowerCase().includes(q)
    );
  });

  // Sort
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (tab === "popular") {
      return b.view_count - a.view_count;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Control Bar: Search & Sort Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Sort Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <Button
            size="sm"
            variant={tab === "latest" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setTab("latest")}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            최신순
          </Button>
          <Button
            size="sm"
            variant={tab === "popular" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold rounded-lg"
            onClick={() => setTab("popular")}
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            인기순
          </Button>
        </div>

        {/* Search & Admin Toggle */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 내용, 작성자 검색..."
              className="h-9 pl-9 text-xs"
            />
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant={showDeleted ? "destructive" : "outline"}
              className="h-9 text-xs shrink-0"
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? "삭제글 숨기기" : "삭제글 포함"}
            </Button>
          )}
        </div>
      </div>

      {/* Grid Container */}
      {sortedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40">
          <div className="p-3 rounded-full bg-zinc-900 text-zinc-600">
            <ImageOff className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-300">
              {searchQuery ? "검색 결과가 없습니다." : "아직 등록된 사진이 없습니다."}
            </p>
            <p className="text-xs text-zinc-500">
              첫 번째 사진을 업로드하여 갤러리를 시작해보세요!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sortedPosts.map((post) => (
            <PostCard key={post.id} post={post} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
