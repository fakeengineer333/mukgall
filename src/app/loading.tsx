export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero Banner Skeleton */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800/60" />
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* DC Style Board Container Skeleton */}
      <div className="space-y-3">
        {/* Tab Buttons & Search Header Skeleton */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="h-7 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-7 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-7 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-8 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Board Table Skeleton */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
            <div className="col-span-1 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="col-span-6 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="col-span-2 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="col-span-1 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="col-span-1 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="col-span-1 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Table Rows (8 rows) */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 sm:px-4 sm:py-3.5 flex sm:grid sm:grid-cols-12 gap-3 items-center">
                <div className="hidden sm:block sm:col-span-1 h-4 w-6 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 sm:col-span-6 space-y-1.5">
                  <div
                    className="h-4 rounded bg-zinc-200 dark:bg-zinc-800"
                    style={{ width: `${60 + (i % 4) * 10}%` }}
                  />
                  <div className="sm:hidden h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800/60" />
                </div>
                <div className="hidden sm:block sm:col-span-2 h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="hidden sm:block sm:col-span-1 h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="hidden sm:block sm:col-span-1 h-4 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="hidden sm:block sm:col-span-1 h-4 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Pagination Skeleton */}
        <div className="flex items-center justify-center gap-1.5 py-4">
          <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
