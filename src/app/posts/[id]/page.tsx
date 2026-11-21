import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { recordPostViewDirect } from "@/app/actions/post";
import { hashClientFingerprint } from "@/lib/ssrfGuard";
import { PostDetailView } from "@/components/gallery/PostDetailView";
import { Post, Comment } from "@/types";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

const getPostById = cache(async (postId: number) => {
  const supabase = await createClient();
  return supabase
    .from("posts")
    .select("*, author:profiles(*)")
    .eq("id", postId)
    .single();
});

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);
  if (Number.isNaN(postId)) {
    return { title: "게시글" };
  }

  const { data: post, error } = await getPostById(postId);
  const typedPost = post as unknown as Post | null;

  if (error || !typedPost || typedPost.deleted_at) {
    return { title: "게시글을 찾을 수 없습니다" };
  }

  return {
    title: typedPost.title,
    description: "묵호 커뮤니티 사이트",
    openGraph: {
      title: `${typedPost.title} - 묵호 갤러리`,
      description: "묵호 커뮤니티 사이트",
      images:
        Array.isArray(typedPost.image_urls) && typedPost.image_urls.length > 0
          ? [typedPost.image_urls[0]]
          : undefined,
    },
  };
}

export default async function PostDetailPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);

  if (Number.isNaN(postId)) {
    notFound();
  }

  const supabase = await createClient();

  // Parallelize auth, post details, comments, and request headers in 1 step
  const [userProfile, user, { data: post, error }, { data: comments }, headersList] =
    await Promise.all([
      getAuthProfile(),
      getAuthUser(),
      getPostById(postId),
      supabase
        .from("comments")
        .select("*, author:profiles(*)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true }),
      headers(),
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

  // Compute client fingerprint before after() (headers() cannot be called inside after() in Server Components)
  const forwardedFor = headersList.get("x-forwarded-for");
  const clientIp = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : headersList.get("x-real-ip") || "127.0.0.1";
  const userAgent = headersList.get("user-agent") || "";
  const ipHash = hashClientFingerprint(
    clientIp,
    userAgent,
    new Date().toISOString().slice(0, 10)
  );
  const viewerUserId = user?.id || null;

  after(() => recordPostViewDirect(postId, ipHash, viewerUserId));

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
