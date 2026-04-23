import { PLACE_LABEL, type TaskView } from '@mui-memo/shared/logic';
import { router } from 'expo-router';
import { CheckIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface Props {
  task: TaskView;
  onDone: (id: string) => void | Promise<void>;
}

/**
 * 当前正在做的任务卡片。和 Web 的 DoingCard 对齐：
 * - 呼吸灯先不做（mm-pulse CSS 动画 RN 需要 Reanimated，后续再加）
 * - 点卡片跳详情；「搞定」按钮独立拦截事件
 */
export function DoingCard({ task, onDone }: Props) {
  const place = PLACE_LABEL[task.place];

  return (
    <Pressable
      onPress={() => router.push(`/tasks/${task.id}`)}
      className="rounded-2xl border border-accent-warm/40 bg-accent-warm/10 p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-1.5">
        <View className="h-1.5 w-1.5 rounded-full bg-accent-warm" />
        <Text className="font-mono text-xs text-accent-warm uppercase tracking-[2px]">
          正在做
        </Text>
      </View>
      <Text className="mt-1 font-serif text-ink text-2xl leading-snug">{task.text}</Text>
      <View className="mt-2 flex-row flex-wrap gap-x-2">
        <Text className="font-mono text-ink-mute text-sm">
          {place.icon} {place.label}
        </Text>
        {task.aiReason ? (
          <Text className="font-mono text-ink-mute text-sm" numberOfLines={1}>
            · {task.aiReason}
          </Text>
        ) : null}
      </View>

      {task.linked?.length ? (
        <View className="mt-3 gap-1 border-rule/50 border-t pt-2">
          {task.linked.map((c) => (
            <View key={c.id} className="flex-row items-center gap-2">
              <Text className="text-accent-warm/70">↳</Text>
              <Text className="font-serif text-ink-soft text-sm" numberOfLines={1}>
                {c.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => onDone(task.id)}
        hitSlop={6}
        className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-ink px-4 py-2 active:opacity-80"
      >
        <CheckIcon size={16} color="#f4ede0" />
        <Text className="text-paper text-sm">搞定了</Text>
      </Pressable>
    </Pressable>
  );
}
