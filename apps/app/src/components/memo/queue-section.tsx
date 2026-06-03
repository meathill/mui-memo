import { router } from 'expo-router';
import { ChevronRightIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useThemeHex } from '@/lib/use-theme-hex';
import type { QueueItem } from '@/store';

/**
 * 今天页顶部的「待处理」列表：录完即入队，从上往下逐条处理（队首最先）。
 * 处理成功的项会离队、变成下方正常任务；这里只显示 queued / processing / error。
 */
export function QueueSection({ items }: { items: QueueItem[] }) {
  if (items.length === 0) return null;
  return (
    <View className="mt-4">
      <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">待处理 · {items.length}</Text>
      <View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
        {items.map((item, i) => (
          <QueueRow key={item.id} item={item} index={i} last={i === items.length - 1} />
        ))}
      </View>
    </View>
  );
}

function QueueRow({ item, index, last }: { item: QueueItem; index: number; last: boolean }) {
  const colors = useThemeHex();
  return (
    <Pressable
      onPress={() => router.push(`/queue/${item.id}`)}
      className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-rule/40 border-b'} active:opacity-70`}
    >
      <Text className="w-5 font-mono text-ink-mute text-sm">{index + 1}</Text>
      <View className="flex-1">
        <Text className="text-ink">语音 · {formatDuration(item.durationMs)}</Text>
        <Text className="mt-0.5 font-mono text-ink-mute text-xs">{formatClock(item.createdAt)}</Text>
      </View>
      <StatusBadge item={item} />
      <ChevronRightIcon size={18} color={colors.inkMute} />
    </Pressable>
  );
}

function StatusBadge({ item }: { item: QueueItem }) {
  const colors = useThemeHex();
  if (item.status === 'processing') {
    return (
      <View className="flex-row items-center gap-1.5">
        <ActivityIndicator size="small" color={colors.accentWarm} />
        <Text className="font-mono text-accent-warm text-xs">处理中</Text>
      </View>
    );
  }
  if (item.status === 'error') {
    return (
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full bg-accent-warn" />
        <Text className="font-mono text-accent-warn text-xs">失败</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-full bg-ink-mute" />
      <Text className="font-mono text-ink-mute text-xs">待处理</Text>
    </View>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
