export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse py-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-1.5">
            <div className="h-6 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-52 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Stats Cards Skeleton (5 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 space-y-2">
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Table Section Skeleton */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-5 space-y-4">
        <div className="h-6 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
