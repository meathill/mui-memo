import type { IntentEffect } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

interface Props {
  effect: IntentEffect | null;
  utterance: Utterance | null;
}

/** Web 端 EffectToast 的 RN 版，简化：2s 自动隐藏 */
export function EffectToast({ effect, utterance }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!effect) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [effect]);

  if (!visible || !effect) return null;

  const tone = effect.kind === 'miss' ? 'bg-accent-warn' : 'bg-accent-good';

  return (
    <View className={`mt-3 rounded-lg px-3 py-2 ${tone}`}>
      <Text className="font-medium text-paper text-sm">{effect.verb ?? effect.kind}</Text>
      {utterance?.raw ? (
        <Text className="text-paper/85 text-xs" numberOfLines={1}>
          「{utterance.raw}」
        </Text>
      ) : null}
    </View>
  );
}
