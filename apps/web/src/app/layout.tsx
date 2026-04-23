import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Noto_Serif_SC } from 'next/font/google';
import {
  OG_IMAGE_PATH,
  SHARE_IMAGE_ALT,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  TWITTER_IMAGE_PATH,
} from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { cn } from '@/lib/utils';
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'meathill', url: SITE_URL }],
  creator: 'meathill',
  publisher: 'meathill',
  category: 'productivity',
  keywords: ['MuiMemo', '口述备忘', '语音待办', 'AI 任务管理', '生产力工具'],
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: SHARE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [TWITTER_IMAGE_PATH],
  },
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
    title: SITE_NAME,
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
    <html lang="zh-CN" className={cn('h-full antialiased', inter.variable, serifSC.variable, mono.variable)}>
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
