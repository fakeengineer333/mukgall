import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { incrementViewCount } from "@/app/actions/post";
import { PostDetailView } from "@/components/gallery/PostDetailView";
import { Post, Comment, Profile } from "@/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch current user's profile for role
  let userProfile: Profile | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    userProfile = profile as unknown as Profile;
  }

  const isAdmin = userProfile?.role === "ADMIN";

  // Fetch post details
  const { data: post, error } = await supabase
    .from("posts")
    .select("*, author:profiles(*)")
    .eq("id", postId)
    .single();

  if (error || !post) {
    notFound();
  }

  const typedPost = post as unknown as Post;

  // If deleted and not admin, return notFound
  if (typedPost.deleted_at && !isAdmin) {
    notFound();
  }

  // Increment view count (1 per day per IP/user)
  await incrementViewCount(postId);

  // Fetch comments
  const { data: comments } = await supabase
    .from("comments")
    .select("*, author:profiles(*)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const typedComments = (comments || []) as unknown as Comment[];

  return (
    <div className="py-4">
      <PostDetailView
        post={typedPost}
        comments={typedComments}
        currentUserId={user?.id || null}
        currentUserRole={userProfile?.role || null}
      />
    </div>
  );
}
