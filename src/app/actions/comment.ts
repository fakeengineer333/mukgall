"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ratelimit";
import { hashClientFingerprint } from "@/lib/ssrfGuard";
import { POSTS_LIST_TAG } from "@/lib/publicQueries";

const commentSchema = z.object({
  content: z
    .string()
    .max(1000, "댓글은 최대 1,000자까지 작성 가능합니다."),
  image_url: z.string().nullable().optional(),
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

  const content = ((formData.get("content") as string) || "").trim();
  const imageUrlRaw = (formData.get("image_url") as string) || null;
  const imageUrl = imageUrlRaw && imageUrlRaw.trim() ? imageUrlRaw.trim() : null;

  if (!content && !imageUrl) {
    return { error: "댓글 내용이나 이미지를 입력해주세요." };
  }

  const validated = commentSchema.safeParse({ content, image_url: imageUrl });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력값이 올바르지 않습니다." };
  }

  const insertPayload = {
    post_id: postId,
    author_id: user.id,
    content,
    image_url: imageUrl,
    like_count: 0,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newComment, error } = await (supabase.from("comments") as any)
    .insert(insertPayload)
    .select()
    .single();

  if (error || !newComment) {
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fbComment, error: adminErr } = await (adminClient.from("comments") as any)
      .insert(insertPayload)
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
      metadata: { postId, contentPreview: content.slice(0, 50), hasImage: Boolean(imageUrl) },
    });

    updateTag(POSTS_LIST_TAG);
    revalidatePath(`/posts/${postId}`);
    return { success: true, error: null };
  }

  await recordAuditLog({
    actorId: user.id,
    action: "COMMENT_CREATE",
    targetType: "comments",
    targetId: String(newComment.id),
    metadata: { postId, contentPreview: content.slice(0, 50), hasImage: Boolean(imageUrl) },
  });

  updateTag(POSTS_LIST_TAG);
  revalidatePath(`/posts/${postId}`);
  return { success: true, error: null };
}

export async function recommendCommentAction(
  commentId: number,
  postId: number
): Promise<{ success: boolean; error?: string; newLikeCount?: number }> {
  try {
    const cookieStore = await cookies();
    const cookieKey = `recommended_comment_${commentId}`;

    if (cookieStore.get(cookieKey)) {
      return { success: false, error: "이미 추천한 댓글입니다." };
    }

    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : headersList.get("x-real-ip") || "127.0.0.1";
    const userAgent = headersList.get("user-agent") || "";
    const ipHash = hashClientFingerprint(clientIp, userAgent);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Rate limit: max 20 recommendations per minute per user or IP fingerprint
    const rateKey = user
      ? `recommend_comment:${user.id}`
      : `recommend_comment:ip:${ipHash}`;
    const rateLimit = await checkRateLimit(rateKey, 20, 60);
    if (!rateLimit.success) {
      return { success: false, error: "추천 요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." };
    }

    // Call increment_comment_like RPC if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
      "increment_comment_like",
      {
        p_comment_id: commentId,
        p_ip_hash: ipHash,
        p_user_id: user?.id || null,
      }
    );

    if (!rpcErr && rpcRes) {
      const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
      if (!parsed.success) {
        return { success: false, error: parsed.error || "추천할 수 없습니다." };
      }
      cookieStore.set(cookieKey, "true", {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        httpOnly: true,
      });
      revalidatePath(`/posts/${postId}`);
      return { success: true, newLikeCount: parsed.new_like_count };
    }

    if (rpcErr) {
      if (rpcErr.code === "23505") {
        return { success: false, error: "이미 추천한 댓글입니다." };
      }
      const msgLower = rpcErr.message?.toLowerCase() || "";
      const isMissingRpc =
        rpcErr.code === "42883" ||
        rpcErr.code === "PGRST202" ||
        msgLower.includes("could not find the function") ||
        msgLower.includes("does not exist");
      if (!isMissingRpc) {
        return { success: false, error: rpcErr.message || "추천 처리 중 오류가 발생했습니다." };
      }
    }

    const adminClient = createAdminClient();

    // Fallback when increment_comment_like RPC is not yet deployed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comment, error: fetchErr } = await (adminClient.from("comments") as any)
      .select("id, author_id, like_count, deleted_at")
      .eq("id", commentId)
      .maybeSingle();

    if (fetchErr || !comment || comment.deleted_at) {
      return { success: false, error: "댓글을 찾을 수 없습니다." };
    }

    if (user && comment.author_id === user.id) {
      return { success: false, error: "본인이 작성한 댓글은 추천할 수 없습니다." };
    }

    const currentLikes = comment.like_count || 0;
    const nextLikes = currentLikes + 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (adminClient.from("comments") as any)
      .update({ like_count: nextLikes })
      .eq("id", commentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Set cookie to prevent duplicate recommendation (expires in 30 days)
    cookieStore.set(cookieKey, "true", {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
    });

    revalidatePath(`/posts/${postId}`);
    return { success: true, newLikeCount: nextLikes };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "추천 처리 중 오류가 발생했습니다.";
    return { success: false, error: message };
  }
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
  const adminClient = createAdminClient();

  // 1. Fetch comment to verify existence and ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: comment, error: fetchErr } = await (adminClient.from("comments") as any)
    .select("id, author_id, deleted_at")
    .eq("id", commentId)
    .maybeSingle();

  if (fetchErr || !comment) {
    return { success: false, error: "댓글을 찾을 수 없습니다." };
  }

  // 2. Permission check: Author or Admin
  if (comment.author_id !== user.id && !isAdmin) {
    return { success: false, error: "본인이 작성한 댓글만 삭제할 수 있습니다." };
  }

  // 3. Soft Delete: set deleted_at = NOW()
  const updateData = { deleted_at: new Date().toISOString() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error: updateErr } = await (supabase.from("comments") as any)
    .update(updateData)
    .eq("id", commentId);

  if (updateErr) {
    // Fallback to adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retryRes = await (adminClient.from("comments") as any)
      .update(updateData)
      .eq("id", commentId);
    updateErr = retryRes.error;
  }

  if (updateErr) {
    return { success: false, error: `댓글 삭제 실패: ${updateErr.message}` };
  }

  await recordAuditLog({
    actorId: user.id,
    action: "COMMENT_DELETE",
    targetType: "comments",
    targetId: String(commentId),
    metadata: { postId, is_admin: isAdmin },
  });

  updateTag(POSTS_LIST_TAG);
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

  updateTag(POSTS_LIST_TAG);
  revalidatePath(`/posts/${postId}`);
  return { success: true };
}
