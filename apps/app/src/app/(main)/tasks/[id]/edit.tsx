import { PLACES as SHARED_PLACES, WINDOWS as SHARED_WINDOWS, type TaskView } from '@mui-memo/shared/logic';
import type { RecurrenceFreq, TaskPlace, TaskWindow } from '@mui-memo/shared/validators';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarIcon, CheckIcon, XIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type RecurrenceInfo, type RecurrenceInput, type TaskPatch } from '@/lib/api';
import { useThemeHex } from '@/lib/use-theme-hex';
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
    { label: '无', iso: null },
  );
  return presets;
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
  const [tag, setTag] = useState('');
  const [expectAt, setExpectAt] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [loadedRecurrence, setLoadedRecurrence] = useState<RecurrenceInfo | null>(null);

  // 时间选择器相关状态
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  function handleOpenPicker() {
    const current = expectAt ? new Date(expectAt) : new Date();
    setTempDate(current);
    setShowDatePicker(true);
  }

  function handleConfirmIOS() {
    setExpectAt(tempDate.toISOString());
    setShowDatePicker(false);
  }

  function handleAndroidDateChange(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      setTempDate(date);
      setTimeout(function () {
        setShowAndroidTimePicker(true);
      }, 100);
    }
  }

  function handleAndroidTimeChange(event: DateTimePickerEvent, date?: Date) {
    setShowAndroidTimePicker(false);
    if (event.type === 'set' && date) {
      const finalDate = new Date(tempDate);
      finalDate.setHours(date.getHours());
      finalDate.setMinutes(date.getMinutes());
      finalDate.setSeconds(0);
      finalDate.setMilliseconds(0);
      setExpectAt(finalDate.toISOString());
    }
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
        setTag(task.tag ?? '');
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
    const trimmedTag = tag.trim();
    const normalizedTag = trimmedTag.length > 0 ? trimmedTag : null;
    if (normalizedTag !== (task.tag ?? null)) patch.tag = normalizedTag;
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
        ...(normalizedTag ? { tag: normalizedTag } : {}),
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
            ...(normalizedTag ? { tag: normalizedTag } : {}),
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
  }, [task, saving, text, place, taskWindow, tag, expectAt, repeat, loadedRecurrence]);

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
              <View className="flex-row flex-wrap gap-2">
                {expectPresets().map((preset) => {
                  const active = expectAt === preset.iso;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={function () {
                        setExpectAt(preset.iso);
                      }}
                      className={`rounded-full px-4 py-2 ${active ? 'bg-ink' : 'border border-rule bg-paper-2/50'}`}
                    >
                      <Text className={`text-sm ${active ? 'text-paper' : 'text-ink-soft'}`}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={handleOpenPicker}
                className="mt-3 flex-row items-center gap-1.5 self-start py-1"
                hitSlop={8}
              >
                <CalendarIcon size={14} color={expectAt ? colors.ink : colors.inkMute} />
                <Text className={`font-mono text-xs ${expectAt ? 'text-ink underline' : 'text-ink-mute'}`}>
                  {expectAt ? new Date(expectAt).toLocaleString() : '设置具体时间...'}
                </Text>
              </Pressable>

              {/* iOS 日期时间选择弹窗 */}
              {Platform.OS === 'ios' && showDatePicker && (
                <Modal
                  transparent={true}
                  animationType="slide"
                  visible={showDatePicker}
                  onRequestClose={function () {
                    setShowDatePicker(false);
                  }}
                >
                  <View className="flex-1 justify-end bg-black/40">
                    <View className="bg-paper rounded-t-2xl pb-8 px-4 pt-4">
                      <View className="flex-row justify-between items-center mb-4">
                        <Pressable
                          onPress={function () {
                            setShowDatePicker(false);
                          }}
                          hitSlop={8}
                        >
                          <Text className="text-ink-mute text-base">取消</Text>
                        </Pressable>
                        <Text className="font-serif text-ink text-base font-bold">选择时间</Text>
                        <Pressable onPress={handleConfirmIOS} hitSlop={8}>
                          <Text className="text-ink text-base font-bold">确定</Text>
                        </Pressable>
                      </View>
                      <DateTimePicker
                        value={tempDate}
                        mode="datetime"
                        display="spinner"
                        onChange={function (_event, date) {
                          if (date) setTempDate(date);
                        }}
                        textColor={colors.ink}
                      />
                    </View>
                  </View>
                </Modal>
              )}

              {/* Android 日期选择器 */}
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleAndroidDateChange} />
              )}

              {/* Android 时间选择器 */}
              {Platform.OS === 'android' && showAndroidTimePicker && (
                <DateTimePicker value={tempDate} mode="time" display="default" onChange={handleAndroidTimeChange} />
              )}
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
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder="可选，比如「网银」「采购」"
                placeholderTextColor={colors.inkMute}
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
