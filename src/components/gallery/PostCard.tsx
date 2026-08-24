import Link from "next/link";
import Image from "next/image";
import { Eye, MessageSquare, Layers, Trash2 } from "lucide-react";
import { Post } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PostCardProps {
  post: Post;
  isAdmin?: boolean;
}

export function PostCard({ post, isAdmin }: PostCardProps) {
  const coverImage = post.image_urls?.[0] || "/icons/icon-512.svg";
  const imageCount = post.image_urls?.length || 0;
  const isDeleted = Boolean(post.deleted_at);

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-md hover:border-zinc-700 hover:shadow-xl transition-all duration-300 active:scale-[0.99]"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
        <Image
          src={coverImage}
          alt={post.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
            isDeleted ? "opacity-40 grayscale" : ""
          }`}
        />

        {/* Multi-image indicator badge */}
        {imageCount > 1 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <Layers className="h-3 w-3" />
            <span>{imageCount}</span>
          </div>
        )}

        {/* Deleted status badge for admin */}
        {isDeleted && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-red-600/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
            <Trash2 className="h-3 w-3" />
            <span>삭제됨</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-100 group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>

        {/* Author & Meta Row */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Avatar
              src={post.author?.avatar_url}
              fallbackText={post.author?.username || "익명"}
              size="sm"
              className="h-5 w-5"
            />
            <span className="font-medium text-zinc-300 truncate max-w-[90px]">
              {post.author?.username || "익명"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {post.comments_count || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
