/**
 * 把任意浏览器能 decode 的音频 Blob（webm/mp4/ogg/...）转成 16-bit PCM WAV。
 *
 * 背景：MIMO 的 OpenAI 兼容音频接口通过嗅探数据头识别格式。Chrome MediaRecorder
 * 录出来的 `audio/mp4` 实际是 fragmented MP4，跟标准 m4a 头不同，被服务端拒绝。
 * 直接转 WAV 一劳永逸——任何浏览器、任何 codec 都能落到同一种纯 PCM 容器。
 *
 * 文件大小：单声道 16-bit，30s 录音约 ~1MB（按浏览器默认 ~44.1kHz 采样率算 ~2.6MB）。
 * 语音场景上传量可接受。
 */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  // Safari 老版本要 webkitAudioContext；新版 Safari 已统一到 AudioContext
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new Ctor();
  try {
    // decodeAudioData 在 Safari 老版本只接受 callback；现代浏览器返回 Promise
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } finally {
    void audioCtx.close();
  }
}

/**
 * 标准 RIFF/WAVE 容器，PCM 16-bit。强制单声道（语音场景够用，且体积减半）。
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  // fmt sub-chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  // data sub-chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 多声道时取首声道，避免立体声混音的额外计算
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([ab], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}
