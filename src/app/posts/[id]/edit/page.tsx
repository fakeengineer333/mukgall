import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostEditForm } from "@/components/gallery/PostEditForm";
import { Post, Profile } from "@/types";

interface PostEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostEditPage({ params }: PostEditPageProps) {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);

  if (isNaN(postId)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/posts/${postId}/edit`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = (profile as { role?: string } | null)?.role === "ADMIN";

  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error || !post) {
    notFound();
  }

  const typedPost = post as unknown as Post;

  if (typedPost.author_id !== user.id && !isAdmin) {
    redirect(`/posts/${postId}`);
  }

  return (
    <div className="py-6">
      <PostEditForm post={typedPost} />
    </div>
  );
}
