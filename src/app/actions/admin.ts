"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { AuditLog, Post, Comment, Profile } from "@/types";

export interface AdminStatsData {
  totalUsers: number;
  activePosts: number;
  deletedPosts: number;
  totalComments: number;
  totalAuditLogs: number;
}

export async function getAdminStatsAction(): Promise<{ success: boolean; data?: AdminStatsData; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "인증되지 않은 사용자입니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string } | null)?.role !== "ADMIN") {
    return { success: false, error: "관리자 권한이 필요합니다." };
  }

  const hasServiceRole = isServiceRoleConfigured();
  const db = hasServiceRole ? createAdminClient() : supabase;

  const [
    { count: totalUsers },
    { count: activePosts },
    { count: deletedPosts },
    { count: totalComments },
    { count: totalAuditLogs },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db.from("posts").select("*", { count: "exact", head: true }).is("deleted_at", null),
    db.from("posts").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
    db.from("comments").select("*", { count: "exact", head: true }),
    db.from("audit_logs").select("*", { count: "exact", head: true }),
  ]);

  return {
    success: true,
    data: {
      totalUsers: totalUsers || 0,
      activePosts: activePosts || 0,
      deletedPosts: deletedPosts || 0,
      totalComments: totalComments || 0,
      totalAuditLogs: totalAuditLogs || 0,
    },
  };
}

interface FetchAuditLogsParams {
  action?: string;
  search?: string;
  limit?: number;
}

export async function fetchAuditLogsAction({
  action,
  search,
  limit = 50,
}: FetchAuditLogsParams): Promise<AuditLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string } | null)?.role !== "ADMIN") {
    return [];
  }

  const hasServiceRole = isServiceRoleConfigured();
  const db = hasServiceRole ? createAdminClient() : supabase;

  let query = db
    .from("audit_logs")
    .select("*, actor:profiles(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action && action !== "ALL") {
    query = query.eq("action", action);
  }

  if (search && search.trim()) {
    query = query.or(
      `ip_address.ilike.%${search.trim()}%,target_id.ilike.%${search.trim()}%,target_type.ilike.%${search.trim()}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Admin Audit] Fetch audit logs error:", error);
    return [];
  }

  return (data || []) as unknown as AuditLog[];
}

export async function fetchDeletedContentAction(): Promise<{
  posts: Post[];
  comments: (Comment & { post?: Post | null })[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { posts: [], comments: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string } | null)?.role !== "ADMIN") {
    return { posts: [], comments: [] };
  }

  const adminClient = createAdminClient();

  const [{ data: deletedPosts }, { data: deletedComments }] = await Promise.all([
    adminClient
      .from("posts")
      .select("*, author:profiles(*)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    adminClient
      .from("comments")
      .select("*, author:profiles(*), post:posts(id, title)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  return {
    posts: (deletedPosts || []) as unknown as Post[],
    comments: (deletedComments || []) as unknown as (Comment & { post?: Post | null })[],
  };
}
