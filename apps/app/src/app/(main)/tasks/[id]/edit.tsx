import {
  PLACE_LABEL,
  PLACES as SHARED_PLACES,
  WINDOWS as SHARED_WINDOWS,
  type TaskView,
  WINDOW_LABEL,
} from '@mui-memo/shared/logic';
import type { RecurrenceFreq, TaskPlace, TaskWindow } from '@mui-memo/shared/validators';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChipRow, ExpectAtField, Section } from '@/components/task-edit-fields';
import { api, type RecurrenceInfo, type RecurrenceInput, type TaskPatch } from '@/lib/api';
import { useThemeHex } from '@/lib/use-theme-hex';
import { useAppStore } from '@/store';

const PLACES: { value: TaskPlace; label: string }[] = SHARED_PLACES.map((value) => ({
  value,
  label: PLACE_LABEL[value].label,
}));
const WINDOWS: { value: TaskWindow; label: string }[] = SHARED_WINDOWS.map((value) => ({
  value,
  label: WINDOW_LABEL[value],
}));

// 重复周期。锚点复用任务的 expectAt（星期/号数/时刻）。
type RepeatOption = 'none' | 'daily' | 'workday' | 'weekly' | 'biweekly' | 'monthly';
const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'workday', label: '工作日' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每两周' },
  { value: 'monthly', label: '每月' },
];
function toRepeat(freq: RecurrenceFreq, interval: number): RepeatOption {
  if (freq === 'daily') return 'daily';
  if (freq === 'workday') return 'workday';
  if (freq === 'monthly') return 'monthly';
  return interval === 2 ? 'biweekly' : 'weekly';
}
function toFreqInterval(repeat: RepeatOption): { freq: RecurrenceFreq; interval: number } | null {
  switch (repeat) {
    case 'daily':
      return { freq: 'daily', interval: 1 };
    case 'workday':
      return { freq: 'workday', interval: 1 };
    case 'weekly':
      return { freq: 'weekly', interval: 1 };
    case 'biweekly':
      return { freq: 'weekly', interval: 2 };
    case 'monthly':
      return { freq: 'monthly', interval: 1 };
    default:
      return null;
  }
}

