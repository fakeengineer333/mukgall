"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto rounded-2xl border border-blue-500/40 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/icons/icon-192.png"
            alt="묵갤 앱 아이콘"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-2xl border border-zinc-700/80 shadow-md object-cover"
          />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white">묵갤 앱 설치하기</p>
            <p className="text-[11px] text-zinc-400">
              홈 화면에 추가하여 더 빠르고 편리한 앱 경험을 누려보세요.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowPrompt(false)}
          className="rounded-lg p-1 text-zinc-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="w-full gap-1.5 font-bold shadow-md shadow-blue-600/30"
          onClick={handleInstall}
        >
          <Download className="h-3.5 w-3.5" />
          홈 화면에 추가
        </Button>
      </div>
    </div>
  );
}
