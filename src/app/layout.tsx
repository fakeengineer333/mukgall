import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { PwaRegister } from "@/components/common/PwaRegister";
import { PwaInstallPrompt } from "@/components/common/PwaInstallPrompt";
import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types";

export const metadata: Metadata = {
  title: "묵호 갤러리",
  description: "PWA 기반 커뮤니티형 이미지 갤러리 및 실시간 메시징 플랫폼",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "묵호 갤러리",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192" },
      { url: "/icons/icon-512.png", sizes: "512x512" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userProfile: Profile | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        userProfile = profile as unknown as Profile;
      }
    }
  } catch {
    // Graceful fallback during setup or offline
    userProfile = null;
  }

  return (
    <html lang="ko" className="h-full antialiased dark font-sans">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-blue-600 selection:text-white">
        <PwaRegister />
        <Header userProfile={userProfile} />
        
        {/* Main App Container */}
        <main className="flex-1 pb-20 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4">
          {children}
        </main>

        <PwaInstallPrompt />
        <BottomNav userRole={userProfile?.role} currentUserId={userProfile?.id} />
      </body>
    </html>
  );
}
