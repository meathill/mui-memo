import type { BarChip } from '@mui-memo/shared/logic';
import type { TaskPlace } from '@mui-memo/shared/validators';
import { PencilIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { hapticLight, hapticSelection } from '@/lib/haptics';
import { useThemeHex } from '@/lib/use-theme-hex';
import { chipKey, chipLabel } from './bar-chip';
import { BarEditorModal } from './bar-editor-modal';

interface Props {
  chips: BarChip[];
  place: TaskPlace;
  activeTag: string | null;
  allTags: string[];
  onSelectPlace: (p: TaskPlace) => void;
  onSelectTag: (tag: string | null) => void;
  onSaveChips: (chips: BarChip[]) => void;
}

/**
 * 自定义筛选栏：可自由配置展示哪些场景 / 标签芯片，单选过滤。
 * - 选场景芯片：按地点筛（沿用原行为，语音也用该场景上下文）。
 * - 选标签芯片：按标签筛（today 层用 'any' 排序，不限地点）。
 */
export function ContextStrip({ chips, place, activeTag, allTags, onSelectPlace, onSelectTag, onSaveChips }: Props) {
  const colors = useThemeHex();
  const [editorOpen, setEditorOpen] = useState(false);

  // 失效的 tag 芯片（标签已不在任何任务上）不显示；但保留在持久化里，标签回来会重新出现。
  const visibleChips = chips.filter((c) => c.kind === 'place' || allTags.includes(c.tag));

  function isActive(c: BarChip): boolean {
    if (c.kind === 'tag') return activeTag === c.tag;
    return !activeTag && c.place === place;
  }

  function handlePress(c: BarChip) {
    hapticSelection();
    if (c.kind === 'tag') onSelectTag(c.tag);
    else onSelectPlace(c.place);
  }

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {visibleChips.map((c) => {
        const active = isActive(c);
        return (
          <Pressable
            key={chipKey(c)}
            onPress={() => handlePress(c)}
            className={`rounded-full px-4 py-2 active:opacity-60 ${active ? 'bg-ink' : 'border border-rule bg-paper-2/50'}`}
          >
            <Text className={`text-sm ${active ? 'text-paper' : 'text-ink-soft'}`}>{chipLabel(c)}</Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => {
          hapticLight();
          setEditorOpen(true);
        }}
        hitSlop={8}
        accessibilityLabel="编辑筛选栏"
        className="h-9 w-9 items-center justify-center rounded-full active:opacity-50"
      >
        <PencilIcon size={16} color={colors.inkMute} />
      </Pressable>

      <BarEditorModal
        visible={editorOpen}
        chips={chips}
        allTags={allTags}
        onSave={(next) => {
          onSaveChips(next);
          setEditorOpen(false);
        }}
        onClose={() => setEditorOpen(false)}
      />
    </View>
  );
}
