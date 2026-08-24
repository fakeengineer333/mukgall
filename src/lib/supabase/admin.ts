import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  // Validate if serviceRoleKey is an actual JWT and not a placeholder
  const isActualServiceRoleKey =
    Boolean(rawKey) &&
    !rawKey?.includes("placeholder") &&
    rawKey !== anonKey &&
    (rawKey?.split(".").length === 3);

  const keyToUse = isActualServiceRoleKey ? (rawKey as string) : anonKey;

  return createSupabaseClient<Database>(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
