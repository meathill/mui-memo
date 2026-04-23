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
    // 启动：先从 SecureStore 捞 token 恢复状态，再向后端刷一次 user 信息
    hydrate().then(async () => {
      const token = useSession.getState().token;
      if (!token) return;
      try {
        const user = await api.auth.getSession();
        if (user) {
          // 已有 token，刷新 user 即可；setSession 会重新写 SecureStore（没事）
          await useSession.getState().setSession(token, user);
        }
        // getSession 返回 null 时 request() 已经在 401 里清了 session
      } catch {
        // 网络错误先不动 session，让用户看登录态 UI
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
