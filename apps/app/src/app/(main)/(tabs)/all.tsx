import { TaskRow } from '@/components/memo/task-row';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { TaskView } from '@mui-memo/shared/logic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const UNTAGGED = '（未分类）';

export default function AllScreen() {
  const { tasks, hydrate } = useAppStore();
  const [loading, setLoading] = useState(tasks.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { tasks } = await api.tasks.list();
      hydrate({ tasks, ranked: [] });
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleDone = useCallback(
    async (id: string) => {
      const current = useAppStore.getState().tasks;
      hydrate({
        tasks: current.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'done',
                done: true,
                completedAt: new Date().toISOString(),
              }
            : t,
        ),
        ranked: [],
      });
      try {
        await api.tasks.done(id);
      } catch {
        load();
      }
    },
    [hydrate, load],
  );

  const pending = useMemo(() => tasks.filter((t) => !t.done && t.status !== 'linked'), [tasks]);
  const grouped = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of pending) {
      const key = t.tag || UNTAGGED;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [pending]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d1a12" />
        }
      >
        <Text className="font-mono text-ink-mute text-[11px] uppercase tracking-[2px]">
          MuiMemo · 全部
        </Text>
        <Text className="mt-1 font-serif text-2xl text-ink">清单全景</Text>
        <Text className="mt-1 text-ink-soft text-sm">共 {pending.length} 件待办，按标签分组</Text>

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#1d1a12" />
          </View>
        ) : grouped.length === 0 ? (
          <View className="mt-12 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
            <Text className="font-serif text-ink text-lg">清单是空的</Text>
            <Text className="mt-1 text-ink-soft text-sm">回到今天说一句话就有了。</Text>
          </View>
        ) : (
          grouped.map(([tag, list]) => (
            <View key={tag} className="mt-6">
              <Text className="mb-2 font-mono text-ink-mute text-[11px] uppercase tracking-[2px]">
                {tag} · {list.length}
              </Text>
              <View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                {list.map((t) => (
                  <TaskRow key={t.id} task={t} onDone={handleDone} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
