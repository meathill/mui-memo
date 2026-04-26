'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { CHECK_ANIMS, type CheckAnim, readCheckAnim, writeCheckAnim } from '@/lib/settings';
import { readTheme, THEMES, type Theme, writeTheme } from '@/lib/theme';

export function TweaksPanel() {
  const [theme, setTheme] = useState<Theme>('paper');
  const [anim, setAnim] = useState<CheckAnim>('strike');

  useEffect(() => {
    setTheme(readTheme());
    setAnim(readCheckAnim());
  }, []);

  function handleTheme(next: Theme) {
    setTheme(next);
    writeTheme(next);
    track({ name: 'theme_change', theme: next });
  }

  function handleAnim(next: CheckAnim) {
    setAnim(next);
    writeCheckAnim(next);
  }

  return (
    <section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-sm text-ink">Tweaks</h2>
        <span className="font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">偏好</span>
      </header>

      <Group label="主题">
        {THEMES.map((t) => (
          <OptionCard
            key={t.value}
            label={t.label}
            hint={t.hint}
            active={theme === t.value}
            onClick={() => handleTheme(t.value)}
          />
        ))}
      </Group>

      <div className="mt-4">
        <Group label="勾选动画">
          {CHECK_ANIMS.map((a) => (
            <OptionCard
              key={a.value}
              label={a.label}
              hint={a.hint}
              active={anim === a.value}
              onClick={() => handleAnim(a.value)}
            />
          ))}
        </Group>
      </div>
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">{label}</p>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function OptionCard({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-xl border px-3 py-2 text-left transition ' +
        (active ? 'border-accent-warm/60 bg-accent-warm/10' : 'border-rule/60 bg-paper hover:bg-paper-2')
      }
    >
      <p className="font-serif text-sm text-ink">{label}</p>
      <p className="font-mono text-[10px] text-ink-mute">{hint}</p>
    </button>
  );
}
