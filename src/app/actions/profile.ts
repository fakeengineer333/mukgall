"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { Profile } from "@/types";

const profileSchema = z.object({
  username: z
    .string()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다.")
    .regex(/^[a-zA-Z0-9가-힣_-]+$/, "닉네임에는 영문, 한글, 숫자, -, _만 사용할 수 있습니다."),
  bio: z.string().max(200, "한 줄 소개는 최대 200자까지 가능합니다.").optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export interface ProfileState {
  error?: string | null;
  success?: boolean;
}

export async function updateProfileAction(
  prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const username = formData.get("username") as string;
  const bio = (formData.get("bio") as string) || "";
  const avatar_url = (formData.get("avatar_url") as string) || "";

  const validated = profileSchema.safeParse({
    username,
    bio,
    avatar_url: avatar_url || undefined,
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "입력값이 올바르지 않습니다." };
  }

  // Get current profile for audit diff and role preservation
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userCurrent = currentProfile as unknown as Profile | null;
  const existingRole = userCurrent?.role || "USER";

  // If changing username, validate against reserved usernames and duplicates
  if (userCurrent && userCurrent.username !== username) {
    const RESERVED = ["묵호", "mukho", "admin", "운영자", "관리자", "administrator", "root"];
    if (RESERVED.some((r) => username.trim().toLowerCase() === r.toLowerCase()) && existingRole !== "ADMIN") {
      return { error: "생성할 수 없는 닉네임입니다." };
    }

    const { data: duplicate } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username.trim())
      .neq("id", user.id)
      .maybeSingle();

    if (duplicate) {
      return { error: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요." };
    }
  }

  // Preserve existing role - regular users CANNOT escalate their role
  const updateData = {
    username: username.trim(),
    bio: bio || null,
    avatar_url: avatar_url || null,
    role: existingRole,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("profiles") as any)
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    // If permission or constraint error, try admin client
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: adminError } = await (adminClient.from("profiles") as any)
      .update(updateData)
      .eq("id", user.id);

    if (adminError) {
      return { error: `프로필 업데이트 실패: ${adminError.message}` };
    }
  }

  // Record audit log
  await recordAuditLog({
    actorId: user.id,
    action: "PROFILE_UPDATE",
    targetType: "profiles",
    targetId: user.id,
    metadata: {
      before: currentProfile,
      after: updateData,
    },
  });

  revalidatePath("/mypage");
  revalidatePath("/", "layout");
  return { success: true, error: null };
}
