"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Send, Loader2, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { Comment, UserRole } from "@/types";
import { createCommentAction, deleteCommentAction, restoreCommentAction } from "@/app/actions/comment";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
  currentUserId?: string | null;
  currentUserRole?: UserRole | null;
}

export function CommentSection({
  postId,
  comments,
  currentUserId,
  currentUserRole,
}: CommentSectionProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = currentUserRole === "ADMIN";

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError(null);
    const formData = new FormData();
    formData.append("content", content);

    startTransition(async () => {
      const res = await createCommentAction(postId, { error: null }, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setContent("");
      }
    });
  };

  const handleDelete = (commentId: number) => {
    if (confirm("이 댓글을 삭제하시겠습니까?")) {
      startTransition(async () => {
        await deleteCommentAction(commentId, postId);
      });
    }
  };

  const handleRestore = (commentId: number) => {
    if (confirm("삭제된 댓글을 복구하시겠습니까?")) {
      startTransition(async () => {
        await restoreCommentAction(commentId, postId);
      });
    }
  };

  // Filter out deleted comments for normal users, but keep for admin
  const visibleComments = comments.filter((c) => {
    if (!c.deleted_at) return true;
    return isAdmin;
  });

  return (
    <div className="space-y-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          댓글 ({visibleComments.length})
        </h3>
      </div>

      {/* New Comment Input */}
      {currentUserId ? (
        <form onSubmit={handleCreateComment} className="space-y-2">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="따뜻한 댓글을 남겨보세요..."
              maxLength={1000}
              disabled={isPending}
              className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <Button
              type="submit"
              disabled={isPending || !content.trim()}
              className="h-11 px-4 gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">등록</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            댓글을 작성하려면{" "}
            <Link
              href={`/login?redirectTo=/posts/${postId}`}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              로그인
            </Link>
            이 필요합니다.
          </p>
        </div>
      )}

      {/* Comment List */}
      <div className="space-y-3">
        {visibleComments.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">
            가장 먼저 첫 댓글을 남겨보세요!
          </p>
        ) : (
          visibleComments.map((comment) => {
            const isAuthor = comment.author_id === currentUserId;
            const isDeleted = Boolean(comment.deleted_at);

            return (
              <div
                key={comment.id}
                className={`p-3.5 rounded-xl border ${
                  isDeleted
                    ? "border-red-900/30 bg-red-950/10 opacity-70"
                    : "border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/60"
                } space-y-2 transition-colors shadow-sm dark:shadow-none`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={comment.author?.avatar_url}
                      fallbackText={comment.author?.username || "익명"}
                      size="sm"
                      className="h-6 w-6"
                    />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      {comment.author?.username || "익명"}
                    </span>
                    {comment.author?.role === "ADMIN" && (
                      <Badge variant="admin" className="text-[10px] px-1.5 py-0">
                        관리자
                      </Badge>
                    )}
                    <span className="text-[11px] text-zinc-500">
                      {formatDate(comment.created_at)}
                    </span>
                    {isDeleted && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        삭제됨
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {!isDeleted && (isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={isPending}
                        className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                        title="댓글 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isDeleted && isAdmin && (
                      <button
                        onClick={() => handleRestore(comment.id)}
                        disabled={isPending}
                        className="p-1 rounded text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                        title="댓글 복구"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed pl-8">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
