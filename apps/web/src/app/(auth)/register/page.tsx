'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signUp } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? email.split('@')[0]);
    const { error } = await signUp.email({
      email,
      password,
      name,
      callbackURL: '/app',
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? '注册失败，请稍后重试');
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink-mute">MuiMemo</p>
        <h1 className="font-serif text-3xl font-medium text-ink">开启你的口述备忘</h1>
        <p className="text-sm text-ink-soft">注册后立即开始录制。</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">昵称</span>
          <Input name="name" type="text" autoComplete="name" required size="lg" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">邮箱</span>
          <Input name="email" type="email" autoComplete="email" required size="lg" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">密码（≥ 8 位）</span>
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required size="lg" />
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          注册
        </Button>
      </form>

      <p className="text-center text-sm text-ink-soft">
        已有账号？{' '}
        <Link href="/login" className="text-accent-warm underline underline-offset-4">
          去登录
        </Link>
      </p>
    </div>
  );
}
