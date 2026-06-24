import type { Bucket, TaskView } from '@mui-memo/shared/logic';
import { BUCKET_LABEL, filterByTag, rerank } from '@mui-memo/shared/logic';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBanner } from '@/components/error-banner';
import { ContextStrip } from '@/components/memo/context-strip';
import { DoingCard } from '@/components/memo/doing-card';
import { EffectToast } from '@/components/memo/effect-toast';
import { MicButton } from '@/components/memo/mic-button';
import { QueueSection } from '@/components/memo/queue-section';
import { TaskRow } from '@/components/memo/task-row';
import { api } from '@/lib/api';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cancelTaskReminder } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import {
  hydrateTasksFromLocalCache,
  patchTaskEverywhere,
  refreshTasksFromRemote,
  restoreTaskEverywhere,
} from '@/lib/task-sync';
import { useThemeHex } from '@/lib/use-theme-hex';
import { useAppStore } from '@/store';

const SECTION_ORDER: Bucket[] = ['now', 'today_here', 'later', 'done_recurring'];

export default function TodayScreen() {
  const user = useSession((s) => s.user);
  const colors = useThemeHex();

  const {
    place,
    activeTag,
    barChips,
    tasks,
    setPlace,
    setActiveTag,
    setBarChips,
    lastEffects,
    lastUtterance,
    queue,
    enqueueAudio,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadTasks = useCallback(async (force = false) => {
    try {
      await hydrateTasksFromLocalCache();
      await refreshTasksFromRemote({ force });
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '请求失败');
    }
  }, []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTasks(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadTasks]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const doing = useMemo(() => tasks.find((t) => t.status === 'doing') ?? null, [tasks]);
  // 选了标签 → 按标签筛、用 'any' 排序（不限地点看全部该标签任务）；否则按场景排。
  const ranked = useMemo(
    () => (activeTag ? rerank(filterByTag(tasks, activeTag), 'any') : rerank(tasks, place)),
    [tasks, place, activeTag],
  );
  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags ?? []))].sort(), [tasks]);

  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fade.value = withSequence(withTiming(0.55, { duration: 90 }), withTiming(1, { duration: 220 }));
  }, [place, activeTag, fade]);
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

  const handleDone = useCallback(async (id: string) => {
    hapticSuccess();
    const current = useAppStore.getState().tasks;
    const original = current.find((t) => t.id === id);
    await patchTaskEverywhere(id, { status: 'done', completedAt: new Date().toISOString() });
    cancelTaskReminder(id).catch(() => undefined);
    try {
      await api.tasks.done(id);
    } catch (err) {
      if (err instanceof Error) Alert.alert('标记失败', err.message);
      if (original) {
        await restoreTaskEverywhere(original);
      }
    }
  }, []);

  // 周期任务「本轮已完成」可点回恢复成待办
  const handleReopen = useCallback(async (id: string) => {
    hapticLight();
    const current = useAppStore.getState().tasks;
    const original = current.find((t) => t.id === id);
    await patchTaskEverywhere(id, { status: 'pending', completedAt: null });
    try {
      await api.tasks.reopen(id);
    } catch (err) {
      if (err instanceof Error) Alert.alert('恢复失败', err.message);
      if (original) {
        await restoreTaskEverywhere(original);
      }
    }
  }, []);

  // 录完即入队，不再同步等 AI 处理。后台 pump（根 layout 挂载）逐条顺序处理，
  // 录音永不被处理状态挡住。
  const handleAudio = useCallback(
    ({ uri, mimeType, durationMs }: { uri: string; mimeType: string; durationMs: number }) => {
      const tz = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ?? 'Asia/Shanghai';
      enqueueAudio({ localUri: uri, mimeType, durationMs, place, tz });
    },
    [place, enqueueAudio],
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-40"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        <View>
          <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">叨叨记 · 今天</Text>
          <Text className="mt-1 font-serif text-2xl text-ink">你好，{user?.name ?? user?.email ?? '朋友'}</Text>
        </View>

        <View className="mt-5">
          <ContextStrip
            chips={barChips}
            place={place}
            activeTag={activeTag}
            allTags={allTags}
            onSelectPlace={setPlace}
            onSelectTag={setActiveTag}
            onSaveChips={setBarChips}
          />
        </View>

        {loadError ? (
          <View className="mt-4">
            <ErrorBanner message={loadError} onRetry={loadTasks} />
          </View>
        ) : null}

        <EffectToast effects={lastEffects} utterance={lastUtterance} />

        <QueueSection items={queue} />

        {doing ? (
          <View className="mt-4">
            <DoingCard task={doing} onDone={handleDone} />
          </View>
        ) : null}

        <Animated.View className="mt-4" style={fadeStyle}>
          {SECTION_ORDER.map((bucket) => {
            const list = grouped.get(bucket) ?? [];
            if (!list.length) return null;
            return (
              <View key={bucket} className="mt-4">
                <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">
                  {BUCKET_LABEL[bucket]} · {list.length}
                </Text>
                <View className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onDone={handleDone} onReopen={handleReopen} />
                  ))}
                </View>
              </View>
            );
          })}

          {tasks.length === 0 && !doing && queue.length === 0 ? (
            <View className="mt-10 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
              <Text className="font-serif text-ink text-lg">清单里还没有事</Text>
              <Text className="mt-1 text-center text-ink-soft text-sm">
                按住下面的麦克风说一句，比如：{'\n'}
                「下午三点前给老张转五百」
              </Text>
            </View>
          ) : ranked.length === 0 && !doing ? (
            <View className="mt-10 items-center rounded-2xl border border-rule/60 border-dashed px-6 py-10">
              <Text className="font-serif text-ink text-lg">这个筛选下暂时没有事</Text>
              <Text className="mt-1 text-center text-ink-soft text-sm">换个筛选看看，或按住麦克风记一条</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-24 items-center">
        <MicButton onAudio={handleAudio} />
      </View>
    </SafeAreaView>
  );
}
