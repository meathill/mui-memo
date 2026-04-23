'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button-variants';
import { useSession } from '@/lib/auth-client';

export function MarketingHeaderAuthLink() {
  const { data } = useSession();
  const authed = Boolean(data?.user);

  if (authed) {
    return (
      <Link href="/app" className="text-accent-warm hover:text-ink">
        进入应用 →
      </Link>
    );
  }

  return (
    <Link href="/login" className="hover:text-ink">
      登录
    </Link>
  );
}

export function MarketingHeroActions() {
  const { data } = useSession();
  const authed = Boolean(data?.user);

  if (authed) {
    return (
      <Link href="/app" className={`${buttonVariants({ size: 'lg' })} px-6`}>
        进入应用
      </Link>
    );
  }

  return (
    <>
      <Link href="/register" className={`${buttonVariants({ size: 'lg' })} px-6`}>
        免费注册
      </Link>
      <Link
        href="/login"
        className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-soft uppercase underline-offset-4 hover:text-ink hover:underline sm:text-[0.8rem]"
      >
        已有账号 · 登录
      </Link>
    </>
  );
}
