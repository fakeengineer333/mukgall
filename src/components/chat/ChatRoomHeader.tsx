"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  LogOut,
  Settings,
  X,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Crown,
} from "lucide-react";
import { ChatRoom, Profile } from "@/types";
import { leaveChatRoomAction, updateChatRoomAction } from "@/app/actions/chat";
import { uploadImageToStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatRoomHeaderProps {
  room: ChatRoom;
  participants: (Profile & { joined_at?: string })[];
  currentUserId: string;
}

export function ChatRoomHeader({
  room,
  participants,
  currentUserId,
}: ChatRoomHeaderProps) {
  const router = useRouter();
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isGroup = room.is_group;
  const isHost = isGroup && room.created_by === currentUserId;
  const otherUser = participants.find((p) => p.id !== currentUserId);

  // Room Settings State
  const [roomName, setRoomName] = useState(room.name || "");
  const [roomAvatarUrl, setRoomAvatarUrl] = useState(room.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ success?: boolean; error?: string } | null>(null);
  const [isUpdatingSettings, startSettingsTransition] = useTransition();

  // Real-time synchronization of room metadata (Title and Avatar) for ALL participants
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room_meta_${room.id}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as ChatRoom;
          if (updated) {
            if (updated.name) setRoomName(updated.name);
            if (updated.avatar_url !== undefined) {
              setRoomAvatarUrl(updated.avatar_url || "");
              setAvatarPreview(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  const title = isGroup
    ? roomName || room.name || "그룹 대화방"
    : otherUser?.username || "대화 상대";

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setUploadingAvatar(true);
    const fileName = `rooms/${room.id}/${Date.now()}-${file.name}`;
    const { url, error } = await uploadImageToStorage("chat-images", fileName, file);
    setUploadingAvatar(false);

    if (error) {
      setSettingsStatus({ error: `이미지 업로드 실패: ${error}` });
    } else if (url) {
      setRoomAvatarUrl(url);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setSettingsStatus(null);
    startSettingsTransition(async () => {
      const res = await updateChatRoomAction({
        roomId: room.id,
        name: roomName.trim(),
        avatarUrl: roomAvatarUrl || null,
      });

      if (res.success) {
        setSettingsStatus({ success: true });
        setTimeout(() => {
          setShowSettings(false);
          setSettingsStatus(null);
          router.refresh();
        }, 800);
      } else {
        setSettingsStatus({ error: res.error || "대화방 설정 변경에 실패했습니다." });
      }
    });
  };

  const handleLeave = () => {
    if (confirm("정말 이 대화방을 나가시겠습니까? 나가면 대화 내용이 더 이상 업데이트되지 않습니다.")) {
      startTransition(async () => {
        const res = await leaveChatRoomAction(room.id);
        if (res.success) {
          router.push("/chat");
        }
      });
    }
  };

  return (
    <>
      <div className="shrink-0 sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded-lg p-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-2.5">
            {isGroup ? (
              roomAvatarUrl || room.avatar_url ? (
                <Avatar
                  src={avatarPreview || roomAvatarUrl || room.avatar_url}
                  fallbackText={title}
                  size="sm"
                  className="h-9 w-9 ring-2 ring-purple-500/30"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow">
                  <Users className="h-4 w-4" />
                </div>
              )
            ) : (
              <Avatar
                src={otherUser?.avatar_url}
                fallbackText={title}
                size="sm"
                className="h-9 w-9"
              />
            )}

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 max-w-[180px] sm:max-w-xs truncate">
                  {title}
                </h2>
                {isGroup && (
                  <span className="text-xs text-zinc-500 font-medium">
                    ({participants.length})
                  </span>
                )}
                {otherUser?.role === "ADMIN" && !isGroup && (
                  <Badge variant="admin" className="text-[9px] px-1 py-0">
                    관리자
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Host Settings Button */}
          {isHost && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-300"
              onClick={() => setShowSettings(true)}
              title="방장 채팅방 설정"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          {/* Members List Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => setShowMembers(true)}
            title="참여자 목록"
          >
            <Users className="h-4 w-4" />
          </Button>

          {/* Leave Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-300"
            onClick={handleLeave}
            disabled={isPending}
            title="대화방 나가기"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Host Room Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                대화방 설정 (방장)
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {settingsStatus?.error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{settingsStatus.error}</span>
              </div>
            )}

            {settingsStatus?.success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>대화방 설정이 성공적으로 변경되었습니다!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Room Image / Avatar */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative group cursor-pointer">
                  {avatarPreview || roomAvatarUrl ? (
                    <Avatar
                      src={avatarPreview || roomAvatarUrl}
                      fallbackText={roomName || "방"}
                      size="xl"
                      className="border-2 border-zinc-700"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow">
                      <Users className="h-7 w-7" />
                    </div>
                  )}

                  <label
                    htmlFor="room-avatar-upload"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </label>
                  <input
                    id="room-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isUpdatingSettings || uploadingAvatar}
                  />
                </div>
                <label
                  htmlFor="room-avatar-upload"
                  className="text-xs text-blue-400 cursor-pointer hover:underline"
                >
                  {uploadingAvatar ? "이미지 업로드 중..." : "채팅방 대표 이미지 변경"}
                </label>
              </div>

              {/* Room Name Input */}
              <div className="space-y-1.5">
                <label htmlFor="room-name" className="text-xs font-semibold text-zinc-300">
                  채팅방 제목
                </label>
                <Input
                  id="room-name"
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="대화방 이름을 입력하세요"
                  required
                  maxLength={50}
                  disabled={isUpdatingSettings}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowSettings(false)}
                  disabled={isUpdatingSettings}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gap-1.5 font-bold"
                  disabled={isUpdatingSettings || uploadingAvatar || !roomName.trim()}
                >
                  {isUpdatingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    "저장하기"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participants Modal with Host Crown Badge */}
      {showMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                대화방 참여자 ({participants.length})
              </h3>
              <button
                onClick={() => setShowMembers(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              {participants.map((p) => {
                const isRoomCreator = isGroup && p.id === room.created_by;

                return (
                  <div key={p.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={p.avatar_url} fallbackText={p.username} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                            {p.username}
                          </span>

                          {/* Host Crown Badge */}
                          {isRoomCreator && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 shadow-sm">
                              <Crown className="h-2.5 w-2.5 text-amber-400" />
                              방장
                            </span>
                          )}

                          {p.id === currentUserId && (
                            <span className="text-[10px] text-blue-400 font-bold">(나)</span>
                          )}
                          {p.role === "ADMIN" && (
                            <Badge variant="admin" className="text-[9px] px-1 py-0">
                              관리자
                            </Badge>
                          )}
                        </div>
                        {p.bio && <p className="text-[10px] text-zinc-500">{p.bio}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5 font-bold"
              onClick={handleLeave}
              disabled={isPending}
            >
              <LogOut className="h-4 w-4" />
              이 대화방 나가기
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
