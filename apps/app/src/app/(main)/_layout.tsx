import { useSession } from '@/lib/session';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * 登录后的 Stack：未登录踢回 /login；登录后走 Tabs 子布局 +
 * 可推的全屏页（比如 /tasks/[id] 详情）。
 */
export default function MainLayout() {
  const { hydrating, token } = useSession();

  if (hydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#1d1a12" />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tasks/[id]" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}
