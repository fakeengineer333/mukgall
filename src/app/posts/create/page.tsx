import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser, getAuthProfile } from "@/lib/auth";
import { PostCreateForm } from "@/components/gallery/PostCreateForm";

export const metadata: Metadata = {
  title: "글쓰기",
};

export default async function CreatePostPage() {
  const [user, userProfile] = await Promise.all([getAuthUser(), getAuthProfile()]);

  if (!user) {
    redirect("/login?redirectTo=/posts/create");
  }

  const isAdmin = userProfile?.role === "ADMIN";

  return (
    <div className="py-6">
      <PostCreateForm isAdmin={isAdmin} />
    </div>
  );
}
