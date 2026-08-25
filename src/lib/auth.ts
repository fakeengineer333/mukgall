import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types";

/**
 * Request-level memoized authenticated user getter.
 * Calling this multiple times within the same server render (e.g. layout.tsx and page.tsx)
 * will only perform a single network call to Supabase.
 */
export const getAuthUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user || null;
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
