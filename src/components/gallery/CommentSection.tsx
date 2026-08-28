"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Send, Loader2, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { Comment, Profile, UserRole } from "@/types";
import { createCommentAction, deleteCommentAction, restoreCommentAction } from "@/app/actions/comment";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedText } from "@/components/common/FormattedText";
import { formatDate } from "@/lib/utils";

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
  currentUserId?: string | null;
  currentUserRole?: UserRole | null;
  currentUserProfile?: Profile | null;
}

export function CommentSection({
  postId,
  comments: initialComments,
  currentUserId,
  currentUserRole,
  currentUserProfile,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const DRAFT_KEY = `mukgall_draft_comment_${postId}`;

  // Sync with props when server revalidates
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        setContent(savedDraft);
      }
    }
  }, [DRAFT_KEY]);

  // Auto-save draft on change
  const handleContentChange = (val: string) => {
    setContent(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem(DRAFT_KEY, val);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  };

  const isAdmin = currentUserRole === "ADMIN";

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    const commentText = content.trim();
    if (!commentText || !currentUserId) return;

    setError(null);

    // 1. Optimistic UI: Immediately create temporary comment
    const tempId = -Date.now();
    const optimisticComment: Comment = {
      id: tempId,
      post_id: postId,
      author_id: currentUserId,
      content: commentText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      author: currentUserProfile
        ? currentUserProfile
        : {
            id: currentUserId,
            username: "나",
            avatar_url: null,
            bio: null,
            role: currentUserRole || "USER",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
    };

    // Append immediately & clear input
    setComments((prev) => [...prev, optimisticComment]);
    setContent("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
    }

    const formData = new FormData();
    formData.append("content", commentText);

    // 2. Background Server Action
    startTransition(async () => {
      const res = await createCommentAction(postId, { error: null }, formData);
      if (res.error) {
        // Rollback on error
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setContent(commentText);
        setError(res.error);
      }
    });
  };

  const handleDelete = (commentId: number) => {
    if (confirm("이 댓글을 삭제하시겠습니까?")) {
      const prevComments = [...comments];
      // Optimistic delete
      setComments((prev) =>
        isAdmin
          ? prev.map((c) => (c.id === commentId ? { ...c, deleted_at: new Date().toISOString() } : c))
          : prev.filter((c) => c.id !== commentId)
      );

      startTransition(async () => {
        const res = await deleteCommentAction(commentId, postId);
        if (res?.error) {
          // Rollback on error
          setComments(prevComments);
          alert(res.error);
        }
      });
    }
  };

  const handleRestore = (commentId: number) => {
    if (confirm("삭제된 댓글을 복구하시겠습니까?")) {
      const prevComments = [...comments];
      // Optimistic restore
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, deleted_at: null } : c))
      );

      startTransition(async () => {
        const res = await restoreCommentAction(commentId, postId);
        if (res?.error) {
          // Rollback on error
          setComments(prevComments);
          alert(res.error);
        }
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
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="따뜻한 댓글을 남겨보세요..."
              maxLength={1000}
              className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <Button
              type="submit"
              disabled={!content.trim()}
              className="h-11 px-4 gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="h-4 w-4" />
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
                        className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                        title="댓글 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isDeleted && isAdmin && (
                      <button
                        onClick={() => handleRestore(comment.id)}
                        className="p-1 rounded text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors"
                        title="댓글 복구"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed pl-8">
                  <FormattedText content={comment.content} bubbleStyle="comment" compactPreview={true} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
