import type { BarChip } from '@mui-memo/shared/logic';
import { PLACES } from '@mui-memo/shared/logic';
import { PlusIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useThemeHex } from '@/lib/use-theme-hex';
import { chipKey, chipLabel, sameChip } from './bar-chip';
import { SortableChipList } from './sortable-chip-list';

interface Props {
  visible: boolean;
  chips: BarChip[];
  allTags: string[];
  onSave: (chips: BarChip[]) => void;
  onClose: () => void;
}

const PLACE_CANDIDATES: BarChip[] = PLACES.map((place) => ({ kind: 'place', place }));
// 「全部」常开：始终保留清空筛选的退路，不允许移除（但允许拖动调整位置）。
const PINNED: BarChip = { kind: 'place', place: 'any' };
const PINNED_KEY = chipKey(PINNED);

/**
 * 筛选栏编辑弹窗：底部抽屉。
 * - 「显示中」长按拖动排序、点 ✕ 移除（「全部」不可移除）。
 * - 「可添加」列出还没进栏的场景 / 标签，点 + 加到末尾。
 * 草稿改完点「完成」一次性保存，取消则丢弃。
 */
export function BarEditorModal({ visible, chips, allTags, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<BarChip[]>(chips);
  const [dragging, setDragging] = useState(false);

  // 每次打开都用当前 chips 重置草稿，丢弃上次未保存的改动。
  useEffect(() => {
    if (visible) setDraft(chips);
  }, [visible, chips]);

  // 可添加 = 所有候选（场景 + 现存标签）里，还没进草稿的。
  const addable = useMemo<BarChip[]>(() => {
    const tagCandidates = allTags.map((tag): BarChip => ({ kind: 'tag', tag }));
    return [...PLACE_CANDIDATES, ...tagCandidates].filter((c) => !draft.some((d) => sameChip(d, c)));
  }, [allTags, draft]);

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
      {/* Modal 内容在独立视图层，手势必须自带 GestureHandlerRootView，否则拖拽收不到事件 */}
      <GestureHandlerRootView style={{ flex: 1 }}>
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

            {/* 拖拽时禁掉外层滚动，避免与拖拽抢手势 */}
            <ScrollView className="max-h-96" showsVerticalScrollIndicator={false} scrollEnabled={!dragging}>
              <Text className="mb-2 font-mono text-ink-mute text-xs uppercase tracking-[2px]">
                显示中 · 长按拖动排序
              </Text>
              <SortableChipList
                chips={draft}
                pinnedKey={PINNED_KEY}
                onReorder={setDraft}
                onRemove={remove}
                onDragStart={() => setDragging(true)}
                onDragEnd={() => setDragging(false)}
              />

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
      </GestureHandlerRootView>
    </Modal>
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
