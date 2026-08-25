export default function PostDetailLoading() {
  return (
    <div className="py-4 space-y-6 animate-pulse">
      {/* Top back button skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-16 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Main Post Card Skeleton */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 p-5 sm:p-7 shadow-xl space-y-5">
        {/* Author info & Date */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
          <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Post Title */}
        <div className="h-7 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />

        {/* Post Image Placeholder */}
        <div className="h-64 sm:h-80 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800/80" />

        {/* Post Body Content Lines */}
        <div className="space-y-2.5 pt-2">
          <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800/80" />
          <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800/80" />
          <div className="h-4 w-4/6 rounded bg-zinc-200 dark:bg-zinc-800/80" />
        </div>

        {/* Upvote Button Skeleton */}
        <div className="pt-4 flex justify-center">
          <div className="h-12 w-28 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Comments Section Skeleton */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 p-5 shadow-xl space-y-4">
        <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
        {/* Comment Input */}
        <div className="h-14 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />

        {/* Comment Items */}
        <div className="space-y-3 pt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/40">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
