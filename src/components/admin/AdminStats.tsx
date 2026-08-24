import { Users, ImageIcon, Trash2, MessageSquare, ShieldAlert } from "lucide-react";
import { AdminStatsData } from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminStatsProps {
  stats: AdminStatsData;
}

export function AdminStats({ stats }: AdminStatsProps) {
  const statItems = [
    {
      title: "전체 회원",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "활성 게시글",
      value: stats.activePosts,
      icon: ImageIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "삭제된 게시글",
      value: stats.deletedPosts,
      icon: Trash2,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      title: "전체 댓글",
      value: stats.totalComments,
      icon: MessageSquare,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "누적 감사 로그",
      value: stats.totalAuditLogs,
      icon: ShieldAlert,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <Card key={idx} className="border-zinc-800 bg-zinc-900/90 shadow-md">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-semibold text-zinc-400">{item.title}</span>
              <div className={`p-1.5 rounded-lg ${item.bg} ${item.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl sm:text-2xl font-black text-white">{item.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
