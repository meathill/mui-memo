import type { TaskView } from '@mui-memo/shared/logic';
import { router } from 'expo-router';
import { ChevronRightIcon, CircleIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

interface Props {
  task: TaskView;
  onDone: (id: string) => void;
}

export function TaskRow({ task, onDone }: Props) {
  return (
    <Pressable
      onPress={() => router.push(`/tasks/${task.id}`)}
      className="flex-row items-center gap-3 border-rule/60 border-b py-3 last:border-b-0 active:opacity-70"
    >
      <Pressable
        onPress={() => onDone(task.id)}
        hitSlop={10}
        className="h-6 w-6 items-center justify-center rounded-full active:bg-ink/10"
      >
        <CircleIcon size={18} color="#7a7266" />
      </Pressable>
      <View className="flex-1">
        <Text className="text-ink text-lg leading-snug">{task.text}</Text>
        {task.aiReason ? (
          <Text className="mt-1 text-ink-mute text-sm" numberOfLines={1}>
            {task.aiReason}
          </Text>
        ) : null}
      </View>
      <ChevronRightIcon size={18} color="#7a7266" />
    </Pressable>
  );
}
