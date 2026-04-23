import { getToken } from '@/lib/session';
import Constants from 'expo-constants';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { PauseIcon, PlayIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  /** 私有 R2 key，经 /api/audio/[...key] 代理回放 */
  audioKey: string;
  label?: string;
}

/**
 * 小胶囊播放器：私有音频 key → 走后端鉴权代理 → expo-audio 流播。
 * 为什么要带 bearer：/api/audio/[...] 要 session 校验 user id 前缀才给流，
 * 所以 source 必须附带 Authorization header。
 */
export function AudioPlayButton({ audioKey, label = '播放原声' }: Props) {
  const apiBase = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase;
  const source = useMemo(() => {
    if (!apiBase) return null;
    const token = getToken();
    return {
      uri: `${apiBase.replace(/\/$/, '')}/api/audio/${audioKey}`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  }, [apiBase, audioKey]);

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  function toggle() {
    if (playing) player.pause();
    else player.play();
  }

  return (
    <Pressable
      onPress={toggle}
      className="flex-row items-center gap-2 self-start rounded-full border border-accent-warm/40 bg-accent-warm/10 px-4 py-2 active:opacity-70"
    >
      {playing ? (
        <PauseIcon size={16} color="#c17a3a" />
      ) : (
        <PlayIcon size={16} color="#c17a3a" />
      )}
      <Text className="font-mono text-accent-warm text-sm">
        {playing ? '暂停' : label}
      </Text>
      {status.duration > 0 ? (
        <Text className="font-mono text-accent-warm/70 text-xs">
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 几个常见音频 mime 判定，拿给详情页过滤附件用
 */
export function isAudioMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith('audio/') || mime === 'video/mp4'; // .m4a 可能报 video/mp4
}

/** 播放 URL 源（非 audioKey）的版本，用在附件 direct URL */
export function AudioUrlPlayButton({ url }: { url: string }) {
  const token = getToken();
  const source = useMemo(
    () => ({ uri: url, headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
    [url, token],
  );
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-full bg-accent-warm/15 active:opacity-70"
      >
        {status.playing ? (
          <PauseIcon size={14} color="#c17a3a" />
        ) : (
          <PlayIcon size={14} color="#c17a3a" />
        )}
      </Pressable>
      {status.duration > 0 ? (
        <Text className="font-mono text-ink-mute text-xs">
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      ) : null}
    </View>
  );
}
