import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeftIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocalAudioPlayButton } from '@/components/audio-play-button';
import { useThemeHex } from '@/lib/use-theme-hex';
import { useAppStore } from '@/store';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} 秒`;
  return `${Math.floor(totalSec / 60)} 分 ${totalSec % 60} 秒`;
}

export default function QueueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeHex();
  const item = useAppStore((s) => s.queue.find((q) => q.id === id) ?? null);
  const removeQueueItem = useAppStore((s) => s.removeQueueItem);
  const updateQueueItem = useAppStore((s) => s.updateQueueItem);

  // 只返回一次：用户删除、或 pump 处理完把它移出队列，都让这页自动关掉。
  const navigatedRef = useRef(false);
  const goBack = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.back();
  }, []);

  useEffect(() => {
    if (id && !item) goBack();
  }, [id, item, goBack]);

  const handleDelete = useCallback(() => {
    if (item) removeQueueItem(item.id);
    goBack();
  }, [item, removeQueueItem, goBack]);

  const handleRetry = useCallback(() => {
    if (item) updateQueueItem(item.id, { status: 'queued', error: undefined });
    goBack();
  }, [item, updateQueueItem, goBack]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={goBack}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          <ChevronLeftIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="ml-1 font-serif text-ink text-lg">待处理录音</Text>
      </View>

      {item ? (
        <View className="px-5 pt-2">
          <View className="rounded-2xl border border-rule/60 bg-paper-2/40 p-5">
            <StatusLine status={item.status} error={item.error} />
            <Text className="mt-3 font-serif text-2xl text-ink">语音 · {formatDuration(item.durationMs)}</Text>
            <Text className="mt-1 font-mono text-ink-mute text-xs">{formatDateTime(item.createdAt)}</Text>
            <View className="mt-4">
              <LocalAudioPlayButton uri={item.localUri} />
            </View>
          </View>

          {item.status === 'processing' ? (
            <Text className="mt-4 text-center text-ink-mute text-sm">正在处理中，处理完会自动变成任务</Text>
          ) : (
            <View className="mt-5 flex-row gap-3">
              {item.status === 'error' ? (
                <Pressable
                  onPress={handleRetry}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3.5 active:opacity-80"
                >
                  <RotateCcwIcon size={18} color={colors.paper} />
                  <Text className="font-serif text-base text-paper">重试</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleDelete}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full border border-rule py-3.5 active:opacity-70"
              >
                <Trash2Icon size={18} color={colors.inkMute} />
                <Text className="font-serif text-base text-ink-soft">删除</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function StatusLine({ status, error }: { status: string; error?: string }) {
  if (status === 'processing') {
    return <Text className="font-mono text-accent-warm text-xs uppercase tracking-[2px]">处理中</Text>;
  }
  if (status === 'error') {
    return (
      <View>
        <Text className="font-mono text-accent-warn text-xs uppercase tracking-[2px]">处理失败</Text>
        {error ? <Text className="mt-1 text-accent-warn text-sm">{error}</Text> : null}
      </View>
    );
  }
  return <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">待处理</Text>;
}
