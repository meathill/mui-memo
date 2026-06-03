import type { Bucket, IntentEffect, TaskView } from '@mui-memo/shared/logic';
import { BUCKET_LABEL, rerank } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
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
import { type PendingConfirm, useAppStore } from '@/store';

const SECTION_ORDER: Bucket[] = ['now', 'today_here', 'today_else', 'blocked', 'later', 'done_recurring'];

export default function TodayScreen() {
  const user = useSession((s) => s.user);
  const colors = useThemeHex();

  const {
    place,
    tasks,
    hydrate,
    setPlace,
    isProcessing,
    setProcessing,
    lastEffects,
    lastUtterance,
    setLastEffects,
    pendingConfirms,
    pushPendingConfirms,
    shiftPendingConfirm,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadTasks = useCallback(async () => {
    try {
      const { tasks } = await api.tasks.list();
      hydrate({ tasks, ranked: [] });
      setLoadError(null);
    } catch (err) {
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

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const doing = useMemo(() => tasks.find((t) => t.status === 'doing') ?? null, [tasks]);
  const ranked = useMemo(() => rerank(tasks, place), [tasks, place]);

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
      cancelTaskReminder(id).catch(() => undefined);
      try {
        await api.tasks.done(id);
      } catch (err) {
        if (err instanceof Error) Alert.alert('标记失败', err.message);
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

  // 周期任务「本轮已完成」可点回恢复成待办
  const handleReopen = useCallback(
    async (id: string) => {
      const current = useAppStore.getState().tasks;
      const original = current.find((t) => t.id === id);
      hydrate({
        tasks: current.map((t) => (t.id === id ? { ...t, status: 'pending', done: false, completedAt: null } : t)),
        ranked: [],
      });
      try {
        await api.tasks.reopen(id);
      } catch (err) {
        if (err instanceof Error) Alert.alert('恢复失败', err.message);
        if (original) {
          const latest = useAppStore.getState().tasks;
          hydrate({ tasks: latest.map((t) => (t.id === id ? original : t)), ranked: [] });
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
        const { utterance, effects, tasks, pendingConfirms } = await api.intent.submit({
          audioUri: uri,
          mimeType,
          place,
          tz,
        });
        hydrate({ tasks, ranked: [] });
        setLastEffects(effects, utterance);
        if (pendingConfirms?.length) {
          pushPendingConfirms(pendingConfirms.map((p) => ({ index: p.index, effect: p.effect, utterance })));
        }
      } catch (err) {
        setLastEffects(
          [
            {
              kind: 'miss',
              verb: err instanceof Error ? err.message : '识别失败',
            },
          ],
          null,
        );
      } finally {
        setProcessing(false);
      }
    },
    [place, hydrate, setLastEffects, setProcessing, pushPendingConfirms],
  );

  // 处理待确认队列：每次 pendingConfirms[0] 变化都弹 Alert.alert，决定后 shift
  const promptingRef = useRef(false);
  useEffect(() => {
    const head = pendingConfirms[0];
    if (!head || promptingRef.current) return;
    promptingRef.current = true;
    showConfirm(head, async (choice) => {
      promptingRef.current = false;
      try {
        await applyConfirm(head, choice, handleDone, hydrate);
      } catch (err) {
        if (err instanceof Error) Alert.alert('保存失败', err.message);
      } finally {
        shiftPendingConfirm();
      }
    });
  }, [pendingConfirms, handleDone, hydrate, shiftPendingConfirm]);

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

        <EffectToast effects={lastEffects} utterance={lastUtterance} />

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

type ConfirmChoice = 'confirm' | 'modify-as-add' | 'cancel';

function showConfirm(pc: PendingConfirm, onChoose: (choice: ConfirmChoice) => void) {
  const { effect } = pc;
  if (effect.kind === 'modify') {
    const before = effect.before.text ?? effect.text;
    const after = effect.patch.text ?? before;
    const body = before !== after ? `「${before}」 → 「${after}」` : `「${effect.text}」 ${effect.verb}`;
    Alert.alert('要把任务改成这样吗？', body, [
      { text: '取消', style: 'cancel', onPress: () => onChoose('cancel') },
      { text: '改为新增', style: 'default', onPress: () => onChoose('modify-as-add') },
      { text: '确认', style: 'default', onPress: () => onChoose('confirm') },
    ]);
  } else if (effect.kind === 'done') {
    Alert.alert('确认完成？', `「${effect.text}」`, [
      { text: '取消', style: 'cancel', onPress: () => onChoose('cancel') },
      { text: '确认', style: 'default', onPress: () => onChoose('confirm') },
    ]);
  } else {
    onChoose('cancel');
  }
}

async function applyConfirm(
  pc: PendingConfirm,
  choice: ConfirmChoice,
  handleDone: (id: string) => Promise<void>,
  hydrate: (payload: { tasks: TaskView[]; ranked: never[] }) => void,
): Promise<void> {
  const { effect, utterance } = pc;
  if (choice === 'cancel') return;
  if (effect.kind === 'modify') {
    const body =
      choice === 'confirm'
        ? { kind: 'modify' as const, taskId: effect.id, patch: effect.patch as Record<string, unknown> }
        : {
            kind: 'modify-as-add' as const,
            rawText: utterance.raw,
            task: { ...effect.before, ...effect.patch } as Record<string, unknown>,
            aiReason: effect.reason,
          };
    const { tasks } = await api.intent.confirm(body);
    hydrate({ tasks, ranked: [] });
  } else if (effect.kind === 'done' && choice === 'confirm') {
    await handleDone(effect.id);
  }
}

// 让外部能引用 IntentEffect / Utterance（避免未使用 import 报错）
export type { IntentEffect, Utterance };
