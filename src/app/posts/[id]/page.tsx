import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { incrementViewCount } from "@/app/actions/post";
import { PostDetailView } from "@/components/gallery/PostDetailView";
import { Post, Comment } from "@/types";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);
  if (isNaN(postId)) {
    return { title: "게시글" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (supabase.from("posts") as any)
    .select("title, content, image_urls")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!post) {
    return { title: "게시글을 찾을 수 없습니다" };
  }

  return {
    title: post.title,
    description: post.content ? post.content.slice(0, 100) : "묵호 커뮤니티 사이트",
    openGraph: {
      title: `${post.title} - 묵호 갤러리`,
      description: post.content ? post.content.slice(0, 100) : "묵호 커뮤니티 사이트",
      images: Array.isArray(post.image_urls) && post.image_urls.length > 0 ? [post.image_urls[0]] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);

  if (isNaN(postId)) {
    notFound();
  }

  const supabase = await createClient();

  // Parallelize auth, post details, and comments queries in 1 step
  const [userProfile, user, { data: post, error }, { data: comments }] = await Promise.all([
    getAuthProfile(),
    getAuthUser(),
    supabase.from("posts").select("*, author:profiles(*)").eq("id", postId).single(),
    supabase.from("comments").select("*, author:profiles(*)").eq("post_id", postId).order("created_at", { ascending: true }),
  ]);

  if (error || !post) {
    notFound();
  }

  const typedPost = post as unknown as Post;
  const isAdmin = userProfile?.role === "ADMIN";

  // If deleted and not admin, return notFound
  if (typedPost.deleted_at && !isAdmin) {
    notFound();
  }

  // Non-blocking view count increment
  incrementViewCount(postId).catch(() => {});

  const typedComments = (comments || []) as unknown as Comment[];

  return (
    <div className="py-4">
      <PostDetailView
        post={typedPost}
        comments={typedComments}
        currentUserId={user?.id || null}
        currentUserRole={userProfile?.role || null}
        currentUserProfile={userProfile || null}
      />
    </div>
  );
}
