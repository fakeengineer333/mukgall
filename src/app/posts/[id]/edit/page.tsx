import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { PostEditForm } from "@/components/gallery/PostEditForm";
import { Post } from "@/types";

export const metadata: Metadata = {
  title: "글 수정",
};

interface PostEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostEditPage({ params }: PostEditPageProps) {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.id);

  if (isNaN(postId)) {
    notFound();
  }

  const [supabase, user, userProfile] = await Promise.all([
    createClient(),
    getAuthUser(),
    getAuthProfile(),
  ]);

  if (!user) {
    redirect(`/login?redirectTo=/posts/${postId}/edit`);
  }

  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error || !post) {
    notFound();
  }

  const typedPost = post as unknown as Post;
  const isAdmin = userProfile?.role === "ADMIN";

  if (typedPost.author_id !== user.id && !isAdmin) {
    redirect(`/posts/${postId}`);
  }

  return (
    <div className="py-6">
      <PostEditForm post={typedPost} isAdmin={isAdmin} />
    </div>
  );
}
