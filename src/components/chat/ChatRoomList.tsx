"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Users, ArrowRight, MessageCircleOff } from "lucide-react";
import { ChatRoom, Profile, Message } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ChatRoomItem extends ChatRoom {
  otherUser?: Profile | null;
  participantCount?: number;
  unreadCount?: number;
}

interface ChatRoomListProps {
  rooms: ChatRoomItem[];
  currentUserId: string;
}

export function ChatRoomList({ rooms: initialRooms, currentUserId }: ChatRoomListProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoomItem[]>(initialRooms);

  // Sync state if initialRooms updates from server
  useEffect(() => {
    setRooms(initialRooms);
  }, [initialRooms]);

  // Refresh server state on back navigation or window focus
  useEffect(() => {
    router.refresh();

    const handleRevisit = () => {
      router.refresh();
    };

    window.addEventListener("focus", handleRevisit);
    window.addEventListener("popstate", handleRevisit);
    return () => {
      window.removeEventListener("focus", handleRevisit);
      window.removeEventListener("popstate", handleRevisit);
    };
  }, [router]);

  // Real-time subscription for Chat Room List updates
  useEffect(() => {
    const supabase = createClient();

    // Authenticate Realtime socket with user's session JWT on load/refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Helper to update room with new message
    const handleIncomingMessage = (newMsg: Message) => {
      if (!newMsg || !newMsg.room_id) return;

      setRooms((prevRooms) => {
        const roomIndex = prevRooms.findIndex((r) => r.id === newMsg.room_id);

        // If room is in list, update snippet, unread count, and move to top
        if (roomIndex !== -1) {
          const targetRoom = { ...prevRooms[roomIndex] };
          targetRoom.last_message = newMsg;
          if (newMsg.sender_id !== currentUserId) {
            targetRoom.unreadCount = (targetRoom.unreadCount || 0) + 1;
          }

          const otherRooms = prevRooms.filter((_, idx) => idx !== roomIndex);
          return [targetRoom, ...otherRooms];
        }

        // If it's a new room not in list, trigger server refresh
        router.refresh();
        return prevRooms;
      });
    };

    // Single isolated channel with unique ID to avoid collision with BottomNav or other components
    const channel = supabase
      .channel(`chatroom_list_${currentUserId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg) {
            handleIncomingMessage(newMsg);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_participants",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          router.refresh();
        }
      )
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
  }, [currentUserId, router]);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40">
        <div className="p-3 rounded-full bg-zinc-900 text-zinc-600">
          <MessageCircleOff className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-300">
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
    <div className="divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
      {rooms.map((room) => {
        const isGroup = room.is_group;
        const displayName = isGroup
          ? room.name || "그룹 대화방"
          : room.otherUser?.username || "대화 상대";

        const displayAvatar = isGroup ? null : room.otherUser?.avatar_url;
        const lastMsg =
          room.last_message?.content ||
          (room.last_message?.image_url ? "[사진 첨부]" : "대화가 시작되었습니다.");

        return (
          <Link
            key={room.id}
            href={`/chat/${room.id}`}
            className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors group"
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
                  <span className="text-sm font-bold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                    {displayName}
                  </span>
                  {isGroup && room.participantCount && (
                    <span className="text-[11px] font-semibold text-zinc-500">
                      {room.participantCount}
                    </span>
                  )}
                  {room.otherUser?.role === "ADMIN" && !isGroup && (
                    <Badge variant="admin" className="text-[9px] px-1 py-0">
                      관리자
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-zinc-400 truncate max-w-[220px] sm:max-w-md">
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

              {room.unreadCount && room.unreadCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-md shadow-red-600/30 animate-pulse">
                  {room.unreadCount > 99 ? "99+" : room.unreadCount}
                </span>
              ) : (
                <ArrowRight className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
