"use client";

import { RefreshCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 配合 usePullToRefresh 展示顶部的下拉条。pullOffset 是 0~1.2 的阻尼值。
 * 另外也提供一个显式的「刷新」按钮，桌面和 e2e 都能点。
 */
export function PullIndicator({
  pullOffset,
  refreshing,
  onManualRefresh,
}: {
  pullOffset: number;
  refreshing: boolean;
  onManualRefresh: () => void;
}) {
  const ready = pullOffset >= 1;
  const visible = refreshing || pullOffset > 0.05;

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none flex items-center justify-center text-ink-mute transition-opacity",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          height: `${Math.min(pullOffset, 1) * 48}px`,
        }}
      >
        <RefreshCcwIcon
          className={cn(
            "h-4 w-4 transition-transform",
            refreshing && "animate-spin",
            !refreshing && ready && "rotate-180",
          )}
        />
      </div>
      <button
        type="button"
        onClick={onManualRefresh}
        aria-label="刷新"
        className={cn(
          "absolute right-3 top-5 flex h-7 w-7 items-center justify-center rounded-full border border-rule/60 bg-paper-2/70 text-ink-mute transition-colors hover:text-ink",
          refreshing && "animate-spin",
        )}
        data-testid="manual-refresh"
      >
        <RefreshCcwIcon className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
