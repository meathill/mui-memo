"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  disabled?: boolean;
  onAudio: (blob: Blob) => void | Promise<void>;
}

type Phase = "idle" | "recording" | "processing";

/**
 * 长按录音。支持触摸长按、鼠标长按、Space 键长按。
 * 最短录音时长 300ms，避免误触发。
 */
export function MicButton({ disabled, onAudio }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startAtRef = useRef(0);

  const stopAll = useCallback(() => {
    const rec = mediaRef.current;
    mediaRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || phase !== "idle") return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (Date.now() - startAtRef.current < 300 || blob.size === 0) {
          setPhase("idle");
          return;
        }
        setPhase("processing");
        try {
          await onAudio(blob);
        } catch (err) {
          setError(err instanceof Error ? err.message : "处理失败");
        } finally {
          setPhase("idle");
        }
      };
      startAtRef.current = Date.now();
      rec.start();
      setPhase("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法访问麦克风");
      stopAll();
      setPhase("idle");
    }
  }, [disabled, phase, onAudio, stopAll]);

  const stopRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.stop();
    mediaRef.current = null;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
        e.preventDefault();
        startRecording();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        stopRecording();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startRecording, stopRecording]);

  useEffect(() => stopAll, [stopAll]);

  const label =
    phase === "recording"
      ? "松开发送"
      : phase === "processing"
        ? "AI 解析中…"
        : "按住说话";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || phase === "processing"}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all",
          "bg-ink text-paper shadow-lg shadow-ink/25 active:scale-95",
          phase === "recording" &&
            "bg-accent-warm shadow-accent-warm/30 scale-105",
          phase === "processing" && "animate-pulse bg-ink/60",
          disabled && "opacity-50",
        )}
        aria-label={label}
      >
        {phase === "recording" ? (
          <div className="flex items-end gap-1 h-8">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="mm-bar w-1 rounded-full bg-paper"
                style={{ height: "100%", animationDelay: `${i * 120}ms` }}
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
