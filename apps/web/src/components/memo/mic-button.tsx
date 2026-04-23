'use client';

import { cn } from '@/lib/utils';
import { MicIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  disabled?: boolean;
  onAudio: (blob: Blob) => void | Promise<void>;
}

type Phase = 'idle' | 'recording' | 'processing';

/** 最短录音时长：太短的录音 Gemini 没足够信号，AI 容易胡猜。 */
const MIN_DURATION_MS = 3000;

/**
 * 长按录音。支持触摸长按、鼠标长按、Space 键长按。
 * 低于 {@link MIN_DURATION_MS} 的录音会被丢弃并给用户提示。
 */
export function MicButton({ disabled, onAudio }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    stopTick();
    const rec = mediaRef.current;
    mediaRef.current = null;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopTick]);

  const startRecording = useCallback(async () => {
    if (disabled || phase !== 'idle') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stopTick();
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const duration = Date.now() - startAtRef.current;
        setElapsedMs(0);
        if (duration < MIN_DURATION_MS) {
          setError(`说久一点：至少 ${MIN_DURATION_MS / 1000} 秒`);
          setPhase('idle');
          return;
        }
        if (blob.size === 0) {
          setPhase('idle');
          return;
        }
        setPhase('processing');
        try {
          await onAudio(blob);
        } catch (err) {
          setError(err instanceof Error ? err.message : '处理失败');
        } finally {
          setPhase('idle');
        }
      };
      startAtRef.current = Date.now();
      rec.start();
      setPhase('recording');
      setElapsedMs(0);
      // 每 100ms tick 一次，让按钮上显示的倒计时 / 进度平滑
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startAtRef.current);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法访问麦克风');
      stopAll();
      setPhase('idle');
    }
  }, [disabled, phase, onAudio, stopAll]);

  const stopRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.stop();
    mediaRef.current = null;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
        e.preventDefault();
        startRecording();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        stopRecording();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRecording, stopRecording]);

  useEffect(() => stopAll, [stopAll]);

  const reachedMin = elapsedMs >= MIN_DURATION_MS;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  const minSec = MIN_DURATION_MS / 1000;
  const label =
    phase === 'recording'
      ? reachedMin
        ? `松开发送 · ${elapsedSec}s`
        : `${elapsedSec}s / ${minSec}s`
      : phase === 'processing'
        ? 'AI 解析中…'
        : `按住说话 · ≥${minSec}s`;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || phase === 'processing'}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full transition-all touch-manipulation select-none',
          'bg-ink text-paper shadow-lg shadow-ink/25 active:scale-95',
          phase === 'recording' && !reachedMin && 'bg-ink/70 shadow-ink/20 scale-105',
          phase === 'recording' && reachedMin && 'bg-accent-warm shadow-accent-warm/30 scale-105',
          phase === 'processing' && 'animate-pulse bg-ink/60',
          disabled && 'opacity-50',
        )}
        aria-label={label}
      >
        {phase === 'recording' ? (
          <div className="flex items-end gap-1 h-8">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="mm-bar w-1 rounded-full bg-paper"
                style={{ height: '100%', animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : (
          <MicIcon className="h-7 w-7" />
        )}
      </button>
      <p className="h-4 font-mono text-[11px] text-ink-mute">{label}</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
