import type { BarChip } from '@mui-memo/shared/logic';
import { moveBarChip, PLACES } from '@mui-memo/shared/logic';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XIcon } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useThemeHex } from '@/lib/use-theme-hex';
import { chipKey, chipLabel, sameChip } from './bar-chip';

interface Props {
  visible: boolean;
  chips: BarChip[];
  allTags: string[];
  onSave: (chips: BarChip[]) => void;
  onClose: () => void;
}

const PLACE_CANDIDATES: BarChip[] = PLACES.map((place) => ({ kind: 'place', place }));
// 「全部」常开：始终保留清空筛选的退路，不允许移除（但允许调整位置）。
const PINNED: BarChip = { kind: 'place', place: 'any' };

/**
 * 筛选栏编辑弹窗：底部抽屉。
 * - 「显示中」按实际展示顺序排列，可上 / 下移动、移除（「全部」不可移除）。
 * - 「可添加」列出还没进栏的场景 / 标签，点 + 加到末尾。
 * 草稿改完点「完成」一次性保存，取消则丢弃。
 */
export function BarEditorModal({ visible, chips, allTags, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<BarChip[]>(chips);

  // 每次打开都用当前 chips 重置草稿，丢弃上次未保存的改动。
  useEffect(() => {
    if (visible) setDraft(chips);
  }, [visible, chips]);

  // 可添加 = 所有候选（场景 + 现存标签）里，还没进草稿的。
  const addable = useMemo<BarChip[]>(() => {
    const tagCandidates = allTags.map((tag): BarChip => ({ kind: 'tag', tag }));
    return [...PLACE_CANDIDATES, ...tagCandidates].filter((c) => !draft.some((d) => sameChip(d, c)));
  }, [allTags, draft]);

  function move(index: number, delta: number) {
    hapticSelection();
    setDraft((d) => moveBarChip(d, index, delta));
  }

  function remove(c: BarChip) {
    if (sameChip(c, PINNED)) return; // 全部 不可移除
    hapticSelection();
    setDraft((d) => d.filter((x) => !sameChip(x, c)));
  }

  function add(c: BarChip) {
    hapticSelection();
    setDraft((d) => [...d, c]);
  }

  function handleSave() {
    hapticSuccess();
    // 兜底：保证「全部」始终在栏里，永远有清空筛选的退路。
    const next = draft.some((d) => sameChip(d, PINNED)) ? draft : [...draft, PINNED];
    onSave(next);
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-2xl bg-paper px-4 pt-4 pb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-base text-ink-mute">取消</Text>
            </Pressable>
            <Text className="font-serif font-bold text-base text-ink">筛选栏</Text>
            <Pressable onPress={handleSave} hitSlop={8}>
              <Text className="font-bold text-base text-ink">完成</Text>
            </Pressable>
          </View>

          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">显示中 · 上下调整顺序</Text>
            <View className="gap-2">
              {draft.map((c, i) => (
                <SelectedRow
                  key={chipKey(c)}
                  chip={c}
                  isFirst={i === 0}
                  isLast={i === draft.length - 1}
                  pinned={sameChip(c, PINNED)}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  onRemove={() => remove(c)}
                />
              ))}
            </View>

            {addable.length > 0 ? (
              <>
                <Text className="mt-5 mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">可添加</Text>
                <View className="gap-2">
                  {addable.map((c) => (
                    <AddRow key={chipKey(c)} chip={c} onAdd={() => add(c)} />
                  ))}
                </View>
              </>
            ) : null}

            {allTags.length === 0 ? (
              <Text className="mt-4 px-1 text-ink-mute text-xs">还没有标签。给任务加上标签后，这里就能选了。</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SelectedRow({
  chip,
  isFirst,
  isLast,
  pinned,
  onUp,
  onDown,
  onRemove,
}: {
  chip: BarChip;
  isFirst: boolean;
  isLast: boolean;
  pinned: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const colors = useThemeHex();
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-ink/30 bg-paper-2/60 px-4 py-2.5">
      <Text className="flex-1 text-base text-ink" numberOfLines={1}>
        {chipLabel(chip)}
        {pinned ? ' · 始终显示' : ''}
      </Text>
      <View className="flex-row items-center gap-1">
        <IconButton disabled={isFirst} onPress={onUp} label="上移">
          <ChevronUpIcon size={18} color={colors.ink} />
        </IconButton>
        <IconButton disabled={isLast} onPress={onDown} label="下移">
          <ChevronDownIcon size={18} color={colors.ink} />
        </IconButton>
        <IconButton disabled={pinned} onPress={onRemove} label="移除">
          <XIcon size={18} color={colors.ink} />
        </IconButton>
      </View>
    </View>
  );
}

function AddRow({ chip, onAdd }: { chip: BarChip; onAdd: () => void }) {
  const colors = useThemeHex();
  return (
    <Pressable
      onPress={onAdd}
      accessibilityLabel={`添加 ${chipLabel(chip)}`}
      className="flex-row items-center justify-between rounded-2xl border border-rule bg-paper px-4 py-2.5 active:opacity-70"
    >
      <Text className="flex-1 text-base text-ink-soft" numberOfLines={1}>
        {chipLabel(chip)}
      </Text>
      <PlusIcon size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

function IconButton({
  children,
  onPress,
  disabled,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={label}
      className={`h-8 w-8 items-center justify-center rounded-full ${disabled ? 'opacity-25' : 'active:opacity-50'}`}
    >
      {children}
    </Pressable>
  );
}
