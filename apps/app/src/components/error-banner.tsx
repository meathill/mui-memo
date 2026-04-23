import { Pressable, Text, View } from 'react-native';

interface Props {
  message: string | null;
  onRetry: () => void;
  title?: string;
}

/**
 * 非阻塞的网络错误横条。比 Alert 友好：不打断手头操作，顶着按钮让用户自己决定何时重试。
 * 所有走 /api/* 的列表页都应该用它替代 Alert.alert。
 */
export function ErrorBanner({ message, onRetry, title = '连不上服务器' }: Props) {
  if (!message) return null;
  return (
    <View className="rounded-lg border border-accent-warn/40 bg-accent-warn/10 p-3">
      <Text className="font-medium text-accent-warn text-sm">{title}</Text>
      <Text className="mt-0.5 text-ink-soft text-xs" numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        hitSlop={6}
        className="mt-2 self-start rounded-full bg-ink px-3 py-1.5 active:opacity-80"
      >
        <Text className="text-paper text-xs">重试</Text>
      </Pressable>
    </View>
  );
}
