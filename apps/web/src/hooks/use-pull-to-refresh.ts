"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const DAMPEN = 2.2;

/**
 * 给整个 window 绑一个下拉刷新手势：
 * - 只在 scrollY === 0 且向下拉时响应
 * - 拉够 THRESHOLD 松开 → 触发 onRefresh
 * - 返回 `pullOffset`（0~1.2）供上方 banner 做阻尼视觉
 *
 * 刻意不接 `preventDefault`（会触发 passive 警告），浏览器默认
 * overscroll 动作会并存但无副作用。
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullOffset, setPullOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);

  const trigger = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPullOffset(0);
    }
  }, [onRefresh, refreshing]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      activeRef.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullOffset(0);
        activeRef.current = false;
        return;
      }
      activeRef.current = true;
      setPullOffset(Math.min(dy / (THRESHOLD * DAMPEN), 1.2));
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (!activeRef.current) return;
      activeRef.current = false;
      const ready = pullOffset >= 1;
      if (ready) await trigger();
      else setPullOffset(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pullOffset, trigger]);

  return { pullOffset, refreshing, trigger };
}
