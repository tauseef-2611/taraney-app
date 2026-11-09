// Build-time content access (runs in Node during `astro build` / dev SSR only).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveMood } from '../lib/mood';
import type { SongDoc, TimedLine } from '../lib/types';

export interface PubRecording {
  id: string; kind: 'audio' | 'youtube'; audio_url: string | null; youtube_id: string | null; label: string | null;
  duration_ms: number | null; is_primary: boolean; sync_level: 0 | 1; structure: string[] | null; lines: TimedLine[];
}
export interface PubSong {
  id: string; slug: string; publish_state: string; reviewed: boolean; title_ur: string | null; title_ro: string | null;
  genre: string | null; themes: string[]; mood: string; poet_ur: string | null; poet_ro: string | null; singer: string | null;
  doc: SongDoc; created_at: string; updated_at: string; published_at: string | null; recordings: PubRecording[];
}

let cache: PubSong[] | null = null;

export function allSongs(): PubSong[] {
  if (cache) return cache;
  const file = resolve('src/data/songs.generated.json');
  if (!existsSync(file)) {
    console.warn('[taraney] src/data/songs.generated.json missing. Run `npm run content` first.');
    return (cache = []);
  }
  const raw = JSON.parse(readFileSync(file, 'utf8')).songs as PubSong[];
  return (cache = raw.map((s) => ({ ...s, mood: s.mood || deriveMood(s.genre, s.themes) })));
}

export const primaryRec = (s: PubSong) => s.recordings.find((r) => r.kind === 'audio' && r.audio_url) || null;
export const videoRec = (s: PubSong) => s.recordings.find((r) => r.kind === 'youtube' && r.youtube_id) || null;

/** Card-sized summary for lists and the client search index. */
export function cardOf(s: PubSong) {
  const a = primaryRec(s);
  return {
    id: s.id, slug: s.slug, title_ur: s.title_ur, title_ro: s.title_ro, genre: s.genre, themes: s.themes, mood: s.mood,
    poet_ro: s.poet_ro, singer: s.singer, has_audio: !!a, has_video: !!videoRec(s), synced: !!a && a.sync_level === 1,
  };
}
export type Card = ReturnType<typeof cardOf>;

export const songHref = (s: { slug: string }) => `/t/${s.slug}/`;
