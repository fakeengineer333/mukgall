import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateLastReadAction } from "@/app/actions/chat";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/chat/${roomId}`);
  }

  // 1. Check if user is a participant of this room
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawMyPart } = await (supabase.from("chat_participants") as any)
    .select("joined_at, last_read_at, left_at")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  const myParticipation = rawMyPart as {
    joined_at: string;
    last_read_at: string;
    left_at: string | null;
  } | null;

  if (!myParticipation || myParticipation.left_at !== null) {
    // Not in room or already left
    redirect("/chat");
  }

  // 2. Fetch room info
  const { data: room, error: roomErr } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (roomErr || !room) {
    notFound();
  }

  // 3. Fetch all active participants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawParticipants } = await (supabase.from("chat_participants") as any)
    .select("user_id, last_read_at, joined_at, profile:profiles(*)")
    .eq("room_id", roomId)
    .is("left_at", null);

  const participants = (rawParticipants || []).map((p: any) => ({
    ...p.profile,
    id: p.user_id,
    user_id: p.user_id,
    last_read_at: p.last_read_at,
    joined_at: p.joined_at,
  })) as (Profile & { joined_at?: string })[];

  const initialParticipants = (rawParticipants || []).map((p: any) => ({
    user_id: p.user_id as string,
    last_read_at: (p.last_read_at || p.joined_at || "1970-01-01T00:00:00Z") as string,
  }));

  // 4. Fetch initial messages history (latest 30 messages)
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("*, sender:profiles(*)")
    .eq("room_id", roomId)
    .gte("created_at", myParticipation.joined_at)
    .order("created_at", { ascending: false })
    .limit(30);

  const initialMessages = ((rawMessages || []) as unknown as (Message & { sender?: Profile | null })[]).reverse();

  // 5. Update last_read_at in background
  await updateLastReadAction(roomId);

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
      />

      <ChatMessageInput roomId={roomId} />
    </div>
  );
}
