import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditAction, Json } from "@/types";

interface RecordAuditLogParams {
  actorId?: string | null;
  action: AuditAction | string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | Json;
}

export async function recordAuditLog({
  actorId = null,
  action,
  targetType,
  targetId,
  metadata = {},
}: RecordAuditLogParams): Promise<void> {
  try {
    const headersList = await headers();
    
    // Extract Client IP (X-Forwarded-For or X-Real-IP)
    const forwardedFor = headersList.get("x-forwarded-for");
    const ipAddress = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : headersList.get("x-real-ip") || "127.0.0.1";

    // Extract User-Agent
    const userAgent = headersList.get("user-agent") || "unknown";

    const supabaseAdmin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: String(targetId),
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: metadata as Json,
    } as any);

    if (error) {
      console.error("[AuditLog Error] Failed to write audit log:", error);
    }
  } catch (err) {
    console.error("[AuditLog Exception] Unexpected error logging audit:", err);
  }
}
