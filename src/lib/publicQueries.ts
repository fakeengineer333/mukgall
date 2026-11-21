import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { Post } from "@/types";

export const POSTS_LIST_TAG = "posts-list";

export interface RawPostRow {
  id: number;
  title: string;
  author_id: string | null;
  created_at: string;
  view_count: number;
  like_count: number | null;
  is_notice?: boolean | null;
  image_urls: string[];
  deleted_at: string | null;
  author: Post["author"];
  comments: { count?: number; id?: number }[] | null;
}

export interface PublicGalleryPageResult {
  rawPosts: RawPostRow[];
  noticePosts: RawPostRow[];
  totalCount: number;
}

export function formatPostRows(rows: RawPostRow[]): Post[] {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const nowYear = nowKst.getUTCFullYear();
  const nowMonth = nowKst.getUTCMonth();
  const nowDate = nowKst.getUTCDate();

  return rows.map((p) => {
    let formatted_date = "";
    if (p.created_at) {
      const d = new Date(p.created_at);
      if (!Number.isNaN(d.getTime())) {
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

    const commentsCount = Array.isArray(p.comments)
      ? typeof p.comments[0]?.count === "number"
        ? p.comments[0].count
        : p.comments.length
      : 0;

    return {
      id: p.id,
      title: p.title,
      content: "",
      author_id: p.author_id,
      created_at: p.created_at,
      updated_at: p.created_at,
      view_count: p.view_count,
      like_count: p.like_count || 0,
      is_notice: Boolean(p.is_notice),
      image_urls: p.image_urls || [],
      deleted_at: p.deleted_at,
      author: p.author,
      comments_count: commentsCount,
      formatted_date,
    };
  });
}

export const getCachedPublicGalleryPage = unstable_cache(
  async (
    page: number,
    pageSize: number,
    tab: string
  ): Promise<PublicGalleryPageResult> => {
    const supabase = createPublicClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let postsQuery = supabase
      .from("posts")
      .select(
        "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(count)",
        { count: "exact" }
      )
      .is("deleted_at", null);

    if (tab === "recommend") {
      postsQuery = postsQuery
        .gte("like_count", 3)
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      if (tab === "image") {
        postsQuery = postsQuery.not("image_urls", "eq", "{}");
      }
      postsQuery = postsQuery.order("created_at", { ascending: false });
    }

    postsQuery = postsQuery.range(from, to);

    const noticesPromise =
      page === 1
        ? supabase
            .from("posts")
            .select(
              "id, title, author_id, created_at, view_count, like_count, is_notice, image_urls, deleted_at, author:profiles(id, username, avatar_url, role), comments:comments(count)"
            )
            .eq("is_notice", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] });

    const [postsRes, noticesRes] = await Promise.all([
      postsQuery,
      noticesPromise,
    ]);

    return {
      rawPosts: (postsRes.data || []) as unknown as RawPostRow[],
      noticePosts: (noticesRes.data || []) as unknown as RawPostRow[],
      totalCount: postsRes.count || 0,
    };
  },
  ["public-gallery-page"],
  {
    tags: [POSTS_LIST_TAG],
    revalidate: 30,
  }
);
