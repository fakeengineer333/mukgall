import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { MyActivityList } from "@/components/profile/MyActivityList";
import { Profile, Post, Comment } from "@/types";

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/mypage");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If profile not yet created, build a fallback
  const userProfile: Profile = (profile as unknown as Profile) || {
    id: user.id,
    username: user.email?.split("@")[0] || "User",
    role: "USER",
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Fetch user's posts
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch user's comments
  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const typedPosts = (posts || []) as Post[];
  const typedComments = (comments || []) as Comment[];

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-black text-white">마이페이지</h1>
      
      <ProfileCard
        profile={userProfile}
        postsCount={typedPosts.length}
        commentsCount={typedComments.length}
      />

      <MyActivityList posts={typedPosts} comments={typedComments} />
    </div>
  );
}
