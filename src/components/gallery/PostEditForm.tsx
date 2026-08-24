"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, AlertCircle, Loader2, Save } from "lucide-react";
import { updatePostAction, PostFormState } from "@/app/actions/post";
import { ImageUploader } from "@/components/gallery/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Post } from "@/types";

interface PostEditFormProps {
  post: Post;
}

export function PostEditForm({ post }: PostEditFormProps) {
  const router = useRouter();
  const [imageUrls, setImageUrls] = useState<string[]>(post.image_urls || []);
  const initialState: PostFormState = { error: null };
  const [state, formAction, isPending] = useActionState(updatePostAction, initialState);

  return (
    <Card className="w-full max-w-2xl mx-auto border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-blue-500" />
          게시글 수정
        </CardTitle>
        <CardDescription className="text-zinc-500 dark:text-zinc-400">
          제목, 본문 내용 및 등록된 사진을 수정할 수 있습니다.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-5">
          {state?.error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="image_urls" value={JSON.stringify(imageUrls)} />

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              제목
            </label>
            <Input
              id="title"
              name="title"
              defaultValue={post.title}
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
              defaultValue={post.content}
              rows={5}
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
                수정 중...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                수정 내용 저장
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
