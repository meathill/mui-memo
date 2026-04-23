import { ErrorBanner } from '@/components/error-banner';
import { type ProfileStats, api } from '@/lib/api';
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
        <Text className="font-mono text-ink-mute text-[11px] uppercase tracking-[2px]">
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
            <Text className="font-mono text-ink-mute text-xs" numberOfLines={1}>
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
      <Text className="font-mono text-[11px] text-ink-mute uppercase tracking-[2px]">{label}</Text>
      <Text className="mt-1 font-serif text-3xl text-ink">{value}</Text>
    </View>
  );
}
