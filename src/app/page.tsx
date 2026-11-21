import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthProfile, getAuthUser } from "@/lib/auth";
import { fetchUserChatRoomsAction } from "@/app/actions/chat";
import { fetchUserActivityAction } from "@/app/actions/post";
import { HomeTabContainer } from "@/components/home/HomeTabContainer";
import { parsePositiveInt, sanitizePostgrestFilterValue } from "@/lib/urlSafety";
import {
  formatPostRows,
  getCachedPublicGalleryPage,
  PublicGalleryPageResult,
  RawPostRow,
} from "@/lib/publicQueries";
import { Post, ChatRoom, Comment } from "@/types";

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    search?: string;
    type?: string;
    view?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
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
  const page = parsePositiveInt(resolvedSearchParams.page, 1);
  const tab = resolvedSearchParams.tab || "all";
  const search = resolvedSearchParams.search || "";
  const type = resolvedSearchParams.type || "all";
  const initialView =
    (resolvedSearchParams.view as "gallery" | "chat" | "mypage") || "gallery";

  const [supabase, userProfile, user] = await Promise.all([
    createClient(),
    getAuthProfile(),
    getAuthUser(),
  ]);

  let formattedRooms: ChatRoom[] = [];
  let userPosts: Post[] = [];
  let userComments: Comment[] = [];

  const isAdmin = userProfile?.role === "ADMIN";
  const sanitizedSearch = sanitizePostgrestFilterValue(search);
  const canUsePublicCache =
    !isAdmin &&
    !sanitizedSearch &&
    page <= 5 &&
    (tab === "all" || tab === "recommend" || tab === "image");

  const galleryPromise: Promise<PublicGalleryPageResult> = canUsePublicCache
    ? getCachedPublicGalleryPage(page, PAGE_SIZE, tab)
    : (async () => {
        let postsQuery = supabase
          .from("posts")
          .select(
            "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(count)",
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

        if (sanitizedSearch) {
          if (type === "title") {
            postsQuery = postsQuery.ilike("title", `%${sanitizedSearch}%`);
          } else if (type === "content") {
            postsQuery = postsQuery.ilike("content", `%${sanitizedSearch}%`);
          } else if (type === "author") {
            const { data: matchingProfiles } = await supabase
              .from("profiles")
              .select("id")
              .ilike("username", `%${sanitizedSearch}%`);
            const userIds =
              (matchingProfiles as { id: string }[] | null)?.map((p) => p.id) ||
              [];
            if (userIds.length > 0) {
              postsQuery = postsQuery.in("author_id", userIds);
            } else {
              postsQuery = postsQuery.eq(
                "author_id",
                "00000000-0000-0000-0000-000000000000"
              );
            }
          } else {
            postsQuery = postsQuery.or(
              `title.ilike.%${sanitizedSearch}%,content.ilike.%${sanitizedSearch}%`
            );
          }
        }

        if (tab === "recommend") {
          postsQuery = postsQuery
            .order("like_count", { ascending: false })
            .order("created_at", { ascending: false });
        } else {
          postsQuery = postsQuery.order("created_at", { ascending: false });
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        postsQuery = postsQuery.range(from, to);

        const noticesPromise =
          page === 1
            ? (async () => {
                let nQuery = supabase
                  .from("posts")
                  .select(
                    "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(count)"
                  )
                  .eq("is_notice", true);
                if (!isAdmin) {
                  nQuery = nQuery.is("deleted_at", null);
                }
                nQuery = nQuery.order("created_at", { ascending: false });
                const { data } = await nQuery;
                return (data || []) as unknown as RawPostRow[];
              })()
            : Promise.resolve<RawPostRow[]>([]);

        const [postsRes, noticesData] = await Promise.all([
          postsQuery,
          noticesPromise,
        ]);

        return {
          rawPosts: (postsRes.data || []) as unknown as RawPostRow[],
          noticePosts: noticesData,
          totalCount: postsRes.count || 0,
        };
      })();

  let galleryResult: PublicGalleryPageResult;

  if (initialView === "chat" && user) {
    const [gRes, roomsData] = await Promise.all([
      galleryPromise,
      fetchUserChatRoomsAction(),
    ]);
    galleryResult = gRes;
    formattedRooms = roomsData;
  } else if (initialView === "mypage" && user) {
    const [gRes, activityData] = await Promise.all([
      galleryPromise,
      fetchUserActivityAction(),
    ]);
    galleryResult = gRes;
    userPosts = activityData.posts;
    userComments = activityData.comments;
  } else {
    galleryResult = await galleryPromise;
  }

  // Merge notices at top of Page 1 (avoid duplicate IDs)
  const combinedRawPosts =
    page === 1 && galleryResult.noticePosts.length > 0
      ? [
          ...galleryResult.noticePosts,
          ...galleryResult.rawPosts.filter((p) => !p.is_notice),
        ]
      : galleryResult.rawPosts;

  const posts = formatPostRows(combinedRawPosts);
  const totalCount = galleryResult.totalCount;

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
