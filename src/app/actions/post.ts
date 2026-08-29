"use server";

import { z } from "zod";
import crypto from "crypto";
import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ratelimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { Post, Comment } from "@/types";

const postSchema = z.object({
  title: z
    .string()
    .min(2, "제목은 최소 2자 이상이어야 합니다.")
    .max(200, "제목은 최대 200자까지 가능합니다."),
  content: z.string().min(1, "내용을 입력해주세요."),
  image_urls: z.array(z.string().url()).optional().default([]),
});

export interface PostFormState {
  error?: string | null;
  success?: boolean;
  postId?: number;
}

export async function createPostAction(
  prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const clientIp = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : headersList.get("x-real-ip") || "127.0.0.1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  // Rate Limiting (Max 5 posts per minute per user)
  const rateLimitResult = await checkRateLimit(`post_create:${user.id}`, 5, 60);
  if (!rateLimitResult.success) {
    return { error: "게시글 작성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." };
  }

  // Cloudflare Turnstile Verification
  const turnstileToken = formData.get("turnstile_token") as string | null;
  const isTurnstileValid = await verifyTurnstileToken(turnstileToken, clientIp);
  if (!isTurnstileValid) {
    return { error: "보안 검증(Turnstile)에 실패했습니다. 새로고침 후 다시 시도해주세요." };
  }

  const title = (formData.get("title") as string) || "";
  const content = (formData.get("content") as string) || "";
  const imageUrlsRaw = (formData.get("image_urls") as string) || "[]";

  let imageUrls: string[] = [];
  try {
    imageUrls = JSON.parse(imageUrlsRaw);
  } catch {
    imageUrls = [];
  }

  const validated = postSchema.safeParse({
    title,
    content,
    image_urls: imageUrls,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력 정보가 올바르지 않습니다." };
  }

  const isNoticeRaw = formData.get("is_notice") === "true" || formData.get("is_notice") === "on";
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = (userProfile as { role?: string } | null)?.role === "ADMIN";
  const isNotice = isAdmin ? isNoticeRaw : false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newPost, error } = await (supabase.from("posts") as any)
    .insert({
      author_id: user.id,
      title,
      content,
      image_urls: imageUrls,
      is_notice: isNotice,
      like_count: 0,
    })
    .select()
    .single();

  if (error || !newPost) {
    // Safety fallback using admin client
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fallbackPost, error: adminErr } = await (adminClient.from("posts") as any)
      .insert({
        author_id: user.id,
        title,
        content,
        image_urls: imageUrls,
        is_notice: isNotice,
        like_count: 0,
      })
      .select()
      .single();

    if (adminErr || !fallbackPost) {
      return { error: `게시글 등록 실패: ${adminErr?.message || error?.message}` };
    }

    await recordAuditLog({
      actorId: user.id,
      action: "POST_CREATE",
      targetType: "posts",
      targetId: String(fallbackPost.id),
      metadata: { title, imageCount: imageUrls.length, isNotice },
    });

    revalidatePath("/");
    redirect(`/posts/${fallbackPost.id}`);
  }

  await recordAuditLog({
    actorId: user.id,
    action: "POST_CREATE",
    targetType: "posts",
    targetId: String(newPost.id),
    metadata: { title, imageCount: imageUrls.length },
  });

  revalidatePath("/");
  redirect(`/posts/${newPost.id}`);
}

