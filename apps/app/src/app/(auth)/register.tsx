import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { ApiError, api } from '@/lib/api';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password || !name) return;
    setError(null);
    setLoading(true);
    try {
      await api.auth.signUpEmail(email.trim(), password, name.trim());
      router.replace('/today');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 justify-center px-6">
          <View className="items-center">
            <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">MuiMemo</Text>
            <Text className="mt-2 font-serif text-3xl text-ink">开个号</Text>
            <Text className="mt-1 text-ink-soft text-sm">两步搞定，等下就能对着手机说话。</Text>
          </View>

          <View className="mt-10">
            <AppleSignInButton />
          </View>

          <View className="mt-6 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-rule/60" />
            <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">或用邮箱</Text>
            <View className="h-px flex-1 bg-rule/60" />
          </View>

          <View className="mt-4 space-y-4">
            <Field label="怎么称呼你">
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                className="rounded-lg border border-rule bg-paper-2/50 px-4 py-3 text-ink text-base"
              />
            </Field>
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
                autoComplete="new-password"
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
                <Text className="font-medium text-paper text-base">注册</Text>
              )}
            </Pressable>
          </View>

          <Text className="mt-8 text-center text-ink-soft text-sm">
            已有账号？{' '}
            <Link href="/login" className="text-accent-warm underline">
              回登录
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="space-y-1.5">
      <Text className="text-ink-soft text-sm">{label}</Text>
      {children}
    </View>
  );
}
