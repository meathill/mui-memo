import type { BarChip } from '@mui-memo/shared/logic';
import { GripVerticalIcon, XIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { useThemeHex } from '@/lib/use-theme-hex';
import { chipKey, chipLabel } from './bar-chip';

// 固定槽位高度：拖拽排序靠绝对定位 + 槽位换算，行高必须确定。
const ROW_H = 48;
const GAP = 8;
const SLOT = ROW_H + GAP;
const SPRING = { damping: 22, stiffness: 220 } as const;

type Positions = Record<string, number>;

function buildPositions(chips: BarChip[]): Positions {
  const p: Positions = {};
  chips.forEach((c, i) => {
    p[chipKey(c)] = i;
  });
  return p;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(value, max));
}

// 把 from 槽位的项移到 to 槽位：交换这两个槽位上的项。拖拽逐格穿越时，连续交换即等价于位移。
function objectMove(positions: Positions, from: number, to: number): Positions {
  'worklet';
  const next: Positions = {};
  for (const id in positions) {
    if (positions[id] === from) next[id] = to;
    else if (positions[id] === to) next[id] = from;
    else next[id] = positions[id];
  }
  return next;
}

interface Props {
  chips: BarChip[];
  pinnedKey: string;
  onReorder: (next: BarChip[]) => void;
  onRemove: (c: BarChip) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * 长按拖动排序的芯片列表。长按某行进入拖拽（haptic 提示），松手提交新顺序；
 * 「全部」(pinnedKey) 可拖动但不可移除。快速划动留给外层 ScrollView 滚动。
 */
export function SortableChipList({ chips, pinnedKey, onReorder, onRemove, onDragStart, onDragEnd }: Props) {
  const positions = useSharedValue<Positions>(buildPositions(chips));

  // 增删 / 提交回流导致 chips 变化时，重建槽位映射。
  useEffect(() => {
    positions.value = buildPositions(chips);
  }, [chips, positions]);

  function commit(snapshot: Positions) {
    const next = [...chips].sort((a, b) => snapshot[chipKey(a)] - snapshot[chipKey(b)]);
    onReorder(next);
  }

  return (
    <View style={{ height: chips.length * SLOT }}>
      {chips.map((c, index) => (
        <SortableRow
          key={chipKey(c)}
          chip={c}
          index={index}
          positions={positions}
          count={chips.length}
          removable={chipKey(c) !== pinnedKey}
          onRemove={() => onRemove(c)}
          onCommit={commit}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </View>
  );
}

interface RowProps {
  chip: BarChip;
  index: number;
  positions: SharedValue<Positions>;
  count: number;
  removable: boolean;
  onRemove: () => void;
  onCommit: (snapshot: Positions) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function SortableRow({
  chip,
  index,
  positions,
  count,
  removable,
  onRemove,
  onCommit,
  onDragStart,
  onDragEnd,
}: RowProps) {
  const colors = useThemeHex();
  const id = chipKey(chip);
  // 新加入的芯片，positions 这一帧还没收录它（靠 useEffect 补），用 index 兜底，避免 NaN 导致整行空白。
  const top = useSharedValue((positions.value[id] ?? index) * SLOT);
  const startTop = useSharedValue(0);
  const active = useSharedValue(false);

  // 非拖拽中的行：槽位变了就平滑归位。
  useAnimatedReaction(
    () => positions.value[id],
    (now, prev) => {
      if (now != null && now !== prev && !active.value) {
        top.value = withSpring(now * SLOT, SPRING);
      }
    },
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(150)
    .onStart(() => {
      active.value = true;
      startTop.value = positions.value[id] * SLOT;
      runOnJS(onDragStart)();
      runOnJS(hapticLight)();
    })
    .onUpdate((e) => {
      top.value = startTop.value + e.translationY;
      const target = clamp(Math.round(top.value / SLOT), 0, count - 1);
      const current = positions.value[id];
      if (target !== current) {
        positions.value = objectMove(positions.value, current, target);
        runOnJS(hapticSelection)();
      }
    })
    .onEnd(() => {
      top.value = withSpring(positions.value[id] * SLOT, SPRING);
    })
    .onFinalize(() => {
      if (!active.value) return;
      active.value = false;
      runOnJS(onCommit)(positions.value);
      runOnJS(onDragEnd)();
    });

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ROW_H,
    transform: [{ translateY: top.value }, { scale: withSpring(active.value ? 1.02 : 1, SPRING) }],
    zIndex: active.value ? 20 : 0,
    elevation: active.value ? 6 : 0,
    shadowColor: '#000',
    shadowOpacity: active.value ? 0.16 : 0,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <View className="h-full flex-row items-center justify-between rounded-2xl border border-ink/30 bg-paper-2/60 px-3">
          <View className="flex-1 flex-row items-center gap-2">
            <GripVerticalIcon size={18} color={colors.inkMute} />
            <Text className="flex-1 text-base text-ink" numberOfLines={1}>
              {chipLabel(chip)}
              {removable ? '' : ' · 始终显示'}
            </Text>
          </View>
          {removable ? (
            <Pressable
              onPress={onRemove}
              hitSlop={8}
              accessibilityLabel="移除"
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-50"
            >
              <XIcon size={18} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
