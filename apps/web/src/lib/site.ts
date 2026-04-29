import type { Metadata } from 'next';

const FALLBACK_SITE_URL = 'https://muimemo.roudan.io';

function normalizeSiteUrl(value?: string) {
  return value?.replace(/\/+$/, '') || FALLBACK_SITE_URL;
}

export const SITE_NAME = '叨叨记';
export const SITE_TAGLINE = '口述备忘';
export const SITE_TITLE = `${SITE_NAME} · ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION = '说一句话，AI 就把小事收成待办。叨叨记是意图驱动的 AI 语音轻量任务调度工具。';
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_EMAIL = 'meathill@gmail.com';
export const OG_IMAGE_PATH = '/opengraph-image';
export const TWITTER_IMAGE_PATH = '/twitter-image';
export const SHARE_IMAGE_ALT = '叨叨记：说一句话，AI 就把小事收成待办。';

export type MarketingLink = {
  href: string;
  label: string;
};

export type PublicRoute = MarketingLink & {
  changeFrequency: 'weekly' | 'monthly' | 'yearly';
  priority: number;
};

export const LANDING_HEADER_LINKS: MarketingLink[] = [
  { href: '#what', label: '是什么' },
  { href: '#scenes', label: '场景' },
  { href: '#faq', label: 'FAQ' },
];

export const MARKETING_HEADER_LINKS: MarketingLink[] = [
  { href: '/', label: '首页' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export const PUBLIC_SITE_ROUTES: PublicRoute[] = [
  { href: '/', label: '首页', changeFrequency: 'weekly', priority: 1 },
  { href: '/about', label: 'About', changeFrequency: 'monthly', priority: 0.8 },
  { href: '/contact', label: 'Contact', changeFrequency: 'monthly', priority: 0.6 },
  { href: '/privacy', label: 'Privacy', changeFrequency: 'yearly', priority: 0.4 },
  { href: '/terms', label: 'Terms', changeFrequency: 'yearly', priority: 0.4 },
];

const DEFAULT_KEYWORDS = ['叨叨记', 'MuiMemo', '口述备忘', '语音待办', 'AI 任务管理', '语音记录', '生产力工具'];

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function buildPageTitle(title?: string) {
  return title ? `${title} · ${SITE_NAME}` : SITE_TITLE;
}

export function createMarketingMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
  keywords = [],
}: {
  title?: string;
  description?: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const fullTitle = buildPageTitle(title);

  return {
    title,
    description,
    keywords: [...DEFAULT_KEYWORDS, ...keywords],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
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
      title: fullTitle,
      description,
      images: [TWITTER_IMAGE_PATH],
    },
  };
}

export const NO_INDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
