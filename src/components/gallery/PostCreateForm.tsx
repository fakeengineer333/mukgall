"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, AlertCircle, Loader2, Send } from "lucide-react";
import { createPostAction, PostFormState } from "@/app/actions/post";
import { ImageUploader } from "@/components/gallery/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const DRAFT_KEY_TITLE = "mukgall_draft_post_title";
const DRAFT_KEY_CONTENT = "mukgall_draft_post_content";

export function PostCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const initialState: PostFormState = { error: null };
  const [state, formAction, isPending] = useActionState(createPostAction, initialState);

  // Restore draft on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTitle = localStorage.getItem(DRAFT_KEY_TITLE);
      const savedContent = localStorage.getItem(DRAFT_KEY_CONTENT);
      if (savedTitle) setTitle(savedTitle);
      if (savedContent) setContent(savedContent);
    }
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem(DRAFT_KEY_TITLE, val);
      } else {
        localStorage.removeItem(DRAFT_KEY_TITLE);
      }
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem(DRAFT_KEY_CONTENT, val);
      } else {
        localStorage.removeItem(DRAFT_KEY_CONTENT);
      }
    }
  };

  // Clear drafts on successful submit
  const handleSubmit = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY_TITLE);
      localStorage.removeItem(DRAFT_KEY_CONTENT);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-blue-500" />
          사진 게시글 작성
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-zinc-400">
          멋진 사진과 이야기를 묵갤 커뮤니티에 공유해보세요. (작성 중인 내용은 자동 임시 저장됩니다)
        </CardDescription>
      </CardHeader>

      <form action={formAction} onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Hidden image URLs json string */}
          <input type="hidden" name="image_urls" value={JSON.stringify(imageUrls)} />

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              제목
            </label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="게시글의 제목을 입력하세요"
              required
              maxLength={200}
              disabled={isPending}
            />
          </div>

          {/* Image Uploader */}
          <ImageUploader
            imageUrls={imageUrls}
            onChange={setImageUrls}
            disabled={isPending}
          />

          {/* Content */}
          <div className="space-y-1.5">
            <label htmlFor="content" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              본문 내용
            </label>
            <textarea
              id="content"
              name="content"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              rows={6}
              placeholder="내용을 자유롭게 작성해보세요..."
              required
              disabled={isPending}
              className="flex w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-900 dark:text-zinc-100 resize-none transition-colors"
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={isPending}
          >
            취소
          </Button>

          <Button
            type="submit"
            className="gap-2 font-bold shadow-lg shadow-blue-600/30"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                게시 중...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                게시글 올리기
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
