import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { ChatRoomHeader } from "@/components/chat/ChatRoomHeader";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { ChatRoom, Message, Profile } from "@/types";

interface ChatRoomPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatRoomPage({ params }: ChatRoomPageProps) {
  const resolvedParams = await params;
  const roomId = resolvedParams.id;

  const [supabase, user] = await Promise.all([
    createClient(),
    getAuthUser(),
  ]);

  if (!user) {
    redirect(`/login?redirectTo=/chat/${roomId}`);
  }

  // Parallel fetch: Participation, Room Info, All Participants, and Initial Messages
  const [myPartRes, roomRes, rawParticipantsRes, rawMessagesRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("chat_participants") as any)
      .select("joined_at, last_read_at, left_at")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("chat_rooms").select("*").eq("id", roomId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("chat_participants") as any)
      .select("user_id, last_read_at, joined_at, profile:profiles(*)")
      .eq("room_id", roomId)
      .is("left_at", null),
    supabase
      .from("messages")
      .select("*, sender:profiles(*)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const myParticipation = myPartRes.data as {
    joined_at: string;
    last_read_at: string;
    left_at: string | null;
  } | null;

  if (!myParticipation || myParticipation.left_at !== null) {
    redirect("/chat");
  }

  const room = roomRes.data;
  if (roomRes.error || !room) {
    notFound();
  }

  const rawParticipants = rawParticipantsRes.data || [];
  const participants = rawParticipants.map((p: any) => ({
    ...p.profile,
    id: p.user_id,
    user_id: p.user_id,
    last_read_at: p.last_read_at,
    joined_at: p.joined_at,
  })) as (Profile & { joined_at?: string })[];

  const initialParticipants = rawParticipants.map((p: any) => ({
    user_id: p.user_id as string,
    last_read_at: (p.last_read_at || p.joined_at || "1970-01-01T00:00:00Z") as string,
  }));

  const rawMessages = (rawMessagesRes.data || []).filter((m: any) =>
    !myParticipation.joined_at || new Date(m.created_at) >= new Date(myParticipation.joined_at)
  );

  const initialMessages = ((rawMessages || []) as unknown as (Message & { sender?: Profile | null })[]).reverse();
  const currentUserProfile = participants.find((p) => p.id === user.id) || null;

  // Non-blocking update last_read_at in background
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from("chat_participants") as any)
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .then(() => {})
    .catch(() => {});

  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] sm:h-[calc(100dvh-9rem)] -mx-4 -mt-4 sm:mx-auto sm:-mt-2 sm:max-w-2xl sm:rounded-2xl border-0 sm:border border-zinc-800 bg-zinc-950 sm:shadow-2xl overflow-hidden">
      <ChatRoomHeader
        room={room as unknown as ChatRoom}
        participants={participants}
        currentUserId={user.id}
      />

      <ChatMessageList
        roomId={roomId}
        initialMessages={initialMessages}
        initialParticipants={initialParticipants}
        currentUserId={user.id}
        currentUserProfile={currentUserProfile}
      />

      <ChatMessageInput
        roomId={roomId}
        currentUserId={user.id}
        currentUserProfile={currentUserProfile}
      />
    </div>
  );
}
