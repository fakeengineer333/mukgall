export default function ChatRoomLoading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] sm:h-[calc(100dvh-9rem)] -mx-4 -mt-4 sm:mx-auto sm:-mt-2 sm:max-w-2xl sm:rounded-2xl border-0 sm:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sm:shadow-2xl overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-1">
            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Messages List Skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {/* Date divider skeleton */}
        <div className="flex justify-center">
          <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {/* Incoming message bubble */}
        <div className="flex items-start gap-2.5 max-w-[80%]">
          <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <div className="space-y-1">
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-10 w-44 rounded-2xl rounded-tl-none bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Outgoing message bubble */}
        <div className="flex justify-end">
          <div className="h-10 w-52 rounded-2xl rounded-tr-none bg-blue-500/30 dark:bg-blue-600/30" />
        </div>

        {/* Incoming message bubble 2 */}
        <div className="flex items-start gap-2.5 max-w-[80%]">
          <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <div className="space-y-1">
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-14 w-60 rounded-2xl rounded-tl-none bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Outgoing message bubble 2 */}
        <div className="flex justify-end">
          <div className="h-8 w-36 rounded-2xl rounded-tr-none bg-blue-500/30 dark:bg-blue-600/30" />
        </div>
      </div>

      {/* Bottom Input Skeleton */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex gap-2 items-center">
        <div className="h-10 w-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-10 flex-1 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-10 w-14 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
