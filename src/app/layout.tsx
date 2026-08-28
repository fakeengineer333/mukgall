import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { PwaRegister } from "@/components/common/PwaRegister";
import { PwaInstallPrompt } from "@/components/common/PwaInstallPrompt";
import { TopProgressBar } from "@/components/common/TopProgressBar";
import { getAuthProfile } from "@/lib/auth";
import { Profile } from "@/types";
import { ChatProvider } from "@/providers/ChatProvider";

export const metadata: Metadata = {
  title: {
    default: "묵호 갤러리",
    template: "%s - 묵호 갤러리",
  },
  description: "묵호 커뮤니티 사이트",
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
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userProfile = await getAuthProfile();

  return (
    <html lang="ko" className="h-full antialiased font-sans" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://hlligntpburfectcfycc.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://hlligntpburfectcfycc.supabase.co" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-blue-600 selection:text-white transition-colors" suppressHydrationWarning>
        <ChatProvider currentUserId={userProfile?.id}>
          <Suspense fallback={null}>
            <TopProgressBar />
          </Suspense>
          <PwaRegister />
          <Header userProfile={userProfile} />
          
          {/* Main App Container */}
          <main className="flex-1 pb-20 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4">
            {children}
          </main>

          <PwaInstallPrompt />
          <Suspense fallback={null}>
            <BottomNav userRole={userProfile?.role} currentUserId={userProfile?.id} />
          </Suspense>
        </ChatProvider>
      </body>
    </html>
  );
}
