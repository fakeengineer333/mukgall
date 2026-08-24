"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ratelimit";
import { Comment } from "@/types";

const commentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1000, "댓글은 최대 1,000자까지 작성 가능합니다."),
});

export interface CommentState {
  error?: string | null;
  success?: boolean;
}

export async function createCommentAction(
  postId: number,
  prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "댓글 작성을 위해 로그인이 필요합니다." };
  }

  // Rate Limiting: max 15 comments per minute
  const rateLimitResult = await checkRateLimit(`comment_create:${user.id}`, 15, 60);
  if (!rateLimitResult.success) {
    return { error: "댓글 작성 요청이 너무 많습니다. 잠시 후 다시 작성해주세요." };
  }

  const content = (formData.get("content") as string) || "";
  const validated = commentSchema.safeParse({ content });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력값이 올바르지 않습니다." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newComment, error } = await (supabase.from("comments") as any)
    .insert({
      post_id: postId,
      author_id: user.id,
      content,
    })
    .select()
    .single();

  if (error || !newComment) {
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fbComment, error: adminErr } = await (adminClient.from("comments") as any)
      .insert({
        post_id: postId,
        author_id: user.id,
        content,
      })
      .select()
      .single();

    if (adminErr || !fbComment) {
      return { error: `댓글 작성 실패: ${adminErr?.message || error?.message}` };
    }

    await recordAuditLog({
      actorId: user.id,
      action: "COMMENT_CREATE",
      targetType: "comments",
      targetId: String(fbComment.id),
      metadata: { postId, contentPreview: content.slice(0, 50) },
    });

    revalidatePath(`/posts/${postId}`);
    return { success: true, error: null };
  }

  await recordAuditLog({
    actorId: user.id,
    action: "COMMENT_CREATE",
    targetType: "comments",
    targetId: String(newComment.id),
    metadata: { postId, contentPreview: content.slice(0, 50) },
  });

  revalidatePath(`/posts/${postId}`);
  return { success: true, error: null };
}

export async function deleteCommentAction(
  commentId: number,
  postId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = (profile as { role?: string } | null)?.role === "ADMIN";

  // Soft Delete: set deleted_at = NOW()
  const updateData = { deleted_at: new Date().toISOString() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("comments") as any).update(updateData).eq("id", commentId);
  if (!isAdmin) {
    query = query.eq("author_id", user.id);
  }

  const { error } = await query;
  if (error) {
    if (isAdmin) {
      const adminClient = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from("comments") as any).update(updateData).eq("id", commentId);
    } else {
      return { success: false, error: "댓글 삭제 권한이 없거나 삭제에 실패했습니다." };
    }
  }

  await recordAuditLog({
    actorId: user.id,
    action: "COMMENT_DELETE",
    targetType: "comments",
    targetId: String(commentId),
    metadata: { postId, is_admin: isAdmin },
  });

  revalidatePath(`/posts/${postId}`);
  return { success: true };
}

export async function restoreCommentAction(
  commentId: number,
  postId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = (profile as { role?: string } | null)?.role === "ADMIN";
  if (!isAdmin) {
    return { success: false, error: "관리자만 댓글을 복구할 수 있습니다." };
  }

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient.from("comments") as any)
    .update({ deleted_at: null })
    .eq("id", commentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/posts/${postId}`);
  return { success: true };
}
