import type { BarChip } from '@mui-memo/shared/logic';
import { PLACES } from '@mui-memo/shared/logic';
import { CheckIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
// 「全部」常开：始终保留清空筛选的退路，不允许移除。
const PINNED: BarChip = { kind: 'place', place: 'any' };

/**
 * 筛选栏编辑弹窗：底部抽屉，复选哪些场景 / 标签出现在栏里。
 * 草稿按勾选顺序排列，即为筛选栏的展示顺序（v1 不做拖拽重排）。
 */
export function BarEditorModal({ visible, chips, allTags, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<BarChip[]>(chips);

  // 每次打开都用当前 chips 重置草稿，丢弃上次未保存的改动。
  useEffect(() => {
    if (visible) setDraft(chips);
  }, [visible, chips]);

  const tagCandidates = useMemo<BarChip[]>(() => allTags.map((tag) => ({ kind: 'tag', tag })), [allTags]);

  function isIncluded(c: BarChip): boolean {
    return draft.some((d) => sameChip(d, c));
  }

  function toggle(c: BarChip) {
    if (sameChip(c, PINNED)) return; // 全部 不可移除
    hapticSelection();
    setDraft((d) => (d.some((x) => sameChip(x, c)) ? d.filter((x) => !sameChip(x, c)) : [...d, c]));
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
            <ChipChecklist caption="场景" items={PLACE_CANDIDATES} isIncluded={isIncluded} onToggle={toggle} />
            {tagCandidates.length > 0 ? (
              <ChipChecklist caption="标签" items={tagCandidates} isIncluded={isIncluded} onToggle={toggle} />
            ) : (
              <Text className="mt-2 px-1 text-ink-mute text-xs">还没有标签。给任务加上标签后，这里就能选了。</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ChipChecklist({
  caption,
  items,
  isIncluded,
  onToggle,
}: {
  caption: string;
  items: BarChip[];
  isIncluded: (c: BarChip) => boolean;
  onToggle: (c: BarChip) => void;
}) {
  const colors = useThemeHex();
  return (
    <View className="mt-2 mb-2">
      <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">{caption}</Text>
      <View className="gap-2">
        {items.map((c) => {
          const pinned = sameChip(c, PINNED);
          const included = pinned || isIncluded(c);
          return (
            <Pressable
              key={chipKey(c)}
              onPress={() => onToggle(c)}
              disabled={pinned}
              className={`flex-row items-center justify-between rounded-2xl border px-4 py-3 ${
                included ? 'border-ink/30 bg-paper-2/60' : 'border-rule bg-paper'
              } ${pinned ? 'opacity-60' : 'active:opacity-70'}`}
            >
              <Text className={`text-base ${included ? 'text-ink' : 'text-ink-soft'}`}>
                {chipLabel(c)}
                {pinned ? ' · 始终显示' : ''}
              </Text>
              {included ? (
                <CheckIcon size={18} color={colors.ink} />
              ) : (
                <View className="h-[18px] w-[18px] rounded-full border border-rule" />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
