'use client';

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2Icon, HomeIcon, ListIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/app', label: '今天', icon: HomeIcon },
  { href: '/app/all', label: '全部', icon: ListIcon },
  { href: '/app/completed', label: '已完成', icon: CheckCircle2Icon },
  { href: '/app/profile', label: '我的', icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule/60 bg-paper/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {ITEMS.map((it) => {
          const active = it.href === '/app' ? pathname === '/app' : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
                  active ? 'text-ink' : 'text-ink-mute hover:text-ink-soft',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
