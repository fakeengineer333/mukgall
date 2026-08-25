import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { HomeTabContainer } from "@/components/home/HomeTabContainer";
import { Post, Profile, ChatRoom, Comment } from "@/types";

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    search?: string;
    type?: string;
    view?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedSearchParams.page || "1", 10));
  const tab = resolvedSearchParams.tab || "all";
  const search = resolvedSearchParams.search || "";
  const type = resolvedSearchParams.type || "all";
  const initialView = (resolvedSearchParams.view as "gallery" | "chat" | "mypage") || "gallery";

  const [supabase, userProfile, user] = await Promise.all([
    createClient(),
    getAuthProfile(),
    getAuthUser(),
  ]);

  let formattedRooms: ChatRoom[] = [];
  let userPosts: Post[] = [];
  let userComments: Comment[] = [];

  const isAdmin = userProfile?.role === "ADMIN";

  // Build Supabase query for Gallery posts
  let postsQuery = supabase
    .from("posts")
    .select("*, author:profiles(*), comments:comments(id)", { count: "exact" });

  if (!isAdmin) {
    postsQuery = postsQuery.is("deleted_at", null);
  }

  if (tab === "recommend") {
    postsQuery = postsQuery.gte("like_count", 3);
  } else if (tab === "image") {
    postsQuery = postsQuery.not("image_urls", "eq", "{}");
  }

  if (search.trim()) {
    const q = search.trim();
    if (type === "title") {
      postsQuery = postsQuery.ilike("title", `%${q}%`);
    } else if (type === "content") {
      postsQuery = postsQuery.ilike("content", `%${q}%`);
    } else {
      postsQuery = postsQuery.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    }
  }

  if (tab === "recommend") {
    postsQuery = postsQuery.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    postsQuery = postsQuery.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  postsQuery = postsQuery.range(from, to);

  // Parallel Batch 1: Execute Gallery Posts query + User Activity & Participation queries simultaneously
  if (user) {
    const [postsRes, myPartsRes, userPostsRes, userCommentsRes] = await Promise.all([
      postsQuery,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("chat_participants") as any)
        .select("room_id, last_read_at, left_at")
        .eq("user_id", user.id)
        .is("left_at", null),
      supabase.from("posts").select("*").eq("author_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("comments").select("*").eq("author_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    ]);

    var rawPosts = postsRes.data;
    var count = postsRes.count;
    userPosts = ((userPostsRes as any)?.data || []) as Post[];
    userComments = ((userCommentsRes as any)?.data || []) as Comment[];

    const myParticipations = (myPartsRes.data || []) as {
      room_id: string;
      last_read_at: string;
      left_at: string | null;
    }[];

    if (myParticipations.length > 0) {
      const roomIds = myParticipations.map((p) => p.room_id);

      const [roomsRes, allPartsRes, allMsgsRes] = await Promise.all([
        supabase.from("chat_rooms").select("*").in("id", roomIds).order("created_at", { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("chat_participants") as any).select("room_id, user_id, joined_at, left_at, profile:profiles(*)").in("room_id", roomIds).is("left_at", null),
        supabase.from("messages").select("*").in("room_id", roomIds).order("created_at", { ascending: false }),
      ]);

      const roomsData = (roomsRes.data || []) as unknown as ChatRoom[];
      const allParticipants = (allPartsRes.data || []) as any[];
      const allMessages = (allMsgsRes.data || []) as any[];

      formattedRooms = roomsData.map((room) => {
        const myPart = myParticipations.find((p) => p.room_id === room.id);
        const roomParticipants = allParticipants.filter((p) => p.room_id === room.id);
        const otherParticipant = roomParticipants.find((p) => p.user_id !== user.id);
        const roomMessages = allMessages.filter((m) => m.room_id === room.id);
        const lastMessage = roomMessages[0] || null;

        const lastReadTime = myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : 0;
        const unreadCount = roomMessages.filter(
          (m) => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadTime
        ).length;

        return {
          ...room,
          otherUser: otherParticipant?.profile || null,
          participantCount: roomParticipants.length,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      }).sort((a, b) => {
        const timeA = a.last_message?.created_at
          ? new Date(a.last_message.created_at).getTime()
          : new Date(a.created_at).getTime();
        const timeB = b.last_message?.created_at
          ? new Date(b.last_message.created_at).getTime()
          : new Date(b.created_at).getTime();
        return timeB - timeA;
      });
    }
  } else {
    const postsRes = await postsQuery;
    var rawPosts = postsRes.data;
    var count = postsRes.count;
  }

  // Format comments_count and precompute formatted_date
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const nowYear = nowKst.getUTCFullYear();
  const nowMonth = nowKst.getUTCMonth();
  const nowDate = nowKst.getUTCDate();

  const posts: Post[] = (rawPosts || []).map((p: any) => {
    let formatted_date = "";
    if (p.created_at) {
      const d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
        const isToday =
          kst.getUTCFullYear() === nowYear &&
          kst.getUTCMonth() === nowMonth &&
          kst.getUTCDate() === nowDate;

        if (isToday) {
          const hh = String(kst.getUTCHours()).padStart(2, "0");
          const mm = String(kst.getUTCMinutes()).padStart(2, "0");
          formatted_date = `${hh}:${mm}`;
        } else {
          const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(kst.getUTCDate()).padStart(2, "0");
          formatted_date = `${mm}.${dd}`;
        }
      }
    }

    return {
      ...p,
      comments_count: Array.isArray(p.comments) ? p.comments.length : 0,
      like_count: p.like_count || 0,
      formatted_date,
    };
  });

  const totalCount = count || 0;

  return (
    <HomeTabContainer
      initialView={initialView}
      userProfile={userProfile}
      galleryProps={{
        posts,
        totalCount,
        currentPage: page,
        pageSize: PAGE_SIZE,
        currentTab: tab,
        searchQuery: search,
        searchType: type,
        isAdmin,
      }}
      chatProps={{
        rooms: formattedRooms,
        currentUserId: user?.id,
      }}
      myPageProps={{
        posts: userPosts,
        comments: userComments,
      }}
    />
  );
}
