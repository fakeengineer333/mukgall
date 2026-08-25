"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Finish progress on route update
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setTimeout(() => setProgress(0), 200);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

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
          setLoading(true);
          setProgress(35);
          const t1 = setTimeout(() => setProgress((p) => (p < 75 ? 75 : p)), 150);
          const t2 = setTimeout(() => setProgress((p) => (p < 90 ? 90 : p)), 350);
          return () => {
            clearTimeout(t1);
            clearTimeout(t2);
          };
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, []);

  if (!loading && progress === 0) return null;

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
