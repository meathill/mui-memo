'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
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
    const { error } = await signIn.email({
      email,
      password,
      callbackURL: '/app',
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? '登录失败，请检查邮箱与密码');
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink-mute">MuiMemo</p>
        <h1 className="font-serif text-3xl font-medium text-ink">欢迎回来</h1>
        <p className="text-sm text-ink-soft">说一句话，把琐事记下来。</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-xs font-medium text-ink-soft">
            邮箱
          </label>
          <Input id="login-email" name="email" type="email" autoComplete="email" required size="lg" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="login-password" className="block text-xs font-medium text-ink-soft">
            密码
          </label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            size="lg"
          />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          登录
        </Button>
      </form>

      <p className="text-center text-sm text-ink-soft">
        还没有账号？{' '}
        <Link href="/register" className="text-accent-warm underline underline-offset-4">
          去注册
        </Link>
      </p>
    </div>
  );
}
