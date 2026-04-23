import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Linking from 'expo-linking';
import { MicIcon, SendIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

interface Props {
  /** 录音满 3s 松手时触发。uri 是本地 file://... m4a */
  onAudio: (payload: { uri: string; mimeType: string }) => void;
  disabled?: boolean;
  /** 上传中等外部状态展示 */
  processing?: boolean;
}

const MIN_DURATION_MS = 3000;

type PermStatus = 'unknown' | 'granted' | 'prompt' | 'blocked';

export function MicButton({ onAudio, disabled, processing }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const startedAtRef = useRef<number>(0);
  const [hint, setHint] = useState<string | null>(null);
  const [perm, setPerm] = useState<PermStatus>('unknown');

  useEffect(() => {
    // 只查不请，进屏不要立刻弹系统权限框。首次按按钮时才触发系统弹窗。
    AudioModule.getRecordingPermissionsAsync()
      .then((p) => setPerm(p.granted ? 'granted' : p.canAskAgain ? 'prompt' : 'blocked'))
      .catch(() => setPerm('prompt'));
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const handlePressIn = useCallback(async () => {
    if (disabled || processing) return;
    setHint(null);

    // 已被系统级拒绝（canAskAgain=false）：点也没用，引导去设置
    if (perm === 'blocked') {
      Alert.alert(
        '麦克风被禁用',
        '你之前拒绝过麦克风权限，系统不会再弹提示。需要到「设置 → MuiMemo」手动打开。',
        [
          { text: '取消', style: 'cancel' },
          { text: '去设置', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    try {
      // granted / prompt 都走一次 request，系统自动判重
      const res = await AudioModule.requestRecordingPermissionsAsync();
      if (!res.granted) {
        setPerm(res.canAskAgain ? 'prompt' : 'blocked');
        setHint(
          res.canAskAgain ? '没给麦克风权限，点一下再试' : '已被系统拒绝，去设置里打开麦克风',
        );
        return;
      }
      setPerm('granted');
      await recorder.prepareToRecordAsync();
      startedAtRef.current = Date.now();
      recorder.record();
    } catch (err) {
      setHint(err instanceof Error ? err.message : '录音启动失败');
    }
  }, [disabled, processing, perm, recorder]);

  const handlePressOut = useCallback(async () => {
    if (!state.isRecording && startedAtRef.current === 0) return;
    const held = Date.now() - startedAtRef.current;
    startedAtRef.current = 0;
    try {
      await recorder.stop();
    } catch {
      // stop 有时在 prepare 前调用会抛，忽略
    }
    if (held < MIN_DURATION_MS) {
      setHint(`再按住久一点（至少 ${MIN_DURATION_MS / 1000} 秒）`);
      return;
    }
    const uri = recorder.uri;
    if (!uri) {
      setHint('没拿到录音文件，再试一次');
      return;
    }
    onAudio({ uri, mimeType: 'audio/m4a' });
  }, [onAudio, recorder, state.isRecording]);

  const durationLabel = state.isRecording
    ? `${Math.floor(state.durationMillis / 1000)}s`
    : '按住说话';

  return (
    <View className="items-center">
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || processing}
        className={`h-20 w-20 items-center justify-center rounded-full ${
          state.isRecording ? 'bg-accent-warm' : 'bg-ink'
        } active:opacity-80`}
      >
        {processing ? (
          <ActivityIndicator color="#f4ede0" />
        ) : state.isRecording ? (
          <SendIcon size={28} color="#f4ede0" />
        ) : (
          <MicIcon size={28} color="#f4ede0" />
        )}
      </Pressable>
      <Text className="mt-2 font-mono text-ink-mute text-xs">
        {processing ? '解析中…' : durationLabel}
      </Text>
      {hint ? <Text className="mt-1 text-accent-warn text-sm">{hint}</Text> : null}
    </View>
  );
}
