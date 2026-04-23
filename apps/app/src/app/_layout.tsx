import '../global.css';

import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const hydrate = useSession((s) => s.hydrate);

  useEffect(() => {
    // 启动：先从 SecureStore 捞 token + 缓存的 user（断网也能正常进主屏），
    // 再尝试异步刷一份最新 user。
    hydrate().then(async () => {
      const token = useSession.getState().token;
      if (!token) return;
      try {
        const user = await api.auth.getSession();
        if (user) {
          await useSession.getState().setSession(token, user);
        } else {
          // 200 但 user 为空（bearer token 已失效）：清掉，跳登录
          await useSession.getState().clearSession();
        }
      } catch {
        // 网络错误：token + 缓存 user 仍在内存，保持登录态，后续请求自己会重试
      }
    });
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f4ede0' },
        }}
      />
    </SafeAreaProvider>
  );
}
