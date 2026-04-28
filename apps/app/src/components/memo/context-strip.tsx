import type { TaskPlace } from '@mui-memo/shared/validators';
import { Pressable, Text, View } from 'react-native';

const PLACES: { value: TaskPlace; label: string }[] = [
  { value: 'home', label: '在家' },
  { value: 'work', label: '工位' },
  { value: 'out', label: '在外' },
  { value: 'any', label: '全部' },
];

interface Props {
  value: TaskPlace;
  onChange: (p: TaskPlace) => void;
}

export function ContextStrip({ value, onChange }: Props) {
  return (
    <View className="flex-row gap-2">
      {PLACES.map((p) => {
        const active = p.value === value;
        return (
          <Pressable
            key={p.value}
            onPress={() => onChange(p.value)}
            className={`rounded-full px-4 py-2 active:opacity-60 ${active ? 'bg-ink' : 'border border-rule bg-paper-2/50'}`}
          >
            <Text className={`text-sm ${active ? 'text-paper' : 'text-ink-soft'}`}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
