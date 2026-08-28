"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Share2,
  ThumbsUp,
  Flame,
} from "lucide-react";
import { Post, Comment, Profile, UserRole } from "@/types";
import { deletePostAction, restorePostAction, recommendPostAction } from "@/app/actions/post";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommentSection } from "@/components/gallery/CommentSection";
import { FormattedText } from "@/components/common/FormattedText";
import { formatDate } from "@/lib/utils";

interface PostDetailViewProps {
  post: Post;
  comments: Comment[];
  currentUserId?: string | null;
  currentUserRole?: UserRole | null;
  currentUserProfile?: Profile | null;
}

export function PostDetailView({
  post,
  comments,
  currentUserId,
  currentUserRole,
  currentUserProfile,
}: PostDetailViewProps) {
  const router = useRouter();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [likes, setLikes] = useState(post.like_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRecommending, startRecommendTransition] = useTransition();

  const isAuthor = post.author_id === currentUserId;
  const isAdmin = currentUserRole === "ADMIN";
  const isDeleted = Boolean(post.deleted_at);

  const images = post.image_urls || [];

  const handleRecommend = () => {
    if (isLiked) return;
    const prevLikes = likes;
    // Optimistic UI: immediately increment and mark liked
    setLikes((prev) => prev + 1);
    setIsLiked(true);

    startRecommendTransition(async () => {
      const res = await recommendPostAction(post.id);
      if (res.success && res.newLikeCount !== undefined) {
        setLikes(res.newLikeCount);
      } else if (res.error) {
        // Rollback on failure
        setLikes(prevLikes);
        setIsLiked(false);
        alert(res.error);
      }
    });
  };

  const handleDelete = () => {
    if (confirm("정말 이 게시글을 삭제하시겠습니까? (삭제 후 관리자만 복구 가능)")) {
      startTransition(async () => {
        const res = await deletePostAction(post.id);
        if (res.success) {
          router.push("/");
        } else if (res.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleRestore = () => {
    if (confirm("삭제된 게시글을 복구하시겠습니까?")) {
      startTransition(async () => {
        await restorePostAction(post.id);
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          url: window.location.href,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("게시글 링크가 클립보드에 복사되었습니다!");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Deleted Banner for Admin */}
      {isDeleted && (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-red-500/40 bg-red-950/40 text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold">이 게시글은 논리 삭제(Soft Deleted) 상태입니다.</p>
              <p className="text-[11px] text-red-400/80">일반 사용자에게는 노출되지 않으며, 관리자만 열람 및 복구가 가능합니다.</p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shrink-0"
              onClick={handleRestore}
              disabled={isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              게시글 복구
            </Button>
          )}
        </div>
      )}

      {/* Main Post Card */}
      <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
        {/* Gallery Image Display (Optional) */}
        {images.length > 0 && (
          <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-zinc-950 overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
            <Image
              src={images[activeImageIndex]}
              alt={`${post.title} - ${activeImageIndex + 1}`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-contain"
            />

            {/* Carousel navigation controls if multiple images */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() =>
                    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Counter indicator */}
                <div className="absolute bottom-3 right-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow">
                  {activeImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Thumbnail Selector (if multiple images) */}
        {images.length > 1 && (
          <div className="flex gap-2 p-3 bg-zinc-100 dark:bg-zinc-950/60 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  activeImageIndex === idx
                    ? "border-blue-500 ring-2 ring-blue-500/20 scale-105"
                    : "border-zinc-300 dark:border-zinc-800 opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={url} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}

        <CardContent className="p-5 sm:p-7 space-y-6">
          {/* Post Header: Title & Meta */}
          <div className="space-y-3">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight">
              {post.title}
            </h1>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={post.author?.avatar_url}
                  fallbackText={post.author?.username || "ㅇㅇ"}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {post.author?.username || "ㅇㅇ"}
                    </span>
                    {post.author?.role === "ADMIN" && (
                      <Badge variant="admin" className="text-[10px] px-1.5 py-0">
                        관리자
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {formatDate(post.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Eye className="h-3.5 w-3.5" />
                  <span>조회 {post.view_count}</span>
                </div>

                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40 font-bold">
                  <Flame className="h-3.5 w-3.5" />
                  <span>추천 {likes}</span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  onClick={handleShare}
                  title="공유하기"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 leading-relaxed min-h-[100px]">
            <FormattedText content={post.content} bubbleStyle="post" />
          </div>

          {/* DCInside Style Recommend Upvote Box */}
          <div className="flex flex-col items-center justify-center py-6 border-y border-zinc-200 dark:border-zinc-800/80 my-4 space-y-2 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl">
            <Button
              onClick={handleRecommend}
              className={`h-12 px-7 rounded-2xl gap-2 font-black text-sm shadow-xl transition-all ${
                isLiked || (post.like_count && post.like_count > 0)
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
                  : "bg-zinc-800 hover:bg-amber-600 hover:text-white text-zinc-200 border border-zinc-700"
              }`}
              disabled={isRecommending || isDeleted}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>개추</span>
              <span className="font-mono text-base ml-1 font-black">{likes}</span>
            </Button>
            <p className="text-[11px] text-zinc-500">
              이 글이 유익하거나 재미있다면 개념글로 추천해주세요!
            </p>
          </div>

          {/* Author/Admin Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/">
              <Button variant="secondary" size="sm" className="text-xs font-semibold">
                ← 전체글 목록
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              {!isDeleted && (isAuthor || isAdmin) && (
                <>
                  <Link href={`/posts/${post.id}/edit`}>
                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      <Edit className="h-3.5 w-3.5" />
                      수정
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1 font-bold text-xs"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Comment Section */}
          <CommentSection
            postId={post.id}
            postAuthorId={post.author_id}
            comments={comments}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            currentUserProfile={currentUserProfile}
          />
        </CardContent>
      </Card>
    </div>
  );
}
