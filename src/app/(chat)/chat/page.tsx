import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { ChatRoom, Profile, Message } from "@/types";

export default async function ChatListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/chat");
  }

  try {
    // 1. Fetch participant records for current user (where left_at IS NULL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawMyParticipations } = await (supabase.from("chat_participants") as any)
      .select("room_id, last_read_at, left_at")
      .eq("user_id", user.id)
      .is("left_at", null);

    const myParticipations = (rawMyParticipations || []) as {
      room_id: string;
      last_read_at: string;
      left_at: string | null;
    }[];

    if (myParticipations.length === 0) {
      return (
        <div className="space-y-6 max-w-2xl mx-auto pb-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-500" />
              메시지
            </h1>
            <NewChatModal />
          </div>
          <ChatRoomList rooms={[]} currentUserId={user.id} />
        </div>
      );
    }

    const roomIds = myParticipations.map((p) => p.room_id);

    // 2. Fetch room details
    const { data: rawRooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .in("id", roomIds)
      .order("created_at", { ascending: false });

    const roomsData = (rawRooms || []) as unknown as ChatRoom[];

    // 3. Fetch all participants of these rooms to resolve names & avatars
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawAllParticipants } = await (supabase.from("chat_participants") as any)
      .select("room_id, user_id, joined_at, left_at, profile:profiles(*)")
      .in("room_id", roomIds)
      .is("left_at", null);

    const allParticipants = (rawAllParticipants || []) as {
      room_id: string;
      user_id: string;
      joined_at: string;
      left_at: string | null;
      profile: Profile | null;
    }[];

    // 4. Fetch all messages for these rooms
    const { data: rawAllMessages } = await supabase
      .from("messages")
      .select("*")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });

    const allMessages = (rawAllMessages || []) as unknown as Message[];

    // Process and shape rooms list
    const formattedRooms = roomsData.map((room) => {
      const myPart = myParticipations.find((p) => p.room_id === room.id);
      const roomParticipants = allParticipants.filter((p) => p.room_id === room.id);
      const otherParticipant = roomParticipants.find((p) => p.user_id !== user.id);

      const roomMessages = allMessages.filter((m) => m.room_id === room.id);
      const lastMessage = roomMessages[0] || null;

      // Unread count: messages created after my last_read_at
      const lastReadTime = myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : 0;
      const unreadCount = roomMessages.filter(
        (m) => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadTime
      ).length;

      return {
        ...room,
        otherUser: otherParticipant?.profile || null,
        participantCount: roomParticipants.length,
        last_message: lastMessage,
        unreadCount,
      };
    });

    return (
      <div className="space-y-6 max-w-2xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            메시지 ({formattedRooms.length})
          </h1>
          <NewChatModal />
        </div>

        <ChatRoomList rooms={formattedRooms} currentUserId={user.id} />
      </div>
    );
  } catch (err) {
    console.error("[/chat] Failed to fetch chat rooms:", err);
    return (
      <div className="space-y-6 max-w-2xl mx-auto pb-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            메시지
          </h1>
          <NewChatModal />
        </div>
        <ChatRoomList rooms={[]} currentUserId={user.id} />
      </div>
    );
  }
}
