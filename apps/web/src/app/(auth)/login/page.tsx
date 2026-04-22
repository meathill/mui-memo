"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const { error } = await signIn.email({
      email,
      password,
      callbackURL: "/",
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "登录失败，请检查邮箱与密码");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink-mute">
          MuiMemo
        </p>
        <h1 className="font-serif text-3xl font-medium text-ink">欢迎回来</h1>
        <p className="text-sm text-ink-soft">说一句话，把琐事记下来。</p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">邮箱</span>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            size="lg"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-soft">密码</span>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            size="lg"
          />
        </label>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          登录
        </Button>
      </form>

      <p className="text-center text-sm text-ink-soft">
        还没有账号？{" "}
        <Link
          href="/register"
          className="text-accent-warm underline underline-offset-4"
        >
          去注册
        </Link>
      </p>
    </div>
  );
}
