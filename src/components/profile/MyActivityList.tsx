import Link from "next/link";
import { Image as ImageIcon, MessageSquare, ArrowRight } from "lucide-react";
import { Post, Comment } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface MyActivityListProps {
  posts: Post[];
  comments: (Comment & { post?: Post | null })[];
}

export function MyActivityList({ posts, comments }: MyActivityListProps) {
  return (
    <div className="space-y-4">
      {/* My Posts */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-blue-500" />
              내가 올린 게시글 ({posts.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {posts.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">
              아직 작성한 게시글이 없습니다.
            </p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800/50 transition-colors"
              >
                <div className="space-y-0.5 max-w-[80%]">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                    {post.title}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {formatDate(post.created_at)} • 조회 {post.view_count}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* My Comments */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              내가 작성한 댓글 ({comments.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">
              아직 작성한 댓글이 없습니다.
            </p>
          ) : (
            comments.map((comment) => (
              <Link
                key={comment.id}
                href={`/posts/${comment.post_id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800/50 transition-colors"
              >
                <div className="space-y-0.5 max-w-[80%]">
                  <p className="text-xs text-zinc-800 dark:text-zinc-300 line-clamp-1">
                    {comment.content}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {formatDate(comment.created_at)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
