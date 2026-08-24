"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, ImageIcon, MessageSquare, AlertCircle } from "lucide-react";
import { Post, Comment } from "@/types";
import { restorePostAction } from "@/app/actions/post";
import { restoreCommentAction } from "@/app/actions/comment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface DeletedContentManagerProps {
  initialPosts: Post[];
  initialComments: (Comment & { post?: Post | null })[];
}

export function DeletedContentManager({
  initialPosts,
  initialComments,
}: DeletedContentManagerProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [comments, setComments] = useState<(Comment & { post?: Post | null })[]>(initialComments);
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");
  const [isPending, startTransition] = useTransition();

  const handleRestorePost = (postId: number) => {
    if (confirm("이 게시글을 복구하시겠습니까? (일반 갤러리에 다시 노출됩니다)")) {
      startTransition(async () => {
        const res = await restorePostAction(postId);
        if (res.success) {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      });
    }
  };

  const handleRestoreComment = (commentId: number, postId: number) => {
    if (confirm("이 댓글을 복구하시겠습니까?")) {
      startTransition(async () => {
        const res = await restoreCommentAction(commentId, postId);
        if (res.success) {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Switch Tab */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Button
          size="sm"
          variant={activeTab === "posts" ? "default" : "ghost"}
          className="gap-1.5 text-xs font-bold"
          onClick={() => setActiveTab("posts")}
        >
          <ImageIcon className="h-4 w-4" />
          삭제된 게시글 ({posts.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "comments" ? "default" : "ghost"}
          className="gap-1.5 text-xs font-bold"
          onClick={() => setActiveTab("comments")}
        >
          <MessageSquare className="h-4 w-4" />
          삭제된 댓글 ({comments.length})
        </Button>
      </div>

      {/* Deleted Posts List */}
      {activeTab === "posts" && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500 bg-zinc-950/40">
              삭제된 게시글이 없습니다.
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-4 rounded-xl border border-red-900/30 bg-zinc-900/90 shadow-md transition-colors"
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      삭제됨
                    </Badge>
                    <span className="text-sm font-bold text-zinc-100 truncate">
                      {post.title}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    작성자: {post.author?.username || "익명"} • 삭제일: {formatDate(post.deleted_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/posts/${post.id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      미리보기
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    onClick={() => handleRestorePost(post.id)}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    복구
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Deleted Comments List */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500 bg-zinc-950/40">
              삭제된 댓글이 없습니다.
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-center justify-between p-4 rounded-xl border border-red-900/30 bg-zinc-900/90 shadow-md transition-colors"
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      삭제됨
                    </Badge>
                    <span className="text-xs font-semibold text-zinc-400">
                      게시글 #{comment.post_id} ({comment.post?.title || "게시글"})
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 line-clamp-1">
                    {comment.content}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    작성자: {comment.author?.username || "익명"} • 삭제일: {formatDate(comment.deleted_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/posts/${comment.post_id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      게시글
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    onClick={() => handleRestoreComment(comment.id, comment.post_id)}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    복구
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