export default function TaskEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeHex();
  const [task, setTask] = useState<TaskView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 编辑中的字段
  const [text, setText] = useState('');
  const [place, setPlace] = useState<TaskPlace>('any');
  const [taskWindow, setTaskWindow] = useState<TaskWindow>('today');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [expectAt, setExpectAt] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [loadedRecurrence, setLoadedRecurrence] = useState<RecurrenceInfo | null>(null);

  // 已有标签建议：从全局任务里现算去重，排除已选的，点一下即加入。
  const storeTasks = useAppStore((s) => s.tasks);
  const tagSuggestions = useMemo(
    () => [...new Set(storeTasks.flatMap((t) => t.tags ?? []))].filter((s) => !tags.includes(s)).sort(),
    [storeTasks, tags],
  );

  function addTag(value: string) {
    const v = value.trim();
    if (!v || tags.includes(v) || tags.length >= 12) return;
    setTags((prev) => [...prev, v]);
    setTagDraft('');
  }
  function removeTag(value: string) {
    setTags((prev) => prev.filter((t) => t !== value));
  }
  // 点芯片改文字：放回输入框 + 从已选里移除，改完再回车加回去。
  function editTag(value: string) {
    setTagDraft(value);
    removeTag(value);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { task, recurrence } = await api.tasks.detail(id);
        if (cancelled) return;
        setTask(task);
        setText(task.text);
        setPlace(task.place);
        setTaskWindow(task.window);
        setTags(task.tags ?? []);
        setExpectAt(task.expectAt ?? null);
        setLoadedRecurrence(recurrence);
        setRepeat(recurrence ? toRepeat(recurrence.freq, recurrence.interval) : 'none');
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
    const trimmedText = text.trim();
    if (!trimmedText) {
      Alert.alert('内容不能为空');
      return;
    }
    const patch: Partial<TaskPatch> = {};
    if (trimmedText !== task.text) patch.text = trimmedText;
    if (place !== task.place) patch.place = place;
    if (taskWindow !== task.window) patch.window = taskWindow;
    // 把没回车确认的草稿也并进去，避免用户输了一半没保存
    const draft = tagDraft.trim();
    const finalTags = draft && !tags.includes(draft) && tags.length < 12 ? [...tags, draft] : tags;
    if (JSON.stringify(finalTags) !== JSON.stringify(task.tags ?? [])) patch.tags = finalTags;
    if (expectAt !== (task.expectAt ?? null)) patch.expectAt = expectAt;

    const desired = toFreqInterval(repeat);
    const currentId = loadedRecurrence?.id ?? null;
    const currentFreq = loadedRecurrence?.freq ?? null;
    const currentInterval = loadedRecurrence?.interval ?? null;
    const taskChanged = Object.keys(patch).length > 0;
    const recurrenceChanged =
      (desired?.freq ?? null) !== currentFreq || (desired?.interval ?? null) !== currentInterval;

    if (!taskChanged && !recurrenceChanged) {
      router.back();
      return;
    }

    // 周期定义入参：字段来自编辑后的值，锚点用 expectAt（空则服务端取 now）
    function buildRecurrenceInput(spec: { freq: RecurrenceFreq; interval: number }): RecurrenceInput {
      return {
        text: trimmedText,
        place,
        window: taskWindow,
        energy: task?.energy ?? 2,
        priority: task?.priority ?? 2,
        tags: finalTags,
        freq: spec.freq,
        interval: spec.interval,
        ...(expectAt ? { anchorAt: expectAt } : {}),
        tzOffset: new Date().getTimezoneOffset(),
        linkTaskId: task?.id,
      };
    }

    setSaving(true);
    try {
      if (taskChanged) await api.tasks.patch(task.id, patch);

      // 开/关/换周期。频率或间隔变了用「删+建」重置周期序号，避免出现重复实例。
      if (!desired && currentId) {
        await api.recurrences.delete(currentId);
      } else if (desired && !currentId) {
        await api.recurrences.create(buildRecurrenceInput(desired));
      } else if (desired && currentId) {
        if (recurrenceChanged) {
          await api.recurrences.delete(currentId);
          await api.recurrences.create(buildRecurrenceInput(desired));
        } else if (taskChanged) {
          // 同周期，仅同步模板字段，让未来实例跟上这次编辑
          await api.recurrences.update(currentId, {
            text: trimmedText,
            place,
            window: taskWindow,
            tags: finalTags,
          });
        }
      }

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
  }, [task, saving, text, place, taskWindow, tags, tagDraft, expectAt, repeat, loadedRecurrence]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between border-rule/50 border-b px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          <XIcon size={22} color={colors.ink} />
        </Pressable>
        <Text className="font-serif text-ink text-lg">编辑任务</Text>
        <Pressable
          onPress={handleSave}
          disabled={loading || saving}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          {saving ? <ActivityIndicator color={colors.ink} /> : <CheckIcon size={22} color={colors.ink} />}
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.ink} />
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
                placeholderTextColor={colors.inkMute}
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
              <ExpectAtField value={expectAt} onChange={setExpectAt} />
            </Section>

            <Section label="重复">
              <ChipRow options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
              {repeat !== 'none' ? (
                <Text className="mt-2 text-ink-mute text-xs">
                  以「预期时间」为每期的星期与时刻锚点；留空则取保存时刻。没完成会在下一期自动清掉。
                </Text>
              ) : null}
            </Section>

            <Section label="标签">
              {tags.length > 0 ? (
                <View className="mb-2 flex-row flex-wrap gap-2">
                  {tags.map((t) => (
                    <View key={t} className="flex-row items-center gap-1 rounded-full bg-ink py-1.5 pr-2 pl-3">
                      <Pressable onPress={() => editTag(t)} hitSlop={4} accessibilityLabel={`编辑标签 ${t}`}>
                        <Text className="text-paper text-sm">{t}</Text>
                      </Pressable>
                      <Pressable onPress={() => removeTag(t)} hitSlop={6} accessibilityLabel={`移除标签 ${t}`}>
                        <XIcon size={14} color={colors.paper} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={() => addTag(tagDraft)}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  placeholder="加标签，回车确认，比如「网银」"
                  placeholderTextColor={colors.inkMute}
                  maxLength={32}
                  className="flex-1 rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-base text-ink"
                />
                {tagDraft.trim() ? (
                  <Pressable
                    onPress={() => addTag(tagDraft)}
                    hitSlop={6}
                    accessibilityLabel="添加标签"
                    className="h-10 w-10 items-center justify-center rounded-full bg-ink active:opacity-70"
                  >
                    <PlusIcon size={18} color={colors.paper} />
                  </Pressable>
                ) : null}
              </View>
              {tagSuggestions.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {tagSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => addTag(s)}
                      className="rounded-full border border-rule bg-paper-2/50 px-3 py-1.5 active:opacity-60"
                    >
                      <Text className="text-ink-soft text-sm">＋ {s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Section>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
