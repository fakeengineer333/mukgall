"use client";

import { useState, useTransition } from "react";
import { Shield, Search, Filter, Clock, Globe, Code, Eye, RefreshCw, X } from "lucide-react";
import { AuditLog, AuditAction } from "@/types";
import { fetchAuditLogsAction } from "@/app/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface AuditLogsViewerProps {
  initialLogs: AuditLog[];
}

const ACTION_OPTIONS = [
  { value: "ALL", label: "전체 액션" },
  { value: "AUTH_LOGIN", label: "로그인" },
  { value: "AUTH_SIGNUP", label: "회원가입" },
  { value: "AUTH_LOGOUT", label: "로그아웃" },
  { value: "POST_CREATE", label: "게시글 작성" },
  { value: "POST_UPDATE", label: "게시글 수정" },
  { value: "POST_DELETE", label: "게시글 삭제" },
  { value: "POST_RESTORE", label: "게시글 복구" },
  { value: "COMMENT_CREATE", label: "댓글 작성" },
  { value: "COMMENT_DELETE", label: "댓글 삭제" },
  { value: "CHAT_ROOM_CREATE", label: "채팅방 생성" },
  { value: "CHAT_ROOM_LEAVE", label: "채팅방 퇴장" },
  { value: "PROFILE_UPDATE", label: "프로필 수정" },
];

export function AuditLogsViewer({ initialLogs }: AuditLogsViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedMetadata, setSelectedMetadata] = useState<{ id: number; metadata: any } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = (action = selectedAction, query = search) => {
    startTransition(async () => {
      const data = await fetchAuditLogsAction({
        action,
        search: query,
        limit: 100,
      });
      setLogs(data);
    });
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("DELETE")) return "destructive";
    if (action.includes("RESTORE") || action.includes("SIGNUP")) return "default";
    if (action.includes("UPDATE")) return "admin";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Action Filter Dropdown */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              handleRefresh(e.target.value, search);
            }}
            className="h-9 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPending}
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRefresh(selectedAction, search)}
              placeholder="IP, 대상 ID 검색..."
              className="h-9 pl-9 text-xs"
              disabled={isPending}
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold"
            onClick={() => handleRefresh(selectedAction, search)}
            disabled={isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            조회
          </Button>
        </div>

        <span className="text-xs text-zinc-400 font-medium shrink-0">
          총 {logs.length}건 조회됨
        </span>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 font-bold select-none">
                <th className="py-3 px-4">로그 ID</th>
                <th className="py-3 px-4">액션</th>
                <th className="py-3 px-4">행위자(Actor)</th>
                <th className="py-3 px-4">대상 리소스</th>
                <th className="py-3 px-4">IP & 환경</th>
                <th className="py-3 px-4">기록 일시</th>
                <th className="py-3 px-4 text-center">메타데이터</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    조건에 해당하는 감사 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-zinc-500">#{log.id}</td>
                    <td className="py-3 px-4">
                      <Badge variant={getActionBadgeVariant(log.action)} className="text-[10px]">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          src={log.actor?.avatar_url}
                          fallbackText={log.actor?.username || "Sys"}
                          size="sm"
                          className="h-5 w-5"
                        />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                          {log.actor?.username || "시스템/비로그인"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-blue-500 dark:text-blue-400">{log.target_type}</span>
                      <span className="text-zinc-400 dark:text-zinc-500"> : </span>
                      <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[80px] inline-block align-bottom">
                        {log.target_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate">
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span className="font-mono">{log.ip_address || "127.0.0.1"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap text-[11px]">
                      {new Date(log.created_at).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <button
                          onClick={() => setSelectedMetadata({ id: log.id, metadata: log.metadata })}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          보기
                        </button>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata Detail Modal */}
      {selectedMetadata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                로그 #{selectedMetadata.id} 메타데이터 Diff
              </h3>
              <button
                onClick={() => setSelectedMetadata(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="max-h-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-emerald-400 whitespace-pre-wrap break-words">
              {JSON.stringify(selectedMetadata.metadata, null, 2)}
            </pre>

            <Button
              className="w-full font-bold"
              variant="secondary"
              onClick={() => setSelectedMetadata(null)}
            >
              닫기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
