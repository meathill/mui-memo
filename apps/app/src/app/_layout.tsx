import '../global.css';

import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { useEffect, useRef } from 'react';
import { Alert, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RecordingIndicator } from '@/components/recording-indicator';
import { api } from '@/lib/api';
import { applyConfirm, showConfirm } from '@/lib/intent-confirm';
import { Notifications, reconcileTaskReminders, type TaskNotificationData } from '@/lib/notifications';
import { startQueuePump } from '@/lib/queue-pump';
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

  // 待处理录音队列的后台 pump：跨 tab、跨页面常驻，逐条顺序处理。
  useEffect(() => startQueuePump(), []);

  // 全局确认弹窗：MODIFY/DONE 命中时弹 Alert，决定后调后端并 shift。放根 layout 而非
  // 今天页——pump 在后台跑、用户可能不在今天页，否则弹不出来、pump 会因待确认卡死。
  const pendingConfirms = useAppStore((s) => s.pendingConfirms);
  const promptingRef = useRef(false);
  useEffect(() => {
    const head = pendingConfirms[0];
    if (!head || promptingRef.current) return;
    promptingRef.current = true;
    showConfirm(head, async (choice) => {
      promptingRef.current = false;
      try {
        await applyConfirm(head, choice);
      } catch (err) {
        if (err instanceof Error) Alert.alert('保存失败', err.message);
      } finally {
        useAppStore.getState().shiftPendingConfirm();
      }
    });
  }, [pendingConfirms]);

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
        {/* 全局录音指示条：浮在所有页面/tab 之上，录音时常驻，无开关可关（Apple 2.5.14） */}
        <RecordingIndicator />
      </View>
    </SafeAreaProvider>
  );
}
