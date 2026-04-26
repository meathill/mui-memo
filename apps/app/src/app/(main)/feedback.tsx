import { router } from 'expo-router';
import { ChevronLeftIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const TAG_OPTIONS = ['bug', '建议', '其他'] as const;

export default function FeedbackScreen() {
  const user = useSession((s) => s.user);
  const [content, setContent] = useState('');
  const [contact, setContact] = useState(user?.email ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) {
      Alert.alert('请填写反馈内容');
      return;
    }
    setBusy(true);
    try {
      await api.feedback.submit({ content: text, contact: contact.trim(), tags });
      Alert.alert('已提交', '感谢你的反馈！', [{ text: '好', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('提交失败', err instanceof Error ? err.message : '请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-2 pt-2 pb-1">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center active:opacity-60"
            hitSlop={8}
          >
            <ChevronLeftIcon size={24} color="#1d1a12" />
          </Pressable>
          <Text className="font-serif text-ink text-lg">意见反馈</Text>
        </View>

        <ScrollView contentContainerClassName="px-5 pt-2 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="font-mono text-ink-mute text-xs uppercase tracking-[2px]">反馈内容</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="遇到了什么问题？或者你想要什么功能？"
            placeholderTextColor="#9c958a"
            multiline
            textAlignVertical="top"
            className="mt-2 min-h-32 rounded-2xl border border-rule/60 bg-paper-2/50 px-4 py-3 font-serif text-base text-ink"
          />

          <Text className="mt-5 font-mono text-ink-mute text-xs uppercase tracking-[2px]">联系方式（选填）</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="邮箱 / 微信，方便我们联系你"
            placeholderTextColor="#9c958a"
            autoCapitalize="none"
            keyboardType="email-address"
            className="mt-2 rounded-2xl border border-rule/60 bg-paper-2/50 px-4 py-3 font-mono text-ink text-sm"
          />

          <Text className="mt-5 font-mono text-ink-mute text-xs uppercase tracking-[2px]">标签</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  className={`rounded-full border px-4 py-1.5 active:opacity-70 ${
                    selected ? 'border-ink bg-ink' : 'border-rule/60 bg-paper-2/50'
                  }`}
                >
                  <Text className={`font-mono text-xs ${selected ? 'text-paper' : 'text-ink-mute'}`}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            className="mt-8 flex-row items-center justify-center gap-2 rounded-xl bg-ink py-3.5 active:opacity-80 disabled:opacity-50"
          >
            {busy ? <ActivityIndicator color="#f4ede0" /> : null}
            <Text className="font-serif text-base text-paper">提交</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
