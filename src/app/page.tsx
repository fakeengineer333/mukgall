import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { fetchUserChatRoomsAction } from "@/app/actions/chat";
import { fetchUserActivityAction } from "@/app/actions/post";
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

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const view = resolved.view;
  if (view === "chat") {
    return { title: "채팅" };
  }
  if (view === "mypage") {
    return { title: "마이페이지" };
  }
  return {
    title: {
      absolute: "묵호 갤러리",
    },
    description: "묵호 커뮤니티 사이트",
  };
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

  // Build Supabase query for Gallery posts (Optimized column projection)
  let postsQuery = supabase
    .from("posts")
    .select(
      "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(id)",
      { count: "exact" }
    );

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
    } else if (type === "author") {
      const { data: matchingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", `%${q}%`);
      const userIds = (matchingProfiles as { id: string }[] | null)?.map((p) => p.id) || [];
      if (userIds.length > 0) {
        postsQuery = postsQuery.in("author_id", userIds);
      } else {
        postsQuery = postsQuery.eq("author_id", "00000000-0000-0000-0000-000000000000");
      }
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

  let rawPosts: any[] | null = null;
  let count: number | null = null;
  let noticePosts: any[] = [];

  // Fetch notices on page 1
  const noticesPromise =
    page === 1
      ? (async () => {
          let nQuery = supabase
            .from("posts")
            .select(
              "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(id)"
            )
            .eq("is_notice", true);
          if (!isAdmin) {
            nQuery = nQuery.is("deleted_at", null);
          }
          nQuery = nQuery.order("created_at", { ascending: false });
          const { data } = await nQuery;
          return data || [];
        })()
      : Promise.resolve([]);

  if (initialView === "chat" && user) {
    const [postsRes, roomsData, noticesData] = await Promise.all([
      postsQuery,
      fetchUserChatRoomsAction(),
      noticesPromise,
    ]);
    rawPosts = postsRes.data;
    count = postsRes.count;
    formattedRooms = roomsData;
    noticePosts = noticesData;
  } else if (initialView === "mypage" && user) {
    const [postsRes, activityData, noticesData] = await Promise.all([
      postsQuery,
      fetchUserActivityAction(),
      noticesPromise,
    ]);
    rawPosts = postsRes.data;
    count = postsRes.count;
    userPosts = activityData.posts;
    userComments = activityData.comments;
    noticePosts = noticesData;
  } else {
    // Default fast-path: Only fetch gallery feed & notices
    const [postsRes, noticesData] = await Promise.all([postsQuery, noticesPromise]);
    rawPosts = postsRes.data;
    count = postsRes.count;
    noticePosts = noticesData;
  }

  // Merge notices at top of Page 1 (avoid duplicate IDs)
  const combinedRawPosts =
    page === 1 && noticePosts.length > 0
      ? [...noticePosts, ...(rawPosts || []).filter((p: any) => !p.is_notice)]
      : rawPosts || [];

  // Format comments_count and precompute formatted_date
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const nowYear = nowKst.getUTCFullYear();
  const nowMonth = nowKst.getUTCMonth();
  const nowDate = nowKst.getUTCDate();

  const posts: Post[] = combinedRawPosts.map((p: any) => {
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
      is_notice: Boolean(p.is_notice),
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
