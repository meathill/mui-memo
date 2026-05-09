import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useThemeHex } from '@/lib/use-theme-hex';

/**
 * 入口 gate：等 SecureStore hydrate 完，按 token 有无转发。
 * 第一次打开无 token → /login；下次已登录 → /today。
 */
export default function Index() {
  const { hydrating, token } = useSession();
  const colors = useThemeHex();

  if (hydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return <Redirect href={token ? '/today' : '/login'} />;
}
