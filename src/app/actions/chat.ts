"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ratelimit";
import { Profile, Message, ChatRoom } from "@/types";

export async function searchUsersAction(query: string): Promise<Profile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  // Search profiles matching username except current user
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${trimmed}%`)
    .neq("id", user.id)
    .limit(10);

  return (data || []) as unknown as Profile[];
}

interface CreateChatRoomParams {
  isGroup: boolean;
  targetUserIds: string[];
  name?: string;
}

export async function createChatRoomAction({
  isGroup,
  targetUserIds,
  name,
}: CreateChatRoomParams): Promise<{ success: boolean; roomId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const isSelfChat = !isGroup && (targetUserIds.length === 0 || (targetUserIds.length === 1 && targetUserIds[0] === user.id));

  if (!isSelfChat && targetUserIds.length === 0) {
    return { success: false, error: "대화할 상대를 최소 1명 이상 선택해주세요." };
  }

  // Get current user profile for system message
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const myUsername = (myProfile as unknown as Profile)?.username || "사용자";

  // If self chat, check if user already has a self chat room
  if (isSelfChat) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myRooms } = await (supabase.from("chat_participants") as any)
      .select("room_id, chat_rooms!inner(is_group)")
      .eq("user_id", user.id)
      .eq("chat_rooms.is_group", false);

    if (myRooms && myRooms.length > 0) {
      for (const r of myRooms) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase.from("chat_participants") as any)
          .select("*", { count: "exact", head: true })
          .eq("room_id", r.room_id)
          .is("left_at", null);

        if (count === 1) {
          return { success: true, roomId: r.room_id };
        }
      }
    }
  } else if (!isGroup && targetUserIds.length === 1) {
    // If 1:1 chat (not group and 1 target user), check if room already exists between these 2 users
    const targetId = targetUserIds[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: myRooms } = await (supabase.from("chat_participants") as any)
      .select("room_id, chat_rooms!inner(is_group)")
      .eq("user_id", user.id)
      .eq("chat_rooms.is_group", false);

    if (myRooms && myRooms.length > 0) {
      const roomIds = (myRooms as { room_id: string }[]).map((r) => r.room_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingTarget } = await (supabase.from("chat_participants") as any)
        .select("room_id")
        .in("room_id", roomIds)
        .eq("user_id", targetId)
        .is("left_at", null)
        .limit(1);

      if (existingTarget && (existingTarget as { room_id: string }[]).length > 0) {
        return { success: true, roomId: (existingTarget as { room_id: string }[])[0].room_id };
      }
    }
  }

  const roomName = isGroup
    ? name?.trim() || `${myUsername}님의 그룹 대화방`
    : null;

  // 1. Try atomic create_chat_room RPC function (only if not self-chat)
  if (!isSelfChat) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("create_chat_room", {
        p_is_group: isGroup,
        p_name: roomName,
        p_participant_ids: targetUserIds,
      });

      if (!rpcErr && rpcRes) {
        const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
        if (parsed.success && parsed.room_id) {
          await recordAuditLog({
            actorId: user.id,
            action: "CHAT_ROOM_CREATE",
            targetType: "chat_rooms",
            targetId: parsed.room_id,
            metadata: { isGroup, participantCount: targetUserIds.length + 1, roomName },
          });

          revalidatePath("/chat");
          return { success: true, roomId: parsed.room_id };
        }
      }
    } catch (e) {
      console.warn("[Chat] RPC create_chat_room notice:", e);
    }
  }

  const adminClient = createAdminClient();
  const insertClient = isServiceRoleConfigured() ? adminClient : supabase;

  // 2. Direct client insert fallback / Self Chat creation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: newRoom, error: roomErr } = await (insertClient.from("chat_rooms") as any)
    .insert({
      name: roomName,
      is_group: isGroup,
      created_by: user.id,
    })
    .select()
    .single();

  if (roomErr && insertClient !== adminClient) {
    // Retry with adminClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retryRes = await (adminClient.from("chat_rooms") as any)
      .insert({
        name: roomName,
        is_group: isGroup,
        created_by: user.id,
      })
      .select()
      .single();
    if (retryRes.data) {
      newRoom = retryRes.data;
      roomErr = null;
    }
  }

  if (roomErr || !newRoom) {
    return { success: false, error: `채팅방 생성 실패: ${roomErr?.message}` };
  }

  const roomId = newRoom.id;

  // Add all participants (including creator)
  const participantIds = isSelfChat ? [user.id] : Array.from(new Set([user.id, ...targetUserIds]));
  const participantsToInsert = participantIds.map((uid) => ({
    room_id: roomId,
    user_id: uid,
    joined_at: new Date().toISOString(),
    last_read_at: new Date().toISOString(),
  }));

  const activeClient = isServiceRoleConfigured() ? adminClient : supabase;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: partErr } = await (activeClient.from("chat_participants") as any).insert(participantsToInsert);
  if (partErr && activeClient !== adminClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from("chat_participants") as any).insert(participantsToInsert);
  }

  // Send initial system message
  const systemContent = isSelfChat
    ? "나와의 채팅방이 생성되었습니다."
    : isGroup
    ? `${myUsername}님이 단체 대화방을 개설했습니다.`
    : `대화가 시작되었습니다.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: msgErr } = await (activeClient.from("messages") as any).insert({
    room_id: roomId,
    sender_id: user.id,
    content: systemContent,
    message_type: "SYSTEM",
  });
  if (msgErr && activeClient !== adminClient) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from("messages") as any).insert({
      room_id: roomId,
      sender_id: user.id,
      content: systemContent,
      message_type: "SYSTEM",
    });
  }

  // Record audit log
  await recordAuditLog({
    actorId: user.id,
    action: "CHAT_ROOM_CREATE",
    targetType: "chat_rooms",
    targetId: roomId,
    metadata: { isGroup, isSelfChat, participantCount: participantIds.length, roomName },
  });

  revalidatePath("/chat");
  return { success: true, roomId };
}

