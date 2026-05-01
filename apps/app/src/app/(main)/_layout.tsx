import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useThemeHex } from '@/lib/use-theme-hex';

/**
 * 登录后的 Stack：未登录踢回 /login；登录后走 Tabs 子布局 +
 * 可推的全屏页（比如 /tasks/[id] 详情）。
 */
export default function MainLayout() {
  const { hydrating, token } = useSession();
  const colors = useThemeHex();

  if (hydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tasks/[id]/index" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen
        name="tasks/[id]/edit"
        options={{
          // modal：全屏下滑返回，兼容性比 formSheet 稳
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen name="feedback" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}
