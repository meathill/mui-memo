"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { readTheme, type Theme, THEMES, writeTheme } from "@/lib/theme";

export function TweaksPanel() {
  const [theme, setTheme] = useState<Theme>("paper");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function handlePick(next: Theme) {
    setTheme(next);
    writeTheme(next);
    track({ name: "theme_change", theme: next });
  }

  return (
    <section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-sm text-ink">Tweaks</h2>
        <span className="font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">
          偏好
        </span>
      </header>

      <div>
        <p className="mb-2 font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">
          主题
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handlePick(t.value)}
                aria-pressed={active}
                className={
                  "rounded-xl border px-3 py-2 text-left transition " +
                  (active
                    ? "border-accent-warm/60 bg-accent-warm/10"
                    : "border-rule/60 bg-paper hover:bg-paper-2")
                }
              >
                <p className="font-serif text-sm text-ink">{t.label}</p>
                <p className="font-mono text-[10px] text-ink-mute">{t.hint}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
