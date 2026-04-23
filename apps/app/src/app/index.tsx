import { useSession } from '@/lib/session';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * 入口 gate：等 SecureStore hydrate 完，按 token 有无转发。
 * 第一次打开无 token → /login；下次已登录 → /today。
 */
export default function Index() {
  const { hydrating, token } = useSession();

  if (hydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#1d1a12" />
      </View>
    );
  }

  return <Redirect href={token ? '/today' : '/login'} />;
}
