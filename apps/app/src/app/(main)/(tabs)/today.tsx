import { ContextStrip } from '@/components/memo/context-strip';
import { DoingCard } from '@/components/memo/doing-card';
import { EffectToast } from '@/components/memo/effect-toast';
import { MicButton } from '@/components/memo/mic-button';
import { TaskRow } from '@/components/memo/task-row';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAppStore } from '@/store';
import { BUCKET_LABEL, rerank } from '@mui-memo/shared/logic';
import type { Bucket, TaskView } from '@mui-memo/shared/logic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 非 doing 的分桶顺序（doing 单独走 DoingCard 在顶部）
const SECTION_ORDER: Bucket[] = ['now', 'today_here', 'today_else', 'blocked', 'later'];

export default function TodayScreen() {
  const user = useSession((s) => s.user);

  const {
    place,
    tasks,
    hydrate,
    setPlace,
    isProcessing,
    setProcessing,
    lastEffect,
    lastUtterance,
    setLastEffect,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const loadTasks = useCallback(async () => {
    try {
      const { tasks } = await api.tasks.list();
      hydrate({ tasks, ranked: [] });
    } catch (err) {
      if (err instanceof Error) Alert.alert('拉任务失败', err.message);
    }
  }, [hydrate]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTasks();
    } finally {
      setRefreshing(false);
    }
  }, [loadTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const doing = useMemo(() => tasks.find((t) => t.status === 'doing') ?? null, [tasks]);
  const ranked = useMemo(() => rerank(tasks, place), [tasks, place]);
  const grouped = useMemo(() => {
    const buckets = new Map<Bucket, TaskView[]>();
    for (const t of ranked) {
      if (t.bucket === 'doing') continue;
      const arr = buckets.get(t.bucket) ?? [];
      arr.push(t);
      buckets.set(t.bucket, arr);
    }
    return buckets;
  }, [ranked]);

  const handleAudio = useCallback(
    async ({ uri, mimeType }: { uri: string; mimeType: string }) => {
      setProcessing(true);
      try {
        const tz = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ?? 'Asia/Shanghai';
        const { utterance, effect, tasks } = await api.intent.submit({
          audioUri: uri,
          mimeType,
          place,
          tz,
        });
        hydrate({ tasks, ranked: [] });
        setLastEffect(effect, utterance);
      } catch (err) {
        setLastEffect(
          {
            kind: 'miss',
            verb: err instanceof Error ? err.message : '识别失败',
          },
          null,
        );
      } finally {
        setProcessing(false);
      }
    },
    [place, hydrate, setLastEffect, setProcessing],
  );

  const handleDone = useCallback(
    async (id: string) => {
      // 乐观更新，和 web 对齐
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
      } catch (err) {
        if (err instanceof Error) Alert.alert('标记失败', err.message);
        loadTasks();
      }
    },
    [hydrate, loadTasks],
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-40"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d1a12" />
        }
      >
        <View>
          <Text className="font-mono text-ink-mute text-[11px] uppercase tracking-[2px]">
            MuiMemo · 今天
          </Text>
          <Text className="mt-1 font-serif text-2xl text-ink">
            你好，{user?.name ?? user?.email ?? '朋友'}
          </Text>
        </View>

        <View className="mt-5">
          <ContextStrip value={place} onChange={setPlace} />
        </View>

        <EffectToast effect={lastEffect} utterance={lastUtterance} />

        {doing ? (
          <View className="mt-4">
            <DoingCard task={doing} onDone={handleDone} />
          </View>
        ) : null}

        <View className="mt-4">
          {SECTION_ORDER.map((bucket) => {
            const list = grouped.get(bucket) ?? [];
            if (!list.length) return null;
            return (
              <View key={bucket} className="mt-4">
                <Text className="mb-2 font-mono text-ink-mute text-[11px] uppercase tracking-[2px]">
                  {BUCKET_LABEL[bucket]} · {list.length}
                </Text>
                <View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onDone={handleDone} />
                  ))}
                </View>
              </View>
            );
          })}

          {tasks.length === 0 && !doing ? (
            <View className="mt-10 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
              <Text className="font-serif text-ink text-lg">清单里还没有事</Text>
              <Text className="mt-1 text-center text-ink-soft text-sm">
                按住下面的麦克风说一句，比如：{'\n'}
                「下午三点前给老张转五百」
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-24 items-center">
        <MicButton onAudio={handleAudio} processing={isProcessing} />
      </View>
    </SafeAreaView>
  );
}
