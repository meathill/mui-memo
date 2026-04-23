import { PLACE_LABEL, type TaskView } from '@mui-memo/shared/logic';
import { router } from 'expo-router';
import { CheckIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

interface Props {
  task: TaskView;
  onDone: (id: string) => void | Promise<void>;
}

/**
 * 当前正在做的任务卡片 + 呼吸灯。
 *
 * 呼吸灯用一个绝对定位的 ring 盖在卡片上，scale 轻微涨一点、opacity 从 0.5 → 0，
 * 循环 2.4s，对标 web 的 mm-pulse box-shadow 效果。只动装饰层，文字和内容不抖。
 */
export function DoingCard({ task, onDone }: Props) {
  const place = PLACE_LABEL[task.place];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }));

  const dotStyle = useAnimatedStyle(() => {
    // 小圆点做简单明暗呼吸：从 1 → 0.3 → 1
    const o = progress.value < 0.5 ? 1 - progress.value : progress.value;
    return { opacity: 0.4 + 0.6 * o };
  });

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={ringStyle}
        className="absolute inset-0 rounded-2xl border-2 border-accent-warm"
      />
      <Pressable
        onPress={() => router.push(`/tasks/${task.id}`)}
        className="rounded-2xl border border-accent-warm/40 bg-accent-warm/10 p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-1.5">
          <Animated.View style={dotStyle} className="h-1.5 w-1.5 rounded-full bg-accent-warm" />
          <Text className="font-mono text-xs text-accent-warm uppercase tracking-[2px]">正在做</Text>
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
    </View>
  );
}
