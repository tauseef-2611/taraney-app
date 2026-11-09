// Global player. One <audio> for the whole app; module state survives page changes
// (Astro ClientRouter keeps modules loaded), so playback never stops while browsing.
import { useEffect, useState } from 'preact/hooks';
import type { SongDoc, TimedLine } from '../lib/types';

export interface PlayerSong {
  id: string; slug: string; title_ur: string | null; title_ro: string | null; mood: string; doc: SongDoc;
}
export interface PlayerRec {
  id: string; audio_url: string; label: string | null; duration_ms: number | null; sync_level: 0 | 1;
  structure: string[] | null; lines: TimedLine[];
}
export interface PlayerState { song: PlayerSong | null; rec: PlayerRec | null; playing: boolean; t: number; duration: number; rate: number; expanded: boolean }

const listeners = new Set<(s: PlayerState) => void>();
let state: PlayerState = { song: null, rec: null, playing: false, t: 0, duration: 0, rate: 1, expanded: false };
const audio: HTMLAudioElement | null = typeof window !== 'undefined' ? new Audio() : null;
let raf = 0;

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}
function loop() {
  if (!audio) return;
  set({ t: audio.currentTime * 1000 });
  raf = requestAnimationFrame(loop);
}

if (audio) {
  audio.preload = 'metadata';
  audio.addEventListener('play', () => { set({ playing: true }); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
  audio.addEventListener('pause', () => { set({ playing: false, t: audio.currentTime * 1000 }); cancelAnimationFrame(raf); });
  audio.addEventListener('ended', () => set({ playing: false }));
  audio.addEventListener('loadedmetadata', () => set({ duration: audio.duration * 1000 }));
  audio.addEventListener('seeked', () => set({ t: audio.currentTime * 1000 }));
}

function mediaSession(song: PlayerSong) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: song.title_ro || song.title_ur || 'Tarana', artist: 'Taraney', artwork: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] });
  navigator.mediaSession.setActionHandler('play', () => audio?.play());
  navigator.mediaSession.setActionHandler('pause', () => audio?.pause());
  navigator.mediaSession.setActionHandler('seekbackward', () => player.seek(state.t - 10000));
  navigator.mediaSession.setActionHandler('seekforward', () => player.seek(state.t + 10000));
}

export const player = {
  get: () => state,
  subscribe(fn: (s: PlayerState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Loads a recording (keeps position if it is already loaded) and optionally plays from `atMs`. */
  async play(song: PlayerSong, rec: PlayerRec, atMs?: number) {
    if (!audio) return;
    if (state.rec?.id !== rec.id) {
      audio.src = rec.audio_url;
      audio.playbackRate = state.rate;
      set({ song, rec, t: 0, duration: rec.duration_ms || 0 });
      mediaSession(song);
    }
    if (atMs !== undefined) audio.currentTime = Math.max(0, atMs) / 1000;
    try { await audio.play(); } catch { /* autoplay blocked: user taps play */ }
  },
  toggle() { if (!audio || !state.rec) return; if (audio.paused) audio.play(); else audio.pause(); },
  seek(ms: number) { if (!audio || !state.rec) return; audio.currentTime = Math.max(0, Math.min(ms, state.duration || ms)) / 1000; set({ t: audio.currentTime * 1000 }); },
  setRate(r: number) { if (audio) audio.playbackRate = r; set({ rate: r }); },
  close() { if (!audio) return; audio.pause(); audio.removeAttribute('src'); audio.load(); set({ song: null, rec: null, playing: false, t: 0, expanded: false }); },
  /** Opens or closes the full-screen player. */
  expand(open: boolean) { set({ expanded: open && !!state.rec }); },
};

export function usePlayer(): PlayerState {
  const [s, setS] = useState(state);
  useEffect(() => player.subscribe(setS), []);
  return s;
}