export async function updatePostAction(
  prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const postId = Number(formData.get("post_id"));
  const title = (formData.get("title") as string) || "";
  const content = (formData.get("content") as string) || "";
  const imageUrlsRaw = (formData.get("image_urls") as string) || "[]";

  let imageUrls: string[] = [];
  try {
    imageUrls = JSON.parse(imageUrlsRaw);
  } catch {
    imageUrls = [];
  }

  const validated = postSchema.safeParse({
    title,
    content,
    image_urls: imageUrls,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력 정보가 올바르지 않습니다." };
  }

  const adminClient = createAdminClient();

  // Check post ownership or admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error: fetchErr } = await (adminClient.from("posts") as any)
    .select("*, author:profiles(*)")
    .eq("id", postId)
    .maybeSingle();

  if (fetchErr || !post) {
    return { error: "게시글을 찾을 수 없습니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = (profile as { role?: string } | null)?.role === "ADMIN";
  if ((post as unknown as Post).author_id !== user.id && !isAdmin) {
    return { error: "게시글 수정 권한이 없습니다. (작성자 본인만 수정 가능)" };
  }

  const isNoticeRaw = formData.get("is_notice") === "true" || formData.get("is_notice") === "on";
  const isNoticeToUpdate = isAdmin ? isNoticeRaw : Boolean((post as unknown as Post).is_notice);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("posts") as any)
    .update({
      title,
      content,
      image_urls: imageUrls,
      is_notice: isNoticeToUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from("posts") as any)
      .update({
        title,
        content,
        image_urls: imageUrls,
        is_notice: isNoticeToUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
  }

  await recordAuditLog({
    actorId: user.id,
    action: "POST_UPDATE",
    targetType: "posts",
    targetId: String(postId),
    metadata: {
      title,
      imageCount: imageUrls.length,
      isNotice: isNoticeToUpdate,
    },
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/");
  redirect(`/posts/${postId}`);
}

export async function recommendPostAction(
  postId: number
): Promise<{ success: boolean; error?: string; newLikeCount?: number }> {
  try {
    const cookieStore = await cookies();
    const cookieKey = `recommended_post_${postId}`;

    if (cookieStore.get(cookieKey)) {
      return { success: false, error: "이미 추천한 게시글입니다." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Rate Limiting on recommendations
    const idKey = user ? user.id : "anon";
    const rateLimitRes = await checkRateLimit(`post_recommend:${idKey}`, 20, 60);
    if (!rateLimitRes.success) {
      return { success: false, error: "추천 요청이 너무 빠릅니다." };
    }

    // Call increment_post_like RPC if available
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : headersList.get("x-real-ip") || "127.0.0.1";

    const userAgent = headersList.get("user-agent") || "";
    const ipHash = crypto
      .createHash("sha256")
      .update(`${clientIp}-${userAgent}`)
      .digest("hex");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("increment_post_like", {
      p_post_id: postId,
      p_ip_hash: ipHash,
      p_user_id: user?.id || null,
    });

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
      revalidatePath("/");
      return { success: true, newLikeCount: parsed.new_like_count };
    }

    // Direct fallback logic
    const adminClient = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawPost } = await (adminClient.from("posts") as any)
      .select("like_count, author_id")
      .eq("id", postId)
      .single();

    const post = rawPost as { like_count?: number; author_id?: string | null } | null;

    if (!post) {
      return { success: false, error: "게시글을 찾을 수 없습니다." };
    }

    if (user && post.author_id === user.id) {
      return { success: false, error: "본인이 작성한 글은 추천할 수 없습니다." };
    }

    const currentLikes = post.like_count || 0;
    const nextLikes = currentLikes + 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient.from("posts") as any)
      .update({ like_count: nextLikes })
      .eq("id", postId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Set cookie to prevent duplicate recommendations (expires in 30 days)
    cookieStore.set(cookieKey, "true", {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
    });

    revalidatePath(`/posts/${postId}`);
    revalidatePath("/");
    return { success: true, newLikeCount: nextLikes };
  } catch (err: any) {
    return { success: false, error: err.message || "추천 처리 중 오류가 발생했습니다." };
  }
}

export async function deletePostAction(postId: number): Promise<{ success: boolean; error?: string }> {
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

  // 1. Fetch post to verify existence and ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post, error: fetchErr } = await (adminClient.from("posts") as any)
    .select("id, author_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (fetchErr || !post) {
    return { success: false, error: "게시글을 찾을 수 없습니다." };
  }

  // 2. Permission check: Author or Admin
  if (post.author_id !== user.id && !isAdmin) {
    return { success: false, error: "본인이 작성한 게시글만 삭제할 수 있습니다." };
  }

  // 3. Soft Delete: set deleted_at = NOW()
  const updateData = { deleted_at: new Date().toISOString() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error: updateErr } = await (supabase.from("posts") as any)
    .update(updateData)
    .eq("id", postId);

  if (updateErr) {
    // Fallback to adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retryRes = await (adminClient.from("posts") as any)
      .update(updateData)
      .eq("id", postId);
    updateErr = retryRes.error;
  }

  if (updateErr) {
    return { success: false, error: `게시글 삭제 실패: ${updateErr.message}` };
  }

  await recordAuditLog({
    actorId: user.id,
    action: "POST_DELETE",
    targetType: "posts",
    targetId: String(postId),
    metadata: { is_admin: isAdmin },
  });

  revalidatePath("/");
  return { success: true };
}

export async function restorePostAction(postId: number): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: "관리자만 복구할 수 있습니다." };
  }

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient.from("posts") as any)
    .update({ deleted_at: null })
    .eq("id", postId);

  if (error) {
    return { success: false, error: error.message };
  }

  await recordAuditLog({
    actorId: user.id,
    action: "POST_RESTORE",
    targetType: "posts",
    targetId: String(postId),
  });

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
  return { success: true };
}

export async function incrementViewCount(postId: number): Promise<void> {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const clientIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : headersList.get("x-real-ip") || "127.0.0.1";

    const userAgent = headersList.get("user-agent") || "";
    const ipHash = crypto
      .createHash("sha256")
      .update(`${clientIp}-${userAgent}-${new Date().toISOString().slice(0, 10)}`)
      .digest("hex");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Call increment_post_view RPC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("increment_post_view", {
      p_post_id: postId,
      p_user_id: user?.id || null,
      p_ip_hash: ipHash,
    });

    if (error) {
      const adminClient = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).rpc("increment_post_view", {
        p_post_id: postId,
        p_user_id: user?.id || null,
        p_ip_hash: ipHash,
      });
    }
  } catch (err) {
    console.warn("[ViewCount] Exception incrementing post view:", err);
  }
}

export async function fetchUserActivityAction(): Promise<{ posts: Post[]; comments: Comment[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { posts: [], comments: [] };

  const [userPostsRes, userCommentsRes] = await Promise.all([
    supabase.from("posts").select("*").eq("author_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("comments").select("*").eq("author_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  return {
    posts: (userPostsRes.data || []) as Post[],
    comments: (userCommentsRes.data || []) as Comment[],
  };
}
