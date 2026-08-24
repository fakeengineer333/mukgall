import { redirect } from "next/navigation";
import { Shield, ShieldAlert, FileText, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdminStatsAction, fetchAuditLogsAction, fetchDeletedContentAction } from "@/app/actions/admin";
import { AdminStats } from "@/components/admin/AdminStats";
import { AuditLogsViewer } from "@/components/admin/AuditLogsViewer";
import { DeletedContentManager } from "@/components/admin/DeletedContentManager";
import { Badge } from "@/components/ui/badge";
import { Profile } from "@/types";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userProfile = profile as unknown as Profile | null;
  if (!userProfile || userProfile.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch admin stats
  const statsRes = await getAdminStatsAction();
  const stats = statsRes.data || {
    totalUsers: 0,
    activePosts: 0,
    deletedPosts: 0,
    totalComments: 0,
    totalAuditLogs: 0,
  };

  // Fetch initial audit logs
  const initialAuditLogs = await fetchAuditLogsAction({ limit: 50 });

  // Fetch deleted contents
  const deletedContent = await fetchDeletedContentAction();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-14">
      {/* Admin Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">관리자 대시보드</h1>
              <Badge variant="admin" className="text-xs">
                mukho 전용
              </Badge>
            </div>
            <p className="text-xs text-zinc-400">
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
            <FileText className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">전수 감사 로그 (Central Audit Logs)</h2>
          </div>
          <AuditLogsViewer initialLogs={initialAuditLogs} />
        </section>

        {/* Section 2: Soft Deleted Content Manager */}
        <section className="space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-bold text-white">논리 삭제(Soft Deleted) 콘텐츠 복구</h2>
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
