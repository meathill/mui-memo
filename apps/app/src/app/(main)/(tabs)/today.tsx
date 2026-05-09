import type { Bucket, TaskView } from '@mui-memo/shared/logic';
import { BUCKET_LABEL, rerank } from '@mui-memo/shared/logic';
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
import { TaskRow } from '@/components/memo/task-row';
import { api } from '@/lib/api';
import { cancelTaskReminder } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { useThemeHex } from '@/lib/use-theme-hex';
import { useAppStore } from '@/store';

// 非 doing 的分桶顺序（doing 单独走 DoingCard 在顶部）
const SECTION_ORDER: Bucket[] = ['now', 'today_here', 'today_else', 'blocked', 'later'];

export default function TodayScreen() {
  const user = useSession((s) => s.user);
  const colors = useThemeHex();

  const { place, tasks, hydrate, setPlace, isProcessing, setProcessing, lastEffect, lastUtterance, setLastEffect } =
    useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadTasks = useCallback(async () => {
    try {
      const { tasks } = await api.tasks.list();
      hydrate({ tasks, ranked: [] });
      setLoadError(null);
    } catch (err) {
      // 拉失败不再弹 Alert（网络抖动一弹就烦），放顶部 banner 让用户手动重试
      setLoadError(err instanceof Error ? err.message : '请求失败');
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

  // 屏聚焦就拉一下，从详情/编辑返回时能看到新状态
  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const doing = useMemo(() => tasks.find((t) => t.status === 'doing') ?? null, [tasks]);
  const ranked = useMemo(() => rerank(tasks, place), [tasks, place]);

  // 切换 place 时给事项区一次淡入脉冲：即便桶分配前后一致，也让用户看到「筛选跑过了」
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fade.value = withSequence(withTiming(0.55, { duration: 90 }), withTiming(1, { duration: 220 }));
  }, [place, fade]);
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

  const handleDone = useCallback(
    async (id: string) => {
      // 乐观更新，和 web 对齐
      const current = useAppStore.getState().tasks;
      const original = current.find((t) => t.id === id);
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
      // 标完立即撤掉本地提醒；reconciler 也会撤，但这里更即时
      cancelTaskReminder(id).catch(() => undefined);
      try {
        await api.tasks.done(id);
      } catch (err) {
        if (err instanceof Error) Alert.alert('标记失败', err.message);
        // 失败时只把这一条回滚成原状态。不要 loadTasks 全表覆盖 ——
        // 那会让 TaskRow 退场动画结束后所有行因 task ref 变化批量重建，
        // 被勾掉的行视觉「复位」。
        if (original) {
          const latest = useAppStore.getState().tasks;
          hydrate({
            tasks: latest.map((t) => (t.id === id ? original : t)),
            ranked: [],
          });
        }
      }
    },
    [hydrate],
  );

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

        if (effect.kind === 'done' || effect.kind === 'done-backfill') {
          Alert.alert('确认完成', `是否确认完成任务「${effect.text}」？`, [
            { text: '取消', style: 'cancel' },
            {
              text: '确认完成',
              style: 'default',
              onPress: () => {
                void handleDone((effect as { id: string }).id);
              },
            },
          ]);
        }
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
    [place, hydrate, setLastEffect, setProcessing, handleDone],
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-40"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        <View>
          <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">MuiMemo · 今天</Text>
          <Text className="mt-1 font-serif text-2xl text-ink">你好，{user?.name ?? user?.email ?? '朋友'}</Text>
        </View>

        <View className="mt-5">
          <ContextStrip value={place} onChange={setPlace} />
        </View>

        {loadError ? (
          <View className="mt-4">
            <ErrorBanner message={loadError} onRetry={loadTasks} />
          </View>
        ) : null}

        <EffectToast effect={lastEffect} utterance={lastUtterance} />

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
        </Animated.View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-24 items-center">
        <MicButton onAudio={handleAudio} processing={isProcessing} />
      </View>
    </SafeAreaView>
  );
}
