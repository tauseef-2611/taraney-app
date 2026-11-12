// Pure clip logic for Reel Studio: maps a slice of the song onto a short timed clip.
// No DOM. All times are milliseconds.
import { expandSung } from '../lib/song-shape';
import { buildTimeline } from '../lib/timeline';
import type { Recording, SongDoc } from '../lib/types';
import type { Clip, FlatLine, StudioLine } from './types';

/** Hard ceiling for a clip's length. */
export const MAX_CLIP_MS = 90_000;

/** defaultRange stops adding lines before the clip would exceed this length. */
const DEFAULT_RANGE_MS = 30_000;
const DEFAULT_RANGE_LINES = 8;
const LEAD_IN_MS = 500;
const TAIL_MS = 700;
const SYNCED_LEAD_MS = 500;
const SYNCED_FALLBACK_MS = 4000;
const SYNCED_MAX_LINE_MS = 8000;
const SYNCED_MIN_LINE_MS = 300;
const DEFAULT_SEC_PER_LINE = 3.5;

/** Every line of the song in sung order, with its recording start and end (null when unsynced). */
export function flattenSong(doc: SongDoc, structure: string[] | null | undefined, rec: Recording | null | undefined): FlatLine[] {
  const cues = new Map(buildTimeline(rec).map((c) => [c.key, c]));
  const out: FlatLine[] = [];
  for (const block of expandSung(doc, structure || doc.structure)) {
    for (const l of block.lines) {
      if (!l.ur && !l.ro) continue;
      const key = `${block.occ}:${l.line}`;
      const cue = cues.get(key);
      out.push({
        key,
        occ: block.occ,
        line: l.line,
        ur: l.ur,
        ro: l.ro,
        start: cue ? cue.start : null,
        end: cue && Number.isFinite(cue.end) ? cue.end : null,
      });
    }
  }
  return out;
}

const EMPTY_CLIP: Clip = { lines: [], duration: 0, audioStartMs: 0, synced: false };

const clampIndex = (i: number, length: number) => Math.max(0, Math.min(length - 1, Math.floor(i)));

/** Clip for the inclusive index range [from, to]. Synced when every selected line has a recording start. */
export function buildClip(flat: FlatLine[], from: number, to: number, secPerLine = DEFAULT_SEC_PER_LINE): Clip {
  if (!flat.length || !Number.isFinite(from) || !Number.isFinite(to)) return { ...EMPTY_CLIP, lines: [] };
  const a = clampIndex(Math.min(from, to), flat.length);
  const b = clampIndex(Math.max(from, to), flat.length);
  const sel = flat.slice(a, b + 1);
  if (!sel.length) return { ...EMPTY_CLIP, lines: [] };

  if (sel.every((l) => l.start !== null)) {
    const audioStartMs = Math.max(0, (sel[0].start as number) - SYNCED_LEAD_MS);
    const lines: StudioLine[] = sel.map((l, i) => {
      const start = (l.start as number) - audioStartMs;
      const nextStart = sel[i + 1]?.start ?? null;
      const absEnd = l.end ?? nextStart ?? (l.start as number) + SYNCED_FALLBACK_MS;
      const capped = Math.min(absEnd - audioStartMs, start + SYNCED_MAX_LINE_MS);
      const end = Math.max(capped, start + SYNCED_MIN_LINE_MS);
      return { key: l.key, ur: l.ur, ro: l.ro, start, end };
    });
    return {
      lines,
      duration: lines[lines.length - 1].end + TAIL_MS,
      audioStartMs,
      synced: true,
    };
  }

  const per = (Number.isFinite(secPerLine) && secPerLine > 0 ? secPerLine : DEFAULT_SEC_PER_LINE) * 1000;
  const audioStartMs = sel[0].start ?? 0;
  const lines: StudioLine[] = sel.map((l, i) => {
    const start = LEAD_IN_MS + i * per;
    return { key: l.key, ur: l.ur, ro: l.ro, start, end: start + per };
  });
  return {
    lines,
    duration: lines[lines.length - 1].end + TAIL_MS,
    audioStartMs,
    synced: false,
  };
}

/** Default inclusive range starting at startIndex: up to 8 lines, staying within 30 seconds. Always at least one line. */
export function defaultRange(flat: FlatLine[], startIndex = 0): [number, number] {
  if (!flat.length) return [0, 0];
  const s = clampIndex(Number.isFinite(startIndex) ? startIndex : 0, flat.length);
  let e = s;
  while (e + 1 < flat.length && e - s + 1 < DEFAULT_RANGE_LINES) {
    if (buildClip(flat, s, e + 1).duration > DEFAULT_RANGE_MS) break;
    e++;
  }
  return [s, e];
}
