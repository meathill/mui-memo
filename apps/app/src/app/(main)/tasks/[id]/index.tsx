import { ErrorBanner } from '@/components/error-banner';
import { type Attachment, api } from '@/lib/api';
import type { TaskView } from '@mui-memo/shared/logic';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CheckIcon, ChevronLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_LABEL: Record<string, string> = {
  pending: '待办',
  doing: '进行中',
  done: '已完成',
  linked: '关联',
};

const PLACE_LABEL: Record<string, string> = {
  home: '在家',
  work: '工位',
  out: '在外',
  any: '不限',
};

const WINDOW_LABEL: Record<string, string> = {
  now: '马上',
  today: '今天内',
  later: '改天',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskView | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { task, attachments } = await api.tasks.detail(id);
      setTask(task);
      setAttachments(attachments);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 屏聚焦时拉数据：从 edit 返回后自动显示最新
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = useCallback(() => {
    if (!task) return;
    Alert.alert('删除这条任务？', `「${task.text}」将被彻底删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.tasks.delete(task.id);
            router.back();
          } catch (err) {
            if (err instanceof Error) Alert.alert('删除失败', err.message);
          }
        },
      },
    ]);
  }, [task]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-ink/10"
        >
          <ChevronLeftIcon size={22} color="#1d1a12" />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => task && router.push(`/tasks/${task.id}/edit`)}
            disabled={!task}
            hitSlop={8}
            className="flex-row items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 active:opacity-70"
          >
            <PencilIcon size={14} color="#7a7266" />
            <Text className="text-ink-soft text-sm">编辑</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={!task}
            hitSlop={8}
            className="flex-row items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 active:opacity-70"
          >
            <Trash2Icon size={14} color="#7a7266" />
            <Text className="text-ink-soft text-sm">删除</Text>
          </Pressable>
        </View>
      </View>

      {loadError && !task ? (
        <View className="flex-1 items-center justify-center px-5">
          <View className="w-full">
            <ErrorBanner message={loadError} onRetry={load} />
          </View>
        </View>
      ) : loading || !task ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d1a12" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10">
          <Text className="font-mono text-ink-mute text-sm uppercase tracking-[2px]">
            {STATUS_LABEL[task.status] ?? task.status}
            {task.tag ? ` · 🏷 ${task.tag}` : ''}
          </Text>
          <Text className="mt-2 font-serif text-ink text-3xl leading-snug">{task.text}</Text>
          {task.rawText && task.rawText !== task.text ? (
            <Text className="mt-2 text-ink-soft text-base">原话：「{task.rawText}」</Text>
          ) : null}

          <View className="mt-6 gap-2 rounded-2xl border border-rule/60 bg-paper-2/40 p-4">
            <Row label="地点" value={PLACE_LABEL[task.place] ?? task.place} />
            <Row label="时段" value={WINDOW_LABEL[task.window] ?? task.window} />
            {task.expectAt ? (
              <Row label="预计" value={formatDateTime(task.expectAt)} />
            ) : null}
            {task.dueAt ? <Row label="截止" value={formatDateTime(task.dueAt)} /> : null}
            {task.deadline ? <Row label="Deadline" value={task.deadline} /> : null}
            <Row label="优先级" value={String(task.priority ?? 0)} />
            <Row label="精力" value={String(task.energy ?? 0)} />
          </View>

          {task.aiReason ? (
            <View className="mt-4 rounded-2xl border border-accent-warm/30 bg-accent-warm/10 p-4">
              <Text className="font-mono text-sm text-ink-mute uppercase tracking-[2px]">
                AI · 理由
              </Text>
              <Text className="mt-1.5 text-ink text-base leading-relaxed">
                {task.aiReason}
              </Text>
            </View>
          ) : null}

          {attachments.length > 0 ? (
            <View className="mt-4">
              <Text className="mb-2 font-mono text-xs text-ink-mute uppercase tracking-[2px]">
                附件 · {attachments.length}
              </Text>
              <View className="gap-2">
                {attachments.map((a) => (
                  <View
                    key={a.id}
                    className="rounded-xl border border-rule/60 bg-paper-2/40 px-3 py-2"
                  >
                    <Text className="text-ink text-sm" numberOfLines={1}>
                      {a.originalName ?? a.key}
                    </Text>
                    <Text className="font-mono text-ink-mute text-xs">
                      {a.mime ?? '?'}
                      {a.size ? ` · ${(a.size / 1024).toFixed(1)} KB` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {task.status !== 'done' ? (
            <Pressable
              onPress={async () => {
                try {
                  await api.tasks.done(task.id);
                  router.back();
                } catch (err) {
                  if (err instanceof Error) Alert.alert('标记失败', err.message);
                }
              }}
              className="mt-8 flex-row items-center justify-center gap-2 rounded-xl bg-ink py-3.5 active:opacity-80"
            >
              <CheckIcon size={18} color="#f4ede0" />
              <Text className="font-medium text-paper text-base">搞定了</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-ink-soft text-base">{label}</Text>
      <Text className="text-ink text-base">{value ?? '—'}</Text>
    </View>
  );
}
