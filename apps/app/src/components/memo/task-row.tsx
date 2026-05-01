import type { TaskView } from '@mui-memo/shared/logic';
import { router } from 'expo-router';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react-native';
import { useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useThemeHex } from '@/lib/use-theme-hex';

interface Props {
  task: TaskView;
  onDone: (id: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function TaskRow({ task, onDone }: Props) {
  const colors = useThemeHex();
  const triggered = useRef(false);
  const naturalHeight = useSharedValue(0);
  const collapse = useSharedValue(1);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const checkProgress = useSharedValue(0); // 0 = 圆圈，1 = 对勾
  const strike = useSharedValue(0); // 删除线 0..1

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
    height: naturalHeight.value > 0 ? naturalHeight.value * collapse.value : undefined,
    overflow: 'hidden',
  }));
  const circleStyle = useAnimatedStyle(() => ({ opacity: 1 - checkProgress.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkProgress.value,
    transform: [{ scale: 0.6 + 0.4 * checkProgress.value }],
  }));
  const strikeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: strike.value }],
  }));

  function notifyDone() {
    onDone(task.id);
  }

  function handleMarkDone() {
    if (triggered.current) return;
    triggered.current = true;

    // 1) 圆圈 → 对勾，删除线划过 (0–280ms)
    checkProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    strike.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });

    // 2) 整条向左飞出 (280–680ms)
    translateX.value = withDelay(280, withTiming(-SCREEN_WIDTH, { duration: 400, easing: Easing.in(Easing.cubic) }));
    opacity.value = withDelay(480, withTiming(0, { duration: 200 }));

    // 3) 行高坍缩，下方上移挤占 (600–900ms)
    collapse.value = withDelay(
      600,
      withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(notifyDone)();
      }),
    );
  }

  return (
    <Animated.View
      style={containerStyle}
      onLayout={(e) => {
        if (naturalHeight.value === 0) naturalHeight.value = e.nativeEvent.layout.height;
      }}
      className="border-rule/60 border-b py-3 last:border-b-0"
    >
      <Pressable
        onPress={() => router.push(`/tasks/${task.id}`)}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <Pressable
          onPress={handleMarkDone}
          hitSlop={10}
          className="relative h-6 w-6 items-center justify-center rounded-full active:bg-ink/10"
        >
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.iconCenter, circleStyle]} pointerEvents="none">
            <CircleIcon size={18} color={colors.inkMute} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              styles.iconCenter,
              { backgroundColor: colors.accentGood, borderRadius: 9999 },
              checkStyle,
            ]}
            pointerEvents="none"
          >
            <CheckIcon size={14} color={colors.paper} />
          </Animated.View>
        </Pressable>
        <View className="flex-1">
          <View style={styles.relative}>
            <Text className="text-ink text-lg leading-snug">{task.text}</Text>
            <Animated.View
              pointerEvents="none"
              style={[styles.strike, { backgroundColor: colors.inkMute }, strikeStyle]}
            />
          </View>
          {task.aiReason ? (
            <Text className="mt-1 text-ink-mute text-sm" numberOfLines={1}>
              {task.aiReason}
            </Text>
          ) : null}
        </View>
        <ChevronRightIcon size={18} color={colors.inkMute} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconCenter: { alignItems: 'center', justifyContent: 'center' },
  relative: { position: 'relative' },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1.5,
    marginTop: -0.75,
    transformOrigin: 'left',
  },
});
