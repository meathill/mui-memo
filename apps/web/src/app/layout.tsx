import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Noto_Serif_SC } from 'next/font/google';
import './globals.css';

const GA_ID = 'G-JXVMLJYDYZ';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const serifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-serif',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'MuiMemo · 口述备忘',
  description: '意图驱动的 AI 语音轻量任务调度',
  applicationName: 'MuiMemo',
  manifest: '/manifest.webmanifest',
  icons: {
    other: [
      {
        rel: 'mask-icon',
        url: '/brand/safari-pinned-tab.svg',
        color: '#1d1a12',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'MuiMemo',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4ede0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn('h-full antialiased', inter.variable, serifSC.variable, mono.variable)}
    >
      <body className="bg-paper text-ink min-h-full flex flex-col font-sans">
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 主题早注入脚本，读 localStorage 防 FOUC
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
      </body>
      {process.env.NODE_ENV === 'production' && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
