"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    if (confirm("정말 로그아웃 하시겠습니까?")) {
      startTransition(async () => {
        await logoutAction();
      });
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      className="w-full gap-2 font-semibold"
      onClick={handleLogout}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          로그아웃 중...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          로그아웃
        </>
      )}
    </Button>
  );
}
