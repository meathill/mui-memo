'use client';

import { useEffect, useState } from 'react';

/**
 * 按固定节奏重新 render，让基于 Date.now() 的相对时间 label 能自己更新。
 * 页面隐藏时暂停、可见时立刻 tick 一次拉新。
 */
export function useNowTick(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      setNow(Date.now());
      if (timer) clearInterval(timer);
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [intervalMs]);

  return now;
}
