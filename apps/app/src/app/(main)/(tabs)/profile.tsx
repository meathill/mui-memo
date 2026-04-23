import { ErrorBanner } from '@/components/error-banner';
import { type ProfileStats, api } from '@/lib/api';
import {
  type PermStatus,
  getPermissionStatus,
  requestPermission,
} from '@/lib/notifications';
import * as Linking from 'expo-linking';
import { BellIcon, ZapIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { LogOutIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [data, setData] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<PermStatus>('prompt');

  useEffect(() => {
    getPermissionStatus().then(setNotifPerm).catch(() => undefined);
  }, []);

  const handleNotifTap = useCallback(async () => {
    if (notifPerm === 'granted') return;
    if (notifPerm === 'blocked') {
      Linking.openSettings();
      return;
    }
    const next = await requestPermission();
    setNotifPerm(next);
    if (next === 'blocked') {
      Alert.alert('已被拒绝', '到「设置 → MuiMemo → 通知」手动打开。');
    }
  }, [notifPerm]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.profile.stats();
      setData(d);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleLogout = useCallback(() => {
    Alert.alert('退出登录？', '', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.signOut();
          } finally {
            router.replace('/login');
          }
        },
      },
    ]);
  }, []);

  const initial = data?.user.name?.charAt(0)?.toUpperCase() ?? '·';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-5 pt-4 pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d1a12" />
        }
      >
        <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">
          MuiMemo · 我的
        </Text>
        <Text className="mt-1 font-serif text-2xl text-ink">账号与数据</Text>

        {loadError ? (
          <View className="mt-4">
            <ErrorBanner message={loadError} onRetry={load} />
          </View>
        ) : null}

        <View className="mt-6 flex-row items-center gap-4 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-ink">
            <Text className="font-serif text-paper text-xl">{initial}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-serif text-ink text-lg" numberOfLines={1}>
              {data?.user.name ?? '…'}
            </Text>
            <Text className="mt-0.5 font-mono text-ink-mute text-sm" numberOfLines={1}>
              {data?.user.email ?? ''}
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row flex-wrap gap-3">
          <StatCard label="今日已勾" value={data?.stats.doneToday ?? 0} accent />
          <StatCard label="累计完成" value={data?.stats.done ?? 0} />
          <StatCard label="清单待办" value={data?.stats.pending ?? 0} />
          <StatCard label="正在做" value={data?.stats.doing ?? 0} />
        </View>

        <Pressable
          onPress={handleNotifTap}
          disabled={notifPerm === 'granted'}
          className="mt-5 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-warm/15">
            <BellIcon size={18} color="#c17a3a" />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-base text-ink">到点提醒</Text>
            <Text className="mt-0.5 text-ink-soft text-sm">
              {notifPerm === 'granted'
                ? '已打开 · 有预期时间的任务到点会弹通知'
                : notifPerm === 'blocked'
                  ? '被系统禁用 · 点这里去设置里打开'
                  : '点一下开启，让到点的任务主动提醒你'}
            </Text>
          </View>
          {notifPerm !== 'granted' ? (
            <Text className="font-mono text-accent-warm text-sm">
              {notifPerm === 'blocked' ? '去设置' : '开启'}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert(
              'Siri 快捷指令',
              [
                '在 iOS「快捷指令」app 里加一个新指令：',
                '',
                '1. 动作选「打开 URL」',
                '2. URL 填：muimemo://',
                '3. 指令名改成「记一下」之类',
                '',
                '然后对 Siri 说「嘿 Siri, 记一下」就会打开 MuiMemo。',
              ].join('\n'),
              [
                { text: '知道了', style: 'cancel' },
                {
                  text: '打开快捷指令',
                  onPress: () =>
                    Linking.openURL('shortcuts://').catch(() =>
                      Alert.alert('打不开', '请到主屏找「快捷指令」app'),
                    ),
                },
              ],
            );
          }}
          className="mt-3 flex-row items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/50 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-good/15">
            <ZapIcon size={18} color="#4a9670" />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-base text-ink">Siri 快捷指令</Text>
            <Text className="mt-0.5 text-ink-soft text-sm">
              「嘿 Siri, 记一下」一秒打开 MuiMemo
            </Text>
          </View>
          <Text className="font-mono text-accent-good text-sm">怎么配</Text>
        </Pressable>

        {loading ? (
          <View className="mt-4 items-center">
            <ActivityIndicator color="#1d1a12" />
          </View>
        ) : null}

        <Pressable
          onPress={handleLogout}
          className="mt-8 flex-row items-center justify-center gap-2 rounded-xl border border-rule py-3.5 active:opacity-70"
        >
          <LogOutIcon size={18} color="#1d1a12" />
          <Text className="text-ink text-base">退出登录</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View
      className={`flex-1 basis-[45%] rounded-2xl border p-4 ${
        accent ? 'border-accent-warm/40 bg-accent-warm/10' : 'border-rule/60 bg-paper-2/50'
      }`}
    >
      <Text className="font-mono text-xs text-ink-mute uppercase tracking-[2px]">{label}</Text>
      <Text className="mt-1 font-serif text-3xl text-ink">{value}</Text>
    </View>
  );
}
