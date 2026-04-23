import { ApiError, api } from '@/lib/api';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      await api.auth.signInEmail(email.trim(), password);
      router.replace('/today');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? '邮箱或密码不对'
          : err instanceof Error
            ? err.message
            : '登录失败',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center">
            <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">
              MuiMemo
            </Text>
            <Text className="mt-2 font-serif text-3xl text-ink">欢迎回来</Text>
            <Text className="mt-1 text-ink-soft text-sm">说一句话，把琐事记下来。</Text>
          </View>

          <View className="mt-10 space-y-4">
            <Field label="邮箱">
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                className="rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-ink text-base"
              />
            </Field>
            <Field label="密码">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                className="rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-ink text-base"
              />
            </Field>

            {error ? <Text className="text-red-700 text-sm">{error}</Text> : null}

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              className="mt-2 items-center justify-center rounded-lg bg-ink py-3.5 active:opacity-80"
            >
              {loading ? (
                <ActivityIndicator color="#f4ede0" />
              ) : (
                <Text className="font-medium text-paper text-base">登录</Text>
              )}
            </Pressable>
          </View>

          <Text className="mt-8 text-center text-ink-soft text-sm">
            还没有账号？{' '}
            <Link href="/register" className="text-accent-warm underline">
              去注册
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="space-y-1.5">
      <Text className="text-ink-soft text-sm">{label}</Text>
      {children}
    </View>
  );
}
