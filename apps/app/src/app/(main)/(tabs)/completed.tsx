import { ErrorBanner } from '@/components/error-banner';
import { type CompletedTask, api } from '@/lib/api';
import { CheckIcon, Trash2Icon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDay(iso: string | null): string {
  if (!iso) return '更早';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return '今天';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) {
    return '昨天';
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CompletedScreen() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.tasks.completed();
      setTasks(data.tasks);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await api.tasks.completed(nextCursor);
      setTasks((prev) => [...prev, ...data.tasks]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextCursor]);

  const handleDelete = useCallback((t: CompletedTask) => {
    Alert.alert('删除这条完成记录？', `「${t.text}」将被彻底删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.tasks.delete(t.id);
            setTasks((prev) => prev.filter((x) => x.id !== t.id));
          } catch (err) {
            if (err instanceof Error) Alert.alert('删除失败', err.message);
          }
        },
      },
    ]);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CompletedTask[]>();
    for (const t of tasks) {
      const day = formatDay(t.completedAt);
      const arr = map.get(day) ?? [];
      arr.push(t);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [tasks]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d1a12" />}
      >
        <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">MuiMemo · 已完成</Text>
        <Text className="mt-1 font-serif text-2xl text-ink">你搞定的那些事</Text>
        <Text className="mt-1 text-ink-soft text-sm">
          已加载 {tasks.length} 件{hasMore ? '（还可加载更多）' : ''}
        </Text>

        {loadError ? (
          <View className="mt-4">
            <ErrorBanner message={loadError} onRetry={refresh} />
          </View>
        ) : null}

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#1d1a12" />
          </View>
        ) : tasks.length === 0 ? (
          <View className="mt-12 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
            <Text className="font-serif text-ink text-lg">还没有完成任何事</Text>
            <Text className="mt-1 text-ink-soft text-sm">勾掉第一件时会显示在这里。</Text>
          </View>
        ) : (
          <>
            {grouped.map(([day, list]) => (
              <View key={day} className="mt-5">
                <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">
                  {day} · {list.length}
                </Text>
                <View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                  {list.map((t) => (
                    <View
                      key={t.id}
                      className="flex-row items-start gap-3 border-rule/50 border-b py-3 last:border-b-0"
                    >
                      <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-accent-good">
                        <CheckIcon size={12} color="#f4ede0" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-ink-soft text-base line-through">{t.text}</Text>
                        <Text className="mt-1 font-mono text-ink-mute text-sm">
                          {t.tag ? `🏷 ${t.tag} · ` : ''}
                          {formatTime(t.completedAt)}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleDelete(t)} hitSlop={8} className="p-1.5 active:opacity-60">
                        <Trash2Icon size={16} color="#7a7266" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {hasMore ? (
              <View className="mt-6 items-center">
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-rule px-4 py-2 active:opacity-70"
                >
                  {loadingMore ? (
                    <ActivityIndicator color="#1d1a12" />
                  ) : (
                    <Text className="text-ink-soft text-sm">加载更多</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Text className="mt-6 text-center font-mono text-xs text-ink-mute">· 到底了 ·</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
