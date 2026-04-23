import { MicIcon, SearchIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getServerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getServerSession();
  const authed = Boolean(session);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pt-16 pb-20 sm:pt-24">
      <header className="text-center">
        <p className="font-mono text-[10px] tracking-[0.3em] text-ink-mute uppercase">
          MuiMemo
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          说一句话，
          <br />
          就是一条备忘
        </h1>
        <p className="mt-6 font-serif text-base text-ink-soft sm:text-lg">
          AI 语音驱动的轻量任务调度，意图闭环，无需动手。
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {authed ? (
            <Link
              href="/app"
              className={buttonVariants({ size: "lg" }) + " w-full sm:w-auto"}
            >
              进入应用
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className={buttonVariants({ size: "lg" }) + " w-full sm:w-auto"}
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className={
                  buttonVariants({ size: "lg", variant: "outline" }) +
                  " w-full sm:w-auto"
                }
              >
                登录
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<MicIcon className="h-5 w-5" />}
          title="语音一句话"
          body="按住说出想法，AI 自动提取意图、时间、地点、优先级。不需要分字段填表。"
        />
        <FeatureCard
          icon={<SparklesIcon className="h-5 w-5" />}
          title="意图驱动"
          body="新建 / 完成 / 关联 / 补登，由模型判断；过期任务红标提醒，AI 会给调度建议。"
        />
        <FeatureCard
          icon={<SearchIcon className="h-5 w-5" />}
          title="AI 混合搜索"
          body="TiDB 向量 + 全文混合检索，RRF 融合排序。说「上次那个」也能找得到。"
        />
      </section>

      <section className="mt-16 rounded-2xl border border-rule/60 bg-paper-2/50 p-6 text-center">
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          Roadmap
        </p>
        <p className="mt-3 font-serif text-lg text-ink">
          iOS App 开发中 —— Siri 入口、端侧 ASR、Live Activity
        </p>
        <p className="mt-2 font-mono text-xs text-ink-mute">
          Web 版负责验证语音能力，native 负责把体验做到位。
        </p>
      </section>

      <footer className="mt-auto pt-16 text-center font-mono text-[10px] tracking-[0.15em] text-ink-mute">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-warm/15 text-accent-warm">
        {icon}
      </div>
      <h2 className="mt-4 font-serif text-lg text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </article>
  );
}
