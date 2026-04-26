'use client';

import { LogOutIcon, MessageSquareIcon, RefreshCcwIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FeedbackDialog } from '@/components/memo/feedback-dialog';
import { TweaksPanel } from '@/components/memo/tweaks-panel';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

interface ProfileData {
  user: { name: string; email: string };
  stats: {
    total: number;
    pending: number;
    doing: number;
    done: number;
    doneToday: number;
  };
}

export function ProfileView() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/profile/stats', { cache: 'no-store' });
    if (res.ok) setData((await res.json()) as ProfileData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLogout() {
    await signOut();
    window.location.href = '/login';
  }

  function restartOnboarding() {
    try {
      window.localStorage.removeItem('muimemo:onboarded');
    } catch {}
    window.location.href = '/onboarding';
  }

  const initial = data?.user.name?.charAt(0)?.toUpperCase() ?? '·';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">MuiMemo · 我的</p>
        <h1 className="font-serif text-2xl text-ink">账号与数据</h1>
      </header>

      <section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper font-serif text-xl">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg text-ink truncate">{data?.user.name ?? '…'}</p>
            <p className="truncate text-xs text-ink-mute font-mono">{data?.user.email ?? ''}</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <StatCard label="今日已勾" value={data?.stats.doneToday ?? 0} accent />
        <StatCard label="累计完成" value={data?.stats.done ?? 0} />
        <StatCard label="清单待办" value={data?.stats.pending ?? 0} />
        <StatCard label="正在做" value={data?.stats.doing ?? 0} />
      </section>

      <TweaksPanel />

      <section className="mt-6 space-y-2">
        <Link
          href="/app/profile/log"
          className="flex w-full items-center justify-between rounded-xl border border-rule/60 bg-paper-2/60 px-4 py-3 text-left hover:bg-paper-2"
        >
          <span className="font-serif text-sm text-ink">输入记录</span>
          <span className="font-mono text-[10px] text-ink-mute">→</span>
        </Link>
        <button
          type="button"
          onClick={restartOnboarding}
          className="flex w-full items-center justify-between rounded-xl border border-rule/60 bg-paper-2/60 px-4 py-3 text-left hover:bg-paper-2"
        >
          <span className="font-serif text-sm text-ink">再看一次入门引导</span>
          <RefreshCcwIcon className="h-4 w-4 text-ink-mute" />
        </button>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-rule/60 bg-paper-2/60 px-4 py-3 text-left hover:bg-paper-2"
        >
          <span className="font-serif text-sm text-ink">意见反馈</span>
          <MessageSquareIcon className="h-4 w-4 text-ink-mute" />
        </button>
      </section>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} defaultContact={data?.user.email} />

      <section className="mt-6">
        <Button variant="outline" size="lg" className="w-full" onClick={handleLogout}>
          <LogOutIcon />
          退出登录
        </Button>
      </section>

      {loading ? <p className="mt-4 text-center text-xs text-ink-mute">加载中…</p> : null}

      <footer className="mt-8 text-center">
        <p className="font-mono text-[10px] tracking-[0.15em] text-ink-mute">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </footer>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        'rounded-2xl border p-4 ' +
        (accent ? 'border-accent-warm/40 bg-accent-warm/10' : 'border-rule/60 bg-paper-2/50')
      }
    >
      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">{label}</p>
      <p className="mt-1 font-serif text-3xl text-ink">{value}</p>
    </div>
  );
}
