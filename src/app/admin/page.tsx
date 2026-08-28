import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Shield, Trash2, FileText } from "lucide-react";
import { fetchAuditLogsAction, fetchDeletedContentAction } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile } from "@/lib/auth";
import { AdminStats } from "@/components/admin/AdminStats";
import { AuditLogsViewer } from "@/components/admin/AuditLogsViewer";
import { DeletedContentManager } from "@/components/admin/DeletedContentManager";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "관리자 대시보드",
};

export default async function AdminPage() {
  const profile = await getAuthProfile();

  if (!profile || profile.role !== "ADMIN") {
    redirect("/");
  }

  const supabase = await createClient();

  // Parallel fetch admin statistics
  const [
    { count: totalUsers },
    { count: activePosts },
    { count: deletedPosts },
    { count: totalComments },
    { count: totalAuditLogs },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("posts").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("comments").select("*", { count: "exact", head: true }),
    supabase.from("audit_logs").select("*", { count: "exact", head: true }),
  ]);

  const stats = {
    totalUsers: totalUsers || 0,
    activePosts: activePosts || 0,
    deletedPosts: deletedPosts || 0,
    totalComments: totalComments || 0,
    totalAuditLogs: totalAuditLogs || 0,
  };

  // Fetch initial audit logs
  const initialAuditLogs = await fetchAuditLogsAction({ limit: 50 });

  // Fetch deleted contents
  const deletedContent = await fetchDeletedContentAction();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-14">
      {/* Admin Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 shadow">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">관리자 대시보드</h1>
              <Badge variant="admin" className="text-xs">
                mukho 전용
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              전수 감사 로그(`audit_logs`) 모니터링 및 Soft Delete 삭제 콘텐츠 복구
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <AdminStats stats={stats} />

      {/* Main Admin Tabs / Sections */}
      <div className="space-y-8 pt-2">
        {/* Section 1: Audit Logs Viewer */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">전수 감사 로그 (Central Audit Logs)</h2>
          </div>
          <AuditLogsViewer initialLogs={initialAuditLogs} />
        </section>

        {/* Section 2: Soft Deleted Content Manager */}
        <section className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">논리 삭제(Soft Deleted) 콘텐츠 복구</h2>
          </div>
          <DeletedContentManager
            initialPosts={deletedContent.posts}
            initialComments={deletedContent.comments}
          />
        </section>
      </div>
    </div>
  );
}
