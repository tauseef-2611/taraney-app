// Line-level timeline. Pure functions, shared by the player and (later) the Sync Studio.
import type { Recording } from './types';

export interface Cue { key: string; occ: number; line: number; start: number; end: number }

/** A line stays lit this long past its end, so tiny gaps between lines do not flicker. */
export const LINE_HOLD_MS = 300;

export function buildTimeline(rec?: Recording | null): Cue[] {
  if (!rec || rec.sync_level !== 1 || !Array.isArray(rec.lines)) return [];
  const lines = rec.lines
    .filter((l) => Number.isFinite(l?.start_ms))
    .map((l, order) => ({ l, order }))
    .sort((a, b) => a.l.start_ms - b.l.start_ms || a.order - b.order)
    .map(({ l }) => l);
  return lines.map((l, i) => {
    const next = lines[i + 1];
    const end = Number.isFinite(l.end_ms) && (l.end_ms as number) > l.start_ms ? (l.end_ms as number) : next ? next.start_ms : Infinity;
    return { key: `${l.occ}:${l.line}`, occ: l.occ, line: l.line, start: l.start_ms, end };
  });
}

/** Index of the last cue starting at or before t, or -1. */
export function cueIndexAt(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/** The cue to highlight at time t, or null in an instrumental gap. */
export function activeCue(cues: Cue[], t: number, hold = LINE_HOLD_MS): Cue | null {
  const i = cueIndexAt(cues, t);
  if (i < 0) return null;
  const c = cues[i];
  const next = cues[i + 1];
  const limit = next ? Math.min(c.end + hold, next.start) : c.end + hold;
  return t < Math.max(limit, c.end) ? c : null;
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
