import { PLACES as SHARED_PLACES, WINDOWS as SHARED_WINDOWS, type TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace, TaskWindow } from '@mui-memo/shared/validators';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckIcon, XIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type TaskPatch } from '@/lib/api';
import { useAppStore } from '@/store';

const PLACE_LABELS: Record<TaskPlace, string> = {
  home: '在家',
  work: '工位',
  out: '在外',
  any: '不限',
};
const PLACES: { value: TaskPlace; label: string }[] = SHARED_PLACES.map((value) => ({
  value,
  label: PLACE_LABELS[value],
}));

const WINDOW_LABELS: Record<TaskWindow, string> = {
  now: '立刻',
  today: '今天内',
  later: '改天',
};
const WINDOWS: { value: TaskWindow; label: string }[] = SHARED_WINDOWS.map((value) => ({
  value,
  label: WINDOW_LABELS[value],
}));

/**
 * Expect-at 预设：语音 app 的核心理念是「不强制管理时间」，所以这里不上
 * 完整 date picker，给几个常用预设 + 清空，需要精细调时间再靠语音。
 */
function expectPresets(): { label: string; iso: string | null }[] {
  const now = new Date();
  const inAnHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const weekend = new Date(now);
  const daysToSat = (6 - weekend.getDay() + 7) % 7 || 7;
  weekend.setDate(weekend.getDate() + daysToSat);
  weekend.setHours(10, 0, 0, 0);
  // 今晚 / 明早 / 周末 是否已经过了「现在」，过了就不出，免得点完还是过期
  const presets: { label: string; iso: string | null }[] = [{ label: '1 小时后', iso: inAnHour.toISOString() }];
  if (tonight.getTime() > now.getTime()) presets.push({ label: '今晚', iso: tonight.toISOString() });
  presets.push(
    { label: '明早', iso: tomorrow.toISOString() },
    { label: '周末', iso: weekend.toISOString() },
    { label: '清空', iso: null },
  );
  return presets;
}

export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 编辑中的字段
  const [text, setText] = useState('');
  const [place, setPlace] = useState<TaskPlace>('any');
  const [taskWindow, setTaskWindow] = useState<TaskWindow>('today');
  const [tag, setTag] = useState('');
  const [expectAt, setExpectAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { task } = await api.tasks.detail(id);
        if (cancelled) return;
        setTask(task);
        setText(task.text);
        setPlace(task.place);
        setTaskWindow(task.window);
        setTag(task.tag ?? '');
        setExpectAt(task.expectAt ?? null);
      } catch (err) {
        if (err instanceof Error) Alert.alert('加载失败', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!task || saving) return;
    if (!text.trim()) {
      Alert.alert('内容不能为空');
      return;
    }
    const patch: Partial<TaskPatch> = {};
    if (text.trim() !== task.text) patch.text = text.trim();
    if (place !== task.place) patch.place = place;
    if (taskWindow !== task.window) patch.window = taskWindow;
    const trimmedTag = tag.trim();
    const normalizedTag = trimmedTag.length > 0 ? trimmedTag : null;
    if (normalizedTag !== (task.tag ?? null)) patch.tag = normalizedTag;
    if (expectAt !== (task.expectAt ?? null)) patch.expectAt = expectAt;

    if (Object.keys(patch).length === 0) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      await api.tasks.patch(task.id, patch);
      // 刷全局 tasks，reconciler 会立即看到新 expectAt 并注册通知，不用等回到 today
      try {
        const { tasks } = await api.tasks.list();
        useAppStore.getState().hydrate({ tasks, ranked: [] });
      } catch {
        // 列表拉失败不阻塞保存，通知 reconcile 下次 focus 时补上
      }
      router.back();
    } catch (err) {
      if (err instanceof Error) Alert.alert('保存失败', err.message);
    } finally {
      setSaving(false);
    }
  }, [task, saving, text, place, taskWindow, tag, expectAt]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between border-rule/50 border-b px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          <XIcon size={22} color="#1d1a12" />
        </Pressable>
        <Text className="font-serif text-ink text-lg">编辑任务</Text>
        <Pressable
          onPress={handleSave}
          disabled={loading || saving}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          {saving ? <ActivityIndicator color="#1d1a12" /> : <CheckIcon size={22} color="#1d1a12" />}
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d1a12" />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-5 pb-10" keyboardShouldPersistTaps="handled">
            <Section label="内容">
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                placeholder="这件事是什么？"
                placeholderTextColor="#7a7266"
                className="min-h-[90px] rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-base text-ink"
                textAlignVertical="top"
              />
            </Section>

            <Section label="在哪做">
              <ChipRow options={PLACES} value={place} onChange={setPlace} />
            </Section>

            <Section label="什么时候">
              <ChipRow options={WINDOWS} value={taskWindow} onChange={setTaskWindow} />
            </Section>

            <Section label="预期时间">
              <View className="flex-row flex-wrap gap-2">
                {expectPresets().map((preset) => {
                  const active = expectAt === preset.iso;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => setExpectAt(preset.iso)}
                      className={`rounded-full px-4 py-2 ${active ? 'bg-ink' : 'border border-rule bg-paper-2/50'}`}
                    >
                      <Text className={`text-sm ${active ? 'text-paper' : 'text-ink-soft'}`}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {expectAt ? (
                <Text className="mt-2 font-mono text-ink-mute text-xs">{new Date(expectAt).toLocaleString()}</Text>
              ) : null}
            </Section>

            <Section label="标签">
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder="可选，比如「网银」「采购」"
                placeholderTextColor="#7a7266"
                maxLength={32}
                className="rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-base text-ink"
              />
            </Section>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">{label}</Text>
      {children}
    </View>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`rounded-full px-4 py-2 ${active ? 'bg-ink' : 'border border-rule bg-paper-2/50'}`}
          >
            <Text className={`text-sm ${active ? 'text-paper' : 'text-ink-soft'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
