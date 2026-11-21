import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAuthCookie } from "@/lib/urlSafety";
import { Profile } from "@/types";

export interface AuthUserSummary {
  id: string;
  email?: string;
}

/**
 * Request-level memoized authenticated user getter using getClaims()
 * with an instant fast-path when no Supabase auth cookie is present.
 */
export const getAuthUser = cache(async (): Promise<AuthUserSummary | null> => {
  try {
    const cookieStore = await cookies();
    if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
      return null;
    }

    const supabase = await createClient();
    const { data: claimsData, error } = await supabase.auth.getClaims();
    if (error || typeof claimsData?.claims?.sub !== "string") {
      return null;
    }

    return {
      id: claimsData.claims.sub,
      email:
        typeof claimsData.claims.email === "string"
          ? claimsData.claims.email
          : undefined,
    };
  } catch {
    return null;
  }
});

/**
 * Request-level memoized profile getter.
 */
export const getAuthProfile = cache(async () => {
  try {
    const user = await getAuthUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return (profile as unknown as Profile) || null;
  } catch {
    return null;
  }
});