interface SendMessageParams {
  roomId: string;
  content?: string;
  imageUrl?: string;
  messageType?: "TEXT" | "IMAGE";
}

export async function sendMessageAction({
  roomId,
  content,
  imageUrl,
  messageType = "TEXT",
}: SendMessageParams): Promise<{ success: boolean; error?: string; message?: any }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  if (messageType === "TEXT" && (!content || !content.trim())) {
    return { success: false, error: "메시지 내용을 입력해주세요." };
  }

  if (messageType === "IMAGE" && !imageUrl) {
    return { success: false, error: "이미지 URL이 유효하지 않습니다." };
  }

  // Rate Limiting (Max 30 messages per minute)
  const rateLimitResult = await checkRateLimit(`chat_msg:${user.id}`, 30, 60);
  if (!rateLimitResult.success) {
    return { success: false, error: "메시지 전송 요청이 너무 빠릅니다." };
  }

  // Verify participant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: participant } = await (supabase.from("chat_participants") as any)
    .select("left_at")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (!participant || participant.left_at !== null) {
    return { success: false, error: "대화방에 참여 중이지 않습니다." };
  }

  const messageData = {
    room_id: roomId,
    sender_id: user.id,
    content: content?.trim() || null,
    image_url: imageUrl || null,
    message_type: messageType,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedMsg, error } = await (supabase.from("messages") as any)
    .insert(messageData)
    .select("*, sender:profiles(*)")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Update sender's last_read_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("chat_participants") as any)
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  return { success: true, message: insertedMsg };
}

export async function leaveChatRoomAction(
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = (profile as { username?: string } | null)?.username || "사용자";

  // Mark left_at using user's supabase client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("chat_participants") as any)
    .update({ left_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Send system message that user left
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("messages") as any).insert({
    room_id: roomId,
    sender_id: user.id,
    content: `${username}님이 대화방을 나갔습니다.`,
    message_type: "SYSTEM",
  });

  // Record audit log
  await recordAuditLog({
    actorId: user.id,
    action: "CHAT_ROOM_LEAVE",
    targetType: "chat_rooms",
    targetId: roomId,
  });

  revalidatePath("/chat");
  return { success: true };
}

export async function updateLastReadAction(roomId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("chat_participants") as any)
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", user.id);
  } catch (err) {
    console.warn("[Chat] Update last read failed:", err);
  }
}

