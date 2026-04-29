type GAEvent =
  | { name: 'voice_intent'; intent?: string; durationMs?: number }
  | { name: 'task_complete'; source: 'today' | 'all' }
  | { name: 'task_delete'; source: 'detail' | 'completed' }
  | { name: 'task_reopen'; source: 'detail' | 'completed' }
  | { name: 'theme_change'; theme: string };

type GTag = (command: 'event', name: string, params?: Record<string, unknown>) => void;

export function track(event: GAEvent) {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: GTag }).gtag;
  if (!gtag) return;
  const { name, ...params } = event;
  gtag('event', name, params);
}
