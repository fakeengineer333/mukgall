import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { PostCreateForm } from "@/components/gallery/PostCreateForm";

export default async function CreatePostPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login?redirectTo=/posts/create");
  }

  return (
    <div className="py-6">
      <PostCreateForm />
    </div>
  );
}
