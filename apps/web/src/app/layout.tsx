import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Serif_SC } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MuiMemo · 口述备忘",
  description: "意图驱动的 AI 语音轻量任务调度",
  applicationName: "MuiMemo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MuiMemo",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4ede0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn(
        "h-full antialiased",
        inter.variable,
        serifSC.variable,
        mono.variable,
      )}
    >
      <body className="bg-paper text-ink min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
