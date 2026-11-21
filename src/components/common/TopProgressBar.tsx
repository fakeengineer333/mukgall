"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [loadingFromRoute, setLoadingFromRoute] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
  };

  // Finish progress asynchronously when route changes
  useEffect(() => {
    if (!loadingFromRoute || loadingFromRoute === routeKey) {
      return;
    }

    clearTimers();
    const finishTimer = setTimeout(() => {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setLoadingFromRoute(null);
        setProgress(0);
      }, 400);
      timersRef.current.push(hideTimer);
    }, 0);
    timersRef.current.push(finishTimer);

    return () => {
      clearTimers();
    };
  }, [loadingFromRoute, routeKey]);

  // Start progress on internal link click
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        targetAttr !== "_blank" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          clearTimers();
          const currentRouteKey = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
          setLoadingFromRoute(currentRouteKey);
          setProgress(35);
          const t1 = setTimeout(
            () => setProgress((p) => (p < 75 ? 75 : p)),
            150
          );
          const t2 = setTimeout(
            () => setProgress((p) => (p < 90 ? 90 : p)),
            350
          );
          timersRef.current.push(t1, t2);
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      clearTimers();
    };
  }, []);

  if (!loadingFromRoute && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] h-[3px] pointer-events-none overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.9)]"
        style={{
          transform: `translateX(-${100 - progress}%)`,
          opacity: progress === 100 ? 0 : 1,
          transition:
            progress === 100
              ? "transform 200ms ease-out, opacity 250ms 150ms ease-out"
              : "transform 250ms cubic-bezier(0.1, 0.5, 0.1, 1)",
        }}
      />
    </div>
  );
}
