"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Users, ArrowRight, MessageCircleOff } from "lucide-react";
import { ChatRoom, Profile, Message } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useChat } from "@/providers/ChatProvider";

interface ChatRoomItem extends ChatRoom {
  otherUser?: Profile | null;
  participantCount?: number;
  unreadCount?: number;
}

interface ChatRoomListProps {
  rooms: ChatRoomItem[];
  currentUserId: string;
}

// Helper to sort rooms by most recent activity (latest message or room creation)
function sortRoomsByRecent(list: ChatRoomItem[]): ChatRoomItem[] {
  return [...list].sort((a, b) => {
    const timeA = a.last_message?.created_at
      ? new Date(a.last_message.created_at).getTime()
      : new Date(a.created_at).getTime();
    const timeB = b.last_message?.created_at
      ? new Date(b.last_message.created_at).getTime()
      : new Date(b.created_at).getTime();
    return timeB - timeA;
  });
}

export function ChatRoomList({ rooms: initialRooms, currentUserId }: ChatRoomListProps) {
  const router = useRouter();
  const { unreadRoomsMap, latestMessage } = useChat();
  const [rooms, setRooms] = useState<ChatRoomItem[]>(() => sortRoomsByRecent(initialRooms));

  // Sync state if initialRooms updates from server
  useEffect(() => {
    setRooms(sortRoomsByRecent(initialRooms));
  }, [initialRooms]);

  // React immediately to new messages from global ChatProvider
  useEffect(() => {
    if (!latestMessage || !latestMessage.room_id) return;

    setRooms((prevRooms) => {
      const roomIndex = prevRooms.findIndex((r) => r.id === latestMessage.room_id);
      if (roomIndex !== -1) {
        const targetRoom = { ...prevRooms[roomIndex], last_message: latestMessage };
        const otherRooms = prevRooms.filter((_, idx) => idx !== roomIndex);
        return sortRoomsByRecent([targetRoom, ...otherRooms]);
      }
      // If room is not in current list (new room created), refresh server
      router.refresh();
      return prevRooms;
    });
  }, [latestMessage, router]);

  // Catch-up refresh on window focus, popstate, or visibility change
  useEffect(() => {
    const handleRevisit = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    window.addEventListener("focus", handleRevisit);
    window.addEventListener("popstate", handleRevisit);
    window.addEventListener("visibilitychange", handleRevisit);

    return () => {
      window.removeEventListener("focus", handleRevisit);
      window.removeEventListener("popstate", handleRevisit);
      window.removeEventListener("visibilitychange", handleRevisit);
    };
  }, [router]);

  // Real-time synchronization of room metadata (Title and Avatar updates)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`chatroom_meta_sync_${currentUserId}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
        },
        (payload) => {
          const updated = payload.new as ChatRoom;
          if (!updated || !updated.id) return;

          setRooms((prev) =>
            prev.map((r) =>
              r.id === updated.id
                ? {
                    ...r,
                    name: updated.name || r.name,
                    avatar_url:
                      updated.avatar_url !== undefined
                        ? updated.avatar_url
                        : r.avatar_url,
                  }
                : r
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40">
        <div className="p-3 rounded-full bg-zinc-900 text-zinc-600">
          <MessageCircleOff className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            참여 중인 대화방이 없습니다.
          </p>
          <p className="text-xs text-zinc-500">
            상단의 [새 대화 시작] 버튼을 눌러 첫 번째 대화를 시작해보세요!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-xl">
      {rooms.map((room) => {
        const isGroup = room.is_group;
        const isSelfChat = !isGroup && (room.participantCount === 1 || room.name === "나와의 채팅");
        const displayName = isSelfChat
          ? "나와의 채팅"
          : isGroup
          ? room.name || "그룹 대화방"
          : room.otherUser?.username || "대화 상대";

        const displayAvatar = isGroup ? null : room.otherUser?.avatar_url;
        const lastMsg =
          room.last_message?.content ||
          (room.last_message?.image_url
            ? "사진을 보냈습니다."
            : isSelfChat
            ? "나만의 비밀 메모, 사진, 링크 저장소"
            : "대화가 시작되었습니다.");

        return (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {isGroup ? (
                room.avatar_url ? (
                  <Avatar
                    src={room.avatar_url}
                    fallbackText={displayName}
                    size="md"
                    className="h-11 w-11"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold shadow">
                    <Users className="h-5 w-5" />
                  </div>
                )
              ) : isSelfChat ? (
                <div className="relative">
                  <Avatar
                    src={displayAvatar}
                    fallbackText="나"
                    size="md"
                    className="h-11 w-11 border-2 border-blue-500/40"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow">
                    나
                  </div>
                </div>
              ) : (
                <Avatar
                  src={displayAvatar}
                  fallbackText={displayName}
                  size="md"
                  className="h-11 w-11"
                />
              )}

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {displayName}
                  </span>
                  {isSelfChat && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30">
                      내 메모장
                    </Badge>
                  )}
                  {isGroup && room.participantCount && (
                    <span className="text-[11px] font-semibold text-zinc-500">
                      {room.participantCount}
                    </span>
                  )}
                  {room.otherUser?.role === "ADMIN" && !isGroup && !isSelfChat && (
                    <Badge variant="admin" className="text-[9px] px-1 py-0">
                      관리자
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[220px] sm:max-w-md">
                  {lastMsg}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
              <span className="text-[10px] text-zinc-500">
                {room.last_message?.created_at
                  ? formatDate(room.last_message.created_at)
                  : formatDate(room.created_at)}
              </span>

              {(() => {
                const unreadNum =
                  unreadRoomsMap[room.id] !== undefined
                    ? unreadRoomsMap[room.id]
                    : (room.unreadCount || 0);

                if (unreadNum > 0) {
                  return (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-md shadow-red-600/30 animate-pulse">
                      {unreadNum > 99 ? "99+" : unreadNum}
                    </span>
                  );
                }

                return (
                  <ArrowRight className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                );
              })()}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
