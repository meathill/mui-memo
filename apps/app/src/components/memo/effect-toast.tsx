import type { IntentEffect } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

interface Props {
  effects: IntentEffect[];
  utterance: Utterance | null;
}

const MAX_VISIBLE = 3;

/** Web 端 EffectToast 的 RN 版，简化：2s 自动隐藏。多 effect 竖向叠层。 */
export function EffectToast({ effects, utterance }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!effects.length) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [effects]);

  if (!visible || !effects.length) return null;
  const list = effects.slice(0, MAX_VISIBLE);
  const more = effects.length - list.length;

  return (
    <View className="mt-3 gap-1.5">
      {list.map((effect, i) => {
        const tone = effect.kind === 'miss' ? 'bg-accent-warn' : 'bg-accent-good';
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: effect 没有 id 时（miss）只能用位置区分；toast 是瞬态、列表不会重排
            key={`${effect.kind}-${'id' in effect ? effect.id : 'miss'}-${i}`}
            className={`rounded-lg px-4 py-2.5 ${tone}`}
          >
            <Text className="font-medium text-paper text-base">{effect.verb ?? effect.kind}</Text>
            {'text' in effect && effect.text ? (
              <Text className="mt-0.5 text-paper/85 text-sm" numberOfLines={1}>
                「{effect.text}」
              </Text>
            ) : utterance?.raw ? (
              <Text className="mt-0.5 text-paper/85 text-sm" numberOfLines={1}>
                「{utterance.raw}」
              </Text>
            ) : null}
          </View>
        );
      })}
      {more > 0 ? <Text className="text-center text-ink-soft text-xs">还有 {more} 条</Text> : null}
    </View>
  );
}