export async function updateChatRoomAction({
  roomId,
  name,
  avatarUrl,
}: {
  roomId: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // Verify creator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error: fetchErr } = await (supabase.from("chat_rooms") as any)
    .select("created_by, is_group")
    .eq("id", roomId)
    .single();

  if (fetchErr || !room) {
    return { success: false, error: "대화방을 찾을 수 없습니다." };
  }

  if (room.created_by !== user.id) {
    return { success: false, error: "방장만 대화방 설정을 변경할 수 있습니다." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "대화방 이름을 입력해주세요." };
  }

  // 1. Try atomic update_chat_room RPC function (Bypasses RLS UPDATE restrictions)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("update_chat_room", {
      p_room_id: roomId,
      p_name: trimmedName,
      p_avatar_url: avatarUrl || null,
    });

    if (!rpcErr && rpcRes) {
      const parsed = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
      if (parsed.success) {
        revalidatePath(`/chat/${roomId}`);
        revalidatePath("/chat");
        return { success: true };
      }
      if (parsed.error) {
        return { success: false, error: parsed.error };
      }
    }
  } catch (e) {
    console.warn("[updateChatRoom] RPC notice:", e);
  }

  // 2. Direct client update fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error: updateErr } = await (supabase.from("chat_rooms") as any)
    .update({
      name: trimmedName,
      avatar_url: avatarUrl || null,
    })
    .eq("id", roomId);

  if (updateErr && updateErr.message.includes("avatar_url")) {
    // Fallback: update room name only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackRes = await (supabase.from("chat_rooms") as any)
      .update({ name: trimmedName })
      .eq("id", roomId);
    updateErr = fallbackRes.error;
  }

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Get updater username for system message
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const updaterName = (profile as { username?: string } | null)?.username || "방장";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("messages") as any).insert({
    room_id: roomId,
    sender_id: user.id,
    content: `${updaterName}님이 대화방 정보를 변경했습니다.`,
    message_type: "SYSTEM",
  });

  revalidatePath(`/chat/${roomId}`);
  revalidatePath("/chat");
  return { success: true };
}

export async function fetchOlderMessagesAction({
  roomId,
  beforeTimestamp,
  limit = 30,
}: {
  roomId: string;
  beforeTimestamp: string;
  limit?: number;
}): Promise<(Message & { sender?: Profile | null })[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Fetch participant joined_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myPart } = await (supabase.from("chat_participants") as any)
    .select("joined_at")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  const joinedAt = myPart?.joined_at || "1970-01-01T00:00:00Z";

  const { data } = await supabase
    .from("messages")
    .select("*, sender:profiles(*)")
    .eq("room_id", roomId)
    .lt("created_at", beforeTimestamp)
    .gte("created_at", joinedAt)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data || []) as unknown as (Message & { sender?: Profile | null })[]).reverse();
}

export async function fetchUserChatRoomsAction(): Promise<ChatRoom[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myParts } = await (supabase.from("chat_participants") as any)
    .select("room_id, last_read_at, left_at")
    .eq("user_id", user.id)
    .is("left_at", null);

  const myParticipations = (myParts || []) as {
    room_id: string;
    last_read_at: string;
    left_at: string | null;
  }[];

  if (myParticipations.length === 0) return [];

  const roomIds = myParticipations.map((p) => p.room_id);

  const [roomsRes, allPartsRes, allMsgsRes] = await Promise.all([
    supabase.from("chat_rooms").select("*").in("id", roomIds).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("chat_participants") as any)
      .select("room_id, user_id, joined_at, left_at, profile:profiles(*)")
      .in("room_id", roomIds)
      .is("left_at", null),
    supabase.from("messages").select("*").in("room_id", roomIds).order("created_at", { ascending: false }),
  ]);

  const roomsData = (roomsRes.data || []) as unknown as ChatRoom[];
  const allParticipants = (allPartsRes.data || []) as any[];
  const allMessages = (allMsgsRes.data || []) as any[];

  return roomsData
    .map((room) => {
      const myPart = myParticipations.find((p) => p.room_id === room.id);
      const roomParticipants = allParticipants.filter((p) => p.room_id === room.id);
      const otherParticipant = roomParticipants.find((p) => p.user_id !== user.id);
      const isSelfChat = !room.is_group && (roomParticipants.length === 1 || !otherParticipant);
      const myProfileObj = roomParticipants.find((p) => p.user_id === user.id)?.profile || null;
      const roomMessages = allMessages.filter((m) => m.room_id === room.id);
      const lastMessage = roomMessages[0] || null;

      const lastReadTime = myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : 0;
      const unreadCount = isSelfChat
        ? 0
        : roomMessages.filter(
            (m) => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadTime
          ).length;

      return {
        ...room,
        name: isSelfChat ? myProfileObj?.username || "나" : room.name,
        otherUser: isSelfChat ? myProfileObj : otherParticipant?.profile || null,
        participantCount: roomParticipants.length,
        last_message: lastMessage,
        unread_count: unreadCount,
      };
    })
    .sort((a, b) => {
      const timeA = a.last_message?.created_at
        ? new Date(a.last_message.created_at).getTime()
        : new Date(a.created_at).getTime();
      const timeB = b.last_message?.created_at
        ? new Date(b.last_message.created_at).getTime()
        : new Date(b.created_at).getTime();
      return timeB - timeA;
    });
}
