"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare,
  Send,
  Trash2,
  RotateCcw,
  AlertCircle,
  CornerDownRight,
  X,
  ThumbsUp,
  Crown,
  ImagePlus,
  ZoomIn,
  Loader2,
} from "lucide-react";
import { Comment, Profile, UserRole } from "@/types";
import {
  createCommentAction,
  deleteCommentAction,
  restoreCommentAction,
  recommendCommentAction,
} from "@/app/actions/comment";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedText } from "@/components/common/FormattedText";
import { ImageViewerModal } from "@/components/common/ImageViewerModal";
import { UserActionMenu } from "@/components/common/UserActionMenu";
import { uploadImageToStorage } from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Image selection with automatic WebP compression (saving DB & storage bandwidth)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있습니다.");
      return;
    }

    try {
      setIsCompressing(true);
      setError(null);
      const { file: compressed, previewUrl } = await compressImage(file, 800, 800, 0.8);
      setSelectedImageFile(compressed);
      setImagePreviewUrl(previewUrl);
    } catch {
      setError("이미지 압축 처리 중 오류가 발생했습니다.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const commentText = content.trim();
    if ((!commentText && !selectedImageFile) || !currentUserId) return;

    setError(null);
    setIsSubmitting(true);

    let uploadedImageUrl: string | null = null;
    if (selectedImageFile) {
      const fileName = `comments/${postId}/${Date.now()}-${selectedImageFile.name}`;
      const { url, error: uploadErr } = await uploadImageToStorage("gallery-images", fileName, selectedImageFile);
      if (uploadErr || !url) {
        setIsSubmitting(false);
        setError(`이미지 업로드 실패: ${uploadErr || "알 수 없는 오류"}`);
        return;
      }
      uploadedImageUrl = url;
    }

    // 1. Optimistic UI: Immediately create temporary comment
    const tempId = -Date.now();
    const optimisticComment: Comment = {
      id: tempId,
      post_id: postId,
      author_id: currentUserId,
      content: commentText,
      image_url: uploadedImageUrl,
      like_count: 0,
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
    handleRemoveImage();
    setReplyTo(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
    }

    const formData = new FormData();
    formData.append("content", commentText);
    if (uploadedImageUrl) {
      formData.append("image_url", uploadedImageUrl);
    }

    // 2. Background Server Action
    startTransition(async () => {
      const res = await createCommentAction(postId, { error: null }, formData);
      setIsSubmitting(false);
      if (res.error) {
        // Rollback on error
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setContent(commentText);
        setError(res.error);
      }
    });
  };

  const handleRecommend = (commentId: number) => {
    const prevComments = [...comments];
    // Optimistic UI: increment like count
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, like_count: (c.like_count || 0) + 1 } : c))
    );

    startTransition(async () => {
      const res = await recommendCommentAction(commentId, postId);
      if (res.error) {
        // Rollback on error
        setComments(prevComments);
        alert(res.error);
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

  // Best Comments (추천 3개 이상, 내림차순 최대 3개)
  const bestComments = visibleComments
    .filter((c) => !c.deleted_at && (c.like_count || 0) >= 3)
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    .slice(0, 3);

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

          {/* Attached Image Preview (Compressed) */}
          {imagePreviewUrl && (
            <div className="relative inline-flex items-center gap-2.5 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-950">
                <Image src={imagePreviewUrl} alt="Attached Preview" fill className="object-cover" />
              </div>
              <div className="pr-2 space-y-0.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 block truncate max-w-[160px]">
                  {selectedImageFile?.name || "첨부 이미지"}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  ✓ 초경량 압축 완료 ({Math.round((selectedImageFile?.size || 0) / 1024)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-zinc-800 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                title="이미지 제거"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            {/* Hidden File Input for Image */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* Attach Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing || isSubmitting}
              className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              title="댓글 이미지/짤 첨부 (자동 압축)"
            >
              {isCompressing ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={
                replyTo
                  ? `@${replyTo.authorName}님에게 답글을 입력하세요...`
                  : "따뜻한 댓글을 남겨보세요... (짤 첨부 가능)"
              }
              maxLength={1000}
              aria-label="댓글 입력창"
              className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-xs"
            />
            <Button
              type="submit"
              disabled={(!content.trim() && !selectedImageFile) || isCompressing || isSubmitting}
              aria-label="댓글 등록"
              className="h-11 px-4 gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">등록</span>
                </>
              )}
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

      {/* Best Comments Banner (추천 3개 이상) */}
      {bestComments.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent space-y-3 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
            <Crown className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span>👑 베스트 댓글</span>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              (추천 3개 이상)
            </span>
          </div>

          <div className="space-y-2">
            {bestComments.map((best) => (
              <div
                key={`best-${best.id}`}
                className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-500/30 space-y-1.5 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserActionMenu
                      userId={best.author_id}
                      username={best.author?.username}
                      avatarUrl={best.author?.avatar_url}
                      userRole={best.author?.role}
                      bio={best.author?.bio}
                      currentUserId={currentUserId}
                    >
                      <div className="flex items-center gap-1.5 group/buser hover:opacity-85 transition-opacity">
                        <Avatar
                          src={best.author?.avatar_url}
                          fallbackText={best.author?.username || "익명"}
                          size="sm"
                          className="h-5 w-5"
                        />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover/buser:underline group-hover/buser:text-blue-600 dark:group-hover/buser:text-blue-400">
                          {best.author?.username || "익명"}
                        </span>
                      </div>
                    </UserActionMenu>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                      <ThumbsUp className="h-2.5 w-2.5 fill-current" />
                      {best.like_count}
                    </span>
                  </div>
                </div>

                {best.content && (
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed pl-7">
                    {best.content}
                  </p>
                )}

                {best.image_url && (
                  <div
                    className="ml-7 mt-1.5 relative h-20 w-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950 cursor-zoom-in"
                    onClick={() => setViewerImageUrl(best.image_url!)}
                  >
                    <Image src={best.image_url} alt="베댓 짤" fill className="object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
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
            const isReply =
              comment.content.startsWith("@") ||
              comment.content.startsWith("ㄴ") ||
              comment.content.startsWith("↳");
            const isBest = (comment.like_count || 0) >= 3;

            return (
              <div
                key={comment.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isBest && !isDeleted
                    ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs"
                    : isReply
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
                    <UserActionMenu
                      userId={comment.author_id}
                      username={comment.author?.username}
                      avatarUrl={comment.author?.avatar_url}
                      userRole={comment.author?.role}
                      bio={comment.author?.bio}
                      currentUserId={currentUserId}
                    >
                      <div className="flex items-center gap-1.5 group/cuser hover:opacity-85 transition-opacity">
                        <Avatar
                          src={comment.author?.avatar_url}
                          fallbackText={comment.author?.username || "익명"}
                          size="sm"
                          className="h-6 w-6"
                        />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 group-hover/cuser:underline group-hover/cuser:text-blue-600 dark:group-hover/cuser:text-blue-400">
                          {comment.author?.username || "익명"}
                        </span>
                      </div>
                    </UserActionMenu>
                    {isBest && !isDeleted && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400 select-none shadow-xs">
                        <Crown className="h-3 w-3 fill-amber-500" />
                        베댓
                      </span>
                    )}
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

                  {/* Actions: Recommend & Reply & Delete & Restore */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* Upvote Button */}
                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => handleRecommend(comment.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isBest
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:bg-amber-500/25"
                            : comment.like_count && comment.like_count > 0
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                            : "text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                        }`}
                        title="댓글 추천"
                      >
                        <ThumbsUp
                          className={`h-3.5 w-3.5 ${
                            comment.like_count && comment.like_count > 0 ? "fill-current" : ""
                          }`}
                        />
                        <span>{comment.like_count || 0}</span>
                      </button>
                    )}

                    {!isDeleted && currentUserId && (
                      <button
                        type="button"
                        onClick={() => handleReplyClick(comment)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        aria-label={`${comment.author?.username || "익명"}님에게 답글 달기`}
                      >
                        <CornerDownRight className="h-3 w-3" />
                        <span className="hidden sm:inline">답글</span>
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

                {/* Comment Content */}
                {comment.content && (
                  <div
                    className={`text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed ${
                      isReply ? "pl-5" : "pl-8"
                    }`}
                  >
                    <FormattedText
                      content={comment.content}
                      bubbleStyle="comment"
                      compactPreview={true}
                    />
                  </div>
                )}

                {/* Comment Attached Image Thumbnail */}
                {comment.image_url && !isDeleted && (
                  <div className={isReply ? "pl-5" : "pl-8"}>
                    <div
                      className="group/cimg relative max-w-[200px] sm:max-w-[240px] aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 cursor-zoom-in shadow-xs"
                      onClick={() => setViewerImageUrl(comment.image_url!)}
                    >
                      <Image
                        src={comment.image_url}
                        alt="댓글 첨부 이미지"
                        fill
                        sizes="240px"
                        className="object-cover group-hover/cimg:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/cimg:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/80 text-white text-[11px] font-bold shadow-lg backdrop-blur-md">
                          <ZoomIn className="h-3 w-3" /> 크게 보기
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox for Comment Images */}
      {viewerImageUrl && (
        <ImageViewerModal
          isOpen={Boolean(viewerImageUrl)}
          onClose={() => setViewerImageUrl(null)}
          images={[viewerImageUrl]}
          title="댓글 이미지"
        />
      )}
    </div>
  );
}
