import Link from "next/link";
import { Shield, Calendar, Image as ImageIcon, MessageSquare, ShieldAlert } from "lucide-react";
import { Profile } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileEditModal } from "@/components/profile/ProfileEditModal";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { NotificationToggle } from "@/components/common/NotificationManager";
import { formatDate } from "@/lib/utils";

interface ProfileCardProps {
  profile: Profile;
  postsCount?: number;
  commentsCount?: number;
}

export function ProfileCard({
  profile,
  postsCount = 0,
  commentsCount = 0,
}: ProfileCardProps) {
  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl">
        {/* Banner header gradient */}
        <div className="h-24 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border-b border-zinc-800" />

        <CardContent className="relative px-5 pb-5 pt-0">
          {/* Avatar floating on top */}
          <div className="flex justify-between items-end -mt-12 mb-4">
            <Avatar
              src={profile.avatar_url}
              fallbackText={profile.username}
              size="xl"
              className="ring-4 ring-zinc-900 shadow-2xl"
            />
            <div className="flex items-center gap-2">
              <NotificationToggle />
              <ProfileEditModal profile={profile} />
            </div>
          </div>

          {/* User info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white">{profile.username}</h2>
              {isAdmin ? (
                <Badge variant="admin" className="flex items-center gap-1 font-bold">
                  <Shield className="h-3 w-3" />
                  관리자
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  일반 유저
                </Badge>
              )}
            </div>

            <p className="text-sm text-zinc-300">
              {profile.bio || "등록된 한 줄 소개가 없습니다."}
            </p>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>가입일: {formatDate(profile.created_at)}</span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-950/60 p-3 border border-zinc-800/60">
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> 작성한 게시글
              </span>
              <span className="text-lg font-bold text-white mt-0.5">{postsCount}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 text-center border-l border-zinc-800">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> 작성한 댓글
              </span>
              <span className="text-lg font-bold text-white mt-0.5">{commentsCount}</span>
            </div>
          </div>

          {/* Admin Dashboard Entry (if admin) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <Link href="/admin">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 font-bold"
                >
                  <ShieldAlert className="h-4 w-4" />
                  관리자 대시보드 및 감사 로그 열람
                </Button>
              </Link>
            </div>
          )}

          {/* Logout button */}
          <div className="mt-4 pt-2">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
