"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Send, Trash2, RotateCcw, AlertCircle, CornerDownRight, X } from "lucide-react";
import { Comment, Profile, UserRole } from "@/types";
import { createCommentAction, deleteCommentAction, restoreCommentAction } from "@/app/actions/comment";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedText } from "@/components/common/FormattedText";
import { formatDate } from "@/lib/utils";

interface CommentSectionProps {
  postId: number;
  postAuthorId?: string | null;
  comments: Comment[];
  currentUserId?: string | null;
  currentUserRole?: UserRole | null;
  currentUserProfile?: Profile | null;
}

interface ReplyTarget {
  commentId: number;
  authorName: string;
}

export function CommentSection({
  postId,
  postAuthorId,
  comments: initialComments,
  currentUserId,
  currentUserRole,
  currentUserProfile,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleReplyClick = (targetComment: Comment) => {
    const authorName = targetComment.author?.username || "익명";
    setReplyTo({
      commentId: targetComment.id,
      authorName,
    });

    if (!content.startsWith(`@${authorName}`)) {
      setContent(`@${authorName} `);
    }
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    if (replyTo && content.startsWith(`@${replyTo.authorName}`)) {
      setContent(content.replace(`@${replyTo.authorName} `, "").trim());
    }
  };

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
    setReplyTo(null);
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

      {/* New Comment Input & Reply Banner */}
      {currentUserId ? (
        <form onSubmit={handleCreateComment} className="space-y-2">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Reply Banner */}
          {replyTo && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-600 dark:text-blue-400 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-1.5 font-semibold truncate">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">@{replyTo.authorName}님에게 답글 작성 중</span>
              </div>
              <button
                type="button"
                onClick={handleCancelReply}
                className="hover:text-red-500 transition-colors p-1 shrink-0 cursor-pointer"
                aria-label="답글 작성 취소"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={replyTo ? `@${replyTo.authorName}님에게 답글을 입력하세요...` : "따뜻한 댓글을 남겨보세요..."}
              maxLength={1000}
              aria-label="댓글 입력창"
              className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            <Button
              type="submit"
              disabled={!content.trim()}
              aria-label="댓글 등록"
              className="h-11 px-4 gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
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

      {/* Comment List with 2-Depth Indentation */}
      <div className="space-y-3">
        {visibleComments.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center">
            가장 먼저 첫 댓글을 남겨보세요!
          </p>
        ) : (
          visibleComments.map((comment) => {
            const isAuthor = comment.author_id === currentUserId;
            const isPostAuthor = Boolean(postAuthorId && comment.author_id === postAuthorId);
            const isDeleted = Boolean(comment.deleted_at);
            const isReply = comment.content.startsWith("@") || comment.content.startsWith("ㄴ") || comment.content.startsWith("↳");

            return (
              <div
                key={comment.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isReply
                    ? "ml-5 sm:ml-8 border-l-4 border-l-blue-500/80 border-zinc-200 dark:border-zinc-800/80 bg-blue-50/30 dark:bg-blue-950/20 shadow-none"
                    : isDeleted
                    ? "border-red-900/30 bg-red-950/10 opacity-70"
                    : "border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/60 shadow-sm dark:shadow-none"
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isReply && (
                      <span className="text-blue-500 flex items-center -mr-0.5">
                        <CornerDownRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <Avatar
                      src={comment.author?.avatar_url}
                      fallbackText={comment.author?.username || "익명"}
                      size="sm"
                      className="h-6 w-6"
                    />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      {comment.author?.username || "익명"}
                    </span>
                    {isPostAuthor && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 select-none shadow-xs">
                        작성자
                      </span>
                    )}
                    {comment.author?.role === "ADMIN" && (
                      <Badge variant="admin" className="text-[10px] px-1.5 py-0">
                        관리자
                      </Badge>
                    )}
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {formatDate(comment.created_at)}
                    </span>
                    {isDeleted && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        삭제됨
                      </Badge>
                    )}
                  </div>

                  {/* Actions: Reply & Delete & Restore */}
                  <div className="flex items-center gap-1.5">
                    {!isDeleted && currentUserId && (
                      <button
                        type="button"
                        onClick={() => handleReplyClick(comment)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        aria-label={`${comment.author?.username || "익명"}님에게 답글 달기`}
                      >
                        <CornerDownRight className="h-3 w-3" />
                        <span>답글</span>
                      </button>
                    )}

                    {!isDeleted && (isAuthor || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                        aria-label="댓글 삭제"
                        title="댓글 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isDeleted && isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRestore(comment.id)}
                        className="p-1 rounded text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        aria-label="댓글 복구"
                        title="댓글 복구"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed ${isReply ? "pl-5" : "pl-8"}`}>
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
