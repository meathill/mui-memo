import '../global.css';

import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Notifications, reconcileTaskReminders, type TaskNotificationData } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { resolveTheme, statusBarStyle, THEME_BG_HEX, THEME_TOKENS } from '@/lib/theme';
import { useAppStore } from '@/store';

// 阻止系统自动隐藏 splash：我们想等 session hydrate 完再撤图，避免
// 一瞬「未登录界面 → redirect /today」的抖动。
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const hydrate = useSession((s) => s.hydrate);
  const themePref = useAppStore((s) => s.theme);
  const systemScheme = useColorScheme();
  const resolved = resolveTheme(themePref, systemScheme);

  useEffect(() => {
    // 启动分两步：
    //  1. hydrate 本地 SecureStore（毫秒级）→ 立刻隐 splash，进 /today 或 /login
    //  2. 异步 getSession 刷一份最新 user，不阻塞 UI；网络错就保持缓存态
    (async () => {
      try {
        await hydrate();
      } finally {
        SplashScreen.hideAsync().catch(() => undefined);
      }
      const token = useSession.getState().token;
      if (!token) return;
      try {
        const user = await api.auth.getSession();
        if (user) {
          await useSession.getState().setSession(token, user);
        } else {
          await useSession.getState().clearSession();
        }
      } catch {
        // 网络错误不清 session，后续请求会自己重试
      }
    })();
  }, [hydrate]);

  // 订阅 tasks 变更 → 增量 reconcile 本地通知
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.tasks === prev.tasks) return;
      reconcileTaskReminders(state.tasks).catch(() => undefined);
    });
    return unsub;
  }, []);

  // 通知点击 → 跳详情
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as TaskNotificationData | undefined;
      if (data?.taskId) router.push(`/tasks/${data.taskId}`);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={[{ flex: 1 }, vars(THEME_TOKENS[resolved])]}>
        <StatusBar style={statusBarStyle(resolved)} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: THEME_BG_HEX[resolved] },
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
