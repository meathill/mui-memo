import { type AudioPlayer, type AudioStatus, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Constants from 'expo-constants';
import { AlertCircleIcon, PauseIcon, PlayIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getToken } from '@/lib/session';

interface Props {
  /** 私有 R2 key，经 /api/audio/[...key] 代理回放 */
  audioKey: string;
  label?: string;
}

/**
 * 小胶囊播放器：私有音频 key → 走后端鉴权代理 → expo-audio 流播。
 * 为什么要带 bearer：/api/audio/[...] 要 session 校验 user id 前缀才给流，
 * 所以 source 必须附带 Authorization header。
 *
 * 错误兜底：useAudioErrorFallback 监听播放后是否在 5s 内进入可播状态，
 * 没进就显示错误态——避免历史上「点了没反应也没报错」的静默失败。
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
  const { error, onPlay } = useAudioErrorFallback(status);
  useRewindOnFinish(player, status.didJustFinish);
  const playing = status.playing;

  function toggle() {
    if (error || !playing) {
      // 错误态点击 = 重试；正常态非播放 = 开始播。两条路径都要进 onPlay 启动超时计时
      player.play();
      onPlay();
    } else {
      player.pause();
    }
  }

  if (error) {
    return (
      <Pressable
        onPress={toggle}
        className="flex-row items-center gap-2 self-start rounded-full border border-ink-mute/30 bg-ink-mute/10 px-4 py-2 active:opacity-70"
      >
        <AlertCircleIcon size={16} color="#7a7266" />
        <Text className="font-mono text-ink-mute text-sm">播放失败 · 重试</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      className="flex-row items-center gap-2 self-start rounded-full border border-accent-warm/40 bg-accent-warm/10 px-4 py-2 active:opacity-70"
    >
      {playing ? <PauseIcon size={16} color="#c17a3a" /> : <PlayIcon size={16} color="#c17a3a" />}
      <Text className="font-mono text-accent-warm text-sm">{playing ? '暂停' : label}</Text>
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
  const { error, onPlay } = useAudioErrorFallback(status);
  useRewindOnFinish(player, status.didJustFinish);
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={() => {
          if (error || !status.playing) {
            player.play();
            onPlay();
          } else {
            player.pause();
          }
        }}
        hitSlop={8}
        className={`h-8 w-8 items-center justify-center rounded-full ${
          error ? 'bg-ink-mute/15' : 'bg-accent-warm/15'
        } active:opacity-70`}
      >
        {error ? (
          <AlertCircleIcon size={14} color="#7a7266" />
        ) : status.playing ? (
          <PauseIcon size={14} color="#c17a3a" />
        ) : (
          <PlayIcon size={14} color="#c17a3a" />
        )}
      </Pressable>
      {error ? (
        <Text className="font-mono text-ink-mute text-xs">播放失败</Text>
      ) : status.duration > 0 ? (
        <Text className="font-mono text-ink-mute text-xs">
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * 监听点击播放后是否在 LOAD_TIMEOUT_MS 内拿到 duration。没拿到就置错误态。
 * 为什么 5s：iOS LTE 上 R2 跨洋首字节通常 < 2s；5s 既能容忍弱网，又不会让真错误等太久。
 *
 * expo-audio 的 useAudioPlayerStatus 不暴露 error/failed 字段，无法直接监听加载失败，
 * 只能靠超时启发式兜底。
 *
 * 两个 effect 各司其职：
 * - load-watcher：任一可播指标（isLoaded/duration/playing）变正常 → 自动清错 + 取消 attempting
 * - timer：attempting 期间起 5s 超时，没指标就置错误态
 *
 * 这样错误态不会粘住——若 5s 边缘命中错误但 6s 时实际加载好了，load-watcher
 * 会自动恢复 UI。
 */
const LOAD_TIMEOUT_MS = 5000;

function useAudioErrorFallback(status: AudioStatus): { error: boolean; onPlay: () => void } {
  const [error, setError] = useState(false);
  // 0 = 未在等待加载；非零数字 = 当前 attempt 序号。
  // 用递增 id 而不是 boolean：用户连点 play 时同值 setState 会被 React bail out，
  // effect 不重跑、老 timer 不会被替换，「启新一轮超时」就不成立。
  const [attemptId, setAttemptId] = useState(0);

  // load-watcher：可播指标变正常 → 自动清错 + 取消 attempt（顺带让 timer cleanup）
  useEffect(() => {
    if (status.isLoaded || status.duration > 0 || status.playing) {
      setAttemptId(0);
      setError(false);
    }
  }, [status.isLoaded, status.duration, status.playing]);

  // timer：每个 attemptId 起一次 5s 超时；attemptId 变 0（成功）或递增（重试）都触发 cleanup
  useEffect(() => {
    if (attemptId === 0) return;
    const timer = setTimeout(() => {
      setError(true);
      setAttemptId(0);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attemptId]);

  return {
    error,
    onPlay: () => {
      // 主动点击播放（含错误态重试）：清错 + 启新一轮超时
      setError(false);
      setAttemptId((id) => id + 1);
    },
  };
}

/**
 * 播完自动把播放头归零，方便用户连续重听。
 *
 * 为什么必须：iOS AVPlayer 播完后 currentTime 停在 duration，再调 player.play()
 * 会立即触发 didJustFinish 不重新播。expo-audio 没自带「auto-rewind」开关，
 * 这里在 didJustFinish 由 false 变 true 时主动 seekTo(0)。
 */
function useRewindOnFinish(player: AudioPlayer, didJustFinish: boolean) {
  useEffect(() => {
    if (didJustFinish) {
      player.seekTo(0);
    }
  }, [didJustFinish, player]);
}
