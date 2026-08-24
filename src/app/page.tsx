import Link from "next/link";
import Image from "next/image";
import { MessageSquare, PenSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DcPostList } from "@/components/gallery/DcPostList";
import { Button } from "@/components/ui/button";
import { Post, Profile } from "@/types";

interface HomePageProps {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    search?: string;
    type?: string;
  }>;
}

const PAGE_SIZE = 15;

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedSearchParams.page || "1", 10));
  const tab = resolvedSearchParams.tab || "all";
  const search = resolvedSearchParams.search || "";
  const type = resolvedSearchParams.type || "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile: Profile | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    userProfile = profile as unknown as Profile;
  }

  const isAdmin = userProfile?.role === "ADMIN";

  // Build Supabase query
  let query = supabase
    .from("posts")
    .select("*, author:profiles(*), comments:comments(id)", { count: "exact" });

  // Hide soft-deleted unless admin
  if (!isAdmin) {
    query = query.is("deleted_at", null);
  }

  // Filter by Tab
  if (tab === "recommend") {
    // 개념글: 추천수 3개 이상 (개념글 컷: 3추)
    query = query.gte("like_count", 3);
  } else if (tab === "image") {
    // 사진: image_urls가 비어있지 않은 글
    query = query.not("image_urls", "eq", "{}");
  }

  // Search Filter
  if (search.trim()) {
    const q = search.trim();
    if (type === "title") {
      query = query.ilike("title", `%${q}%`);
    } else if (type === "content") {
      query = query.ilike("content", `%${q}%`);
    } else {
      // all / title+content
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    }
  }

  // Sorting
  if (tab === "recommend") {
    query = query.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Pagination Range
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data: rawPosts, count } = await query;

  // Format comments_count and precompute formatted_date for zero-hydration-mismatch
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
    <div className="flex flex-col space-y-5 pb-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/80 via-zinc-900 to-indigo-950/80 p-5 sm:p-6 border border-blue-900/30 shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Image
              src="/icons/icon-192.png"
              alt="묵호 갤러리"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-2xl border border-zinc-700/80 shadow-md object-cover"
              priority
            />
            <div className="space-y-0.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                묵호 갤러리
              </h1>
              <p className="text-xs text-zinc-400">
                반갑다. 묵호 갤러리다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/posts/create">
              <Button size="sm" className="gap-1.5 font-bold shadow-md shadow-blue-600/20 text-xs">
                <PenSquare className="h-3.5 w-3.5" />
                글쓰기
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                채팅
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* DCInside Style Board List with Pagination */}
      <DcPostList
        posts={posts}
        totalCount={totalCount}
        currentPage={page}
        pageSize={PAGE_SIZE}
        currentTab={tab}
        searchQuery={search}
        searchType={type}
        isAdmin={isAdmin}
      />
    </div>
  );
}
