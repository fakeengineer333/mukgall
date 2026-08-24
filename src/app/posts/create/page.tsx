import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCreateForm } from "@/components/gallery/PostCreateForm";

export default async function CreatePostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/posts/create");
  }

  return (
    <div className="py-6">
      <PostCreateForm />
    </div>
  );
}
