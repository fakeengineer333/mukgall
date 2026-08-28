import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { incrementViewCount } from "@/app/actions/post";
import { PostDetailView } from "@/components/gallery/PostDetailView";
import { Post, Comment } from "@/types";

interface PostPageProps {
  params: Promise<{ id: string }>;
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
