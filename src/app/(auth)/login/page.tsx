import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-8">
      <Suspense fallback={<div className="text-zinc-400 text-sm">로딩 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
