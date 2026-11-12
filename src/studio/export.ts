// Records the animated Reel Studio canvas (and the song segment) to a video file in real time.
// Browser only. Uses MediaRecorder and captureStream.
import { drawFrame, ensureStudioFonts } from './render';
import { FORMATS, type ExportResult, type Project } from './types';

export interface ExportOptions {
  project: Project;
  audioUrl?: string | null;
  audioStartMs: number;
  fps?: number;
  scale?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const CANDIDATES: { mime: string; ext: 'mp4' | 'webm' }[] = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

const AUDIO_READY_TIMEOUT_MS = 4000;
const AUDIO_STALL_MS = 1500;
const FADE_IN_S = 0.4;
const FADE_OUT_S = 0.6;
const TAIL_GUARD_MS = 5000;

/** First MediaRecorder type the browser supports. MP4 first because WhatsApp and Instagram need it. */
export function pickMime(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of CANDIDATES) if (MediaRecorder.isTypeSupported(c.mime)) return { ...c };
  return null;
}

export function canExport(): boolean {
  return pickMime() !== null && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

const abortError = () => new DOMException('Video export was cancelled', 'AbortError');

/** Resolves on the ok event, rejects on error or abort, and gives up after a timeout when one is set. */
function waitForMedia(el: HTMLMediaElement, ok: string, signal: AbortSignal | undefined, timeoutMs?: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      el.removeEventListener(ok, onOk);
      el.removeEventListener('error', onErr);
      signal?.removeEventListener('abort', onAbort);
      if (timer !== undefined) clearTimeout(timer);
    };
    const onOk = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new Error('Could not load the audio')); };
    const onAbort = () => { cleanup(); reject(abortError()); };
    el.addEventListener(ok, onOk);
    el.addEventListener('error', onErr);
    signal?.addEventListener('abort', onAbort);
    if (timeoutMs !== undefined) timer = setTimeout(() => { cleanup(); resolve(); }, timeoutMs);
  });
}

export async function exportVideo(o: ExportOptions): Promise<ExportResult> {
  if (!canExport()) throw new Error('Video export is not supported in this browser');
  const picked = pickMime();
  if (!picked) throw new Error('Video export is not supported in this browser');
  const signal = o.signal;
  if (signal?.aborted) throw abortError();

  const { project } = o;
  const duration = project.duration;
  const scale = o.scale && o.scale > 0 ? o.scale : 1;
  const fmt = FORMATS[project.format];

  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let audio: HTMLAudioElement | null = null;
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let rafId = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | null = null;

  const paint = (t: number) => {
    if (!g) return;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    drawFrame(g, project, t);
  };

  try {
    await ensureStudioFonts();
    if (signal?.aborted) throw abortError();

    canvas = document.createElement('canvas');
    canvas.width = even(fmt.w * scale);
    canvas.height = even(fmt.h * scale);
    g = canvas.getContext('2d');
    if (!g) throw new Error('Canvas is not available in this browser');
    paint(0);

    stream = canvas.captureStream(o.fps ?? 30);

    if (o.audioUrl) {
      const a = new Audio();
      audio = a;
      a.crossOrigin = 'anonymous';
      a.preload = 'auto';
      const metaReady = waitForMedia(a, 'loadedmetadata', signal);
      a.src = o.audioUrl;
      await metaReady;
      if (signal?.aborted) throw abortError();

      const target = Math.max(0, o.audioStartMs) / 1000;
      if (Math.abs(a.currentTime - target) > 0.01) {
        const seeked = waitForMedia(a, 'seeked', signal, AUDIO_READY_TIMEOUT_MS);
        a.currentTime = target;
        await seeked;
      }

      const ac = new AudioContext();
      ctx = ac;
      const source = ac.createMediaElementSource(a);
      const gain = ac.createGain();
      const dest = ac.createMediaStreamDestination();
      // Not connected to ac.destination: the export is silent for the listener.
      source.connect(gain);
      gain.connect(dest);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
      await ac.resume();
      const t0 = ac.currentTime;
      const end = t0 + duration / 1000;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(1, t0 + FADE_IN_S);
      gain.gain.setValueAtTime(1, Math.max(t0 + FADE_IN_S, end - FADE_OUT_S));
      gain.gain.linearRampToValueAtTime(0, end);
    }

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, {
      mimeType: picked.mime,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder = rec;
    rec.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.start(250);

    if (audio) await audio.play();

    await new Promise<void>((resolve, reject) => {
      const wallStart = performance.now();
      // Clock: the audio element while it advances, otherwise the wall clock from the last known time.
      let clock: 'audio' | 'wall' = audio ? 'audio' : 'wall';
      let tRef = 0;
      let wallRef = wallStart;
      let lastAudioT = Number.NaN;
      let lastAudioChange = wallStart;
      let t = 0;
      let finished = false;

      const stop = () => {
        finished = true;
        cancelAnimationFrame(rafId);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
      };
      const done = () => { if (finished) return; stop(); resolve(); };
      const fail = () => { if (finished) return; stop(); reject(abortError()); };
      onAbort = fail;
      signal?.addEventListener('abort', fail);

      const clipTime = (now: number): number => {
        if (clock === 'audio' && audio) {
          const at = audio.currentTime * 1000 - o.audioStartMs;
          if (at !== lastAudioT) {
            lastAudioT = at;
            lastAudioChange = now;
          } else if (now - lastAudioChange > AUDIO_STALL_MS) {
            clock = 'wall';
            tRef = t;
            wallRef = now;
          }
          if (clock === 'audio') return at;
        }
        return tRef + (now - wallRef);
      };

      const tick = () => {
        if (finished) return;
        const now = performance.now();
        t = Math.min(Math.max(clipTime(now), 0), duration);
        paint(t);
        o.onProgress?.(duration > 0 ? t / duration : 1);
        if (t >= duration) { done(); return; }
        rafId = requestAnimationFrame(tick);
      };

      // Hard guard: the export always ends, even if audio and animation both stall.
      timeoutId = setTimeout(done, duration + TAIL_GUARD_MS);
      rafId = requestAnimationFrame(tick);
    });

    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    if (rec.state !== 'inactive') rec.stop();
    await stopped;

    const mime = picked.mime.split(';')[0];
    return { blob: new Blob(chunks, { type: mime }), ext: picked.ext, mime };
  } finally {
    cancelAnimationFrame(rafId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* already stopping */ }
    }
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    stream?.getTracks().forEach((tr) => tr.stop());
    if (ctx) void ctx.close().catch(() => {});
  }
}

export async function shareOrSaveVideo(r: ExportResult, name: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([r.blob], `${name}.${r.ext}`, { type: r.blob.type });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  saveVideo(r, name);
  return 'downloaded';
}

export function saveVideo(r: ExportResult, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.blob);
  a.download = `${name}.${r.ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
