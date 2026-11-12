import { describe, expect, it } from 'vitest';
import { buildClip, defaultRange, flattenSong } from '../src/studio/clip';
import type { FlatLine } from '../src/studio/types';
import type { Recording, SongDoc } from '../src/lib/types';

const fl = (key: string, start: number | null, end: number | null = null): FlatLine => {
  const [occ, line] = key.split(':').map(Number);
  return { key, occ, line, ur: `ur ${key}`, ro: `ro ${key}`, start, end };
};

describe('flattenSong', () => {
  const doc: SongDoc = {
    sections: [
      { id: 'v1', type: 'verse', layout: 'couplet', lines: [{ ur: 'a', ro: 'a1' }, { ur: 'b', ro: 'b1' }, {}] },
      { id: 'r1', type: 'refrain', layout: 'single', lines: [{ ro: 'c' }] },
    ],
    structure: ['v1', 'r1', 'v1'],
  };
  const rec = {
    id: 'r',
    kind: 'audio',
    sync_level: 1,
    lines: [
      { occ: 0, section: 'v1', line: 0, start_ms: 1000, end_ms: 2000 },
      { occ: 0, section: 'v1', line: 1, start_ms: 2000 },
      { occ: 1, section: 'r1', line: 0, start_ms: 3000, end_ms: 4500 },
      { occ: 2, section: 'v1', line: 0, start_ms: 5000 },
    ],
  } as unknown as Recording;

  it('lists lines in sung order, skipping empty ones, with keys', () => {
    const flat = flattenSong(doc, null, null);
    expect(flat.map((l) => l.key)).toEqual(['0:0', '0:1', '1:0', '2:0', '2:1']);
    expect(flat.every((l) => l.start === null && l.end === null)).toBe(true);
  });

  it('takes start and end from the timeline; null when there is no cue or end is open', () => {
    const flat = flattenSong(doc, null, rec);
    const by = Object.fromEntries(flat.map((l) => [l.key, l]));
    expect(by['0:0']).toMatchObject({ start: 1000, end: 2000 });
    expect(by['0:1']).toMatchObject({ start: 2000, end: 3000 });
    expect(by['1:0']).toMatchObject({ start: 3000, end: 4500 });
    expect(by['2:0']).toMatchObject({ start: 5000, end: null });
    expect(by['2:1']).toMatchObject({ start: null, end: null });
  });

  it('honours an explicit structure', () => {
    const flat = flattenSong(doc, ['r1'], null);
    expect(flat.map((l) => l.key)).toEqual(['0:0']);
  });

  it('ignores the recording when it is not line-synced', () => {
    const plain = { ...rec, sync_level: 0 } as unknown as Recording;
    expect(flattenSong(doc, null, plain).every((l) => l.start === null)).toBe(true);
  });
});

describe('buildClip', () => {
  it('synced: starts 500ms before the first line and shifts every line', () => {
    const flat = [fl('0:0', 1000, 2000), fl('0:1', 2000, 3000)];
    const c = buildClip(flat, 0, 1);
    expect(c.synced).toBe(true);
    expect(c.audioStartMs).toBe(500);
    expect(c.lines.map((l) => [l.key, l.start, l.end])).toEqual([
      ['0:0', 500, 1500],
      ['0:1', 1500, 2500],
    ]);
    expect(c.duration).toBe(2500 + 700);
  });

  it('synced: audio start never goes below zero', () => {
    const c = buildClip([fl('0:0', 100, 900)], 0, 0);
    expect(c.audioStartMs).toBe(0);
    expect(c.lines[0]).toMatchObject({ start: 100, end: 900 });
  });

  it('synced: a missing end uses the next selected line start', () => {
    const c = buildClip([fl('0:0', 1000, null), fl('0:1', 3000, 4000)], 0, 1);
    expect(c.lines[0]).toMatchObject({ start: 500, end: 2500 });
  });

  it('synced: caps each line at 8 seconds after its own start', () => {
    const flat = [fl('0:0', 1000, null), fl('0:1', 20000, 21000)];
    const c = buildClip(flat, 0, 1);
    expect(c.lines[0]).toMatchObject({ start: 500, end: 8500 });
    expect(c.lines[1]).toMatchObject({ start: 19500, end: 20500 });
    expect(c.duration).toBe(20500 + 700);
  });

  it('synced: a line without any end lasts 4 seconds', () => {
    const c = buildClip([fl('0:0', 1000, null)], 0, 0);
    expect(c.lines[0]).toMatchObject({ start: 500, end: 4500 });
  });

  it('synced: never shorter than 300ms', () => {
    const c = buildClip([fl('0:0', 1000, 1000), fl('0:1', 1100, 1200)], 0, 1);
    expect(c.lines[0].end - c.lines[0].start).toBe(300);
  });

  it('unsynced: even spacing from a 500ms lead-in, using the default 3.5s per line', () => {
    const flat = [fl('0:0', null), fl('0:1', null)];
    const c = buildClip(flat, 0, 1);
    expect(c.synced).toBe(false);
    expect(c.audioStartMs).toBe(0);
    expect(c.lines.map((l) => [l.start, l.end])).toEqual([
      [500, 4000],
      [4000, 7500],
    ]);
    expect(c.duration).toBe(7500 + 700);
  });

  it('unsynced: honours secPerLine and takes audio start from the first line when it has one', () => {
    const flat = [fl('0:0', 5000), fl('0:1', null)];
    const c = buildClip(flat, 0, 1, 3);
    expect(c.synced).toBe(false);
    expect(c.audioStartMs).toBe(5000);
    expect(c.lines.map((l) => [l.start, l.end])).toEqual([
      [500, 3500],
      [3500, 6500],
    ]);
  });

  it('mixed selection is unsynced', () => {
    const c = buildClip([fl('0:0', 1000, 2000), fl('0:1', null)], 0, 1);
    expect(c.synced).toBe(false);
    expect(c.audioStartMs).toBe(1000);
  });

  it('clamps out-of-range indices and swaps reversed ones', () => {
    const flat = [fl('0:0', null), fl('0:1', null), fl('0:2', null)];
    const all = buildClip(flat, -5, 99);
    expect(all.lines.map((l) => l.key)).toEqual(['0:0', '0:1', '0:2']);
    expect(buildClip(flat, 2, 0)).toEqual(buildClip(flat, 0, 2));
    const tail = buildClip(flat, 1, 50);
    expect(tail.lines.map((l) => l.key)).toEqual(['0:1', '0:2']);
  });

  it('empty selection and empty song give an empty clip', () => {
    const empty = { lines: [], duration: 0, audioStartMs: 0, synced: false };
    expect(buildClip([], 0, 0)).toEqual(empty);
    expect(buildClip([fl('0:0', 1000, 2000)], 3, 4).lines).toHaveLength(1);
  });
});

describe('defaultRange', () => {
  const flat = Array.from({ length: 20 }, (_, i) => fl(`0:${i}`, null));

  it('takes 8 unsynced lines when they fit in 30 seconds', () => {
    expect(defaultRange(flat, 0)).toEqual([0, 7]);
  });

  it('stops before the 30 second limit', () => {
    const long = Array.from({ length: 20 }, (_, i) => fl(`0:${i}`, null));
    // 6 lines at 3.5s: 500 + 21000 + 700 = 22200ms, 7 lines: 25700ms, 8 lines: 29200ms. All fit.
    expect(defaultRange(long, 0)[1]).toBe(7);
    // Synced 8s lines push the clip past 30 seconds after three lines.
    const synced = Array.from({ length: 6 }, (_, i) => fl(`0:${i}`, i * 20000, i * 20000 + 20000));
    const [s, e] = defaultRange(synced, 0);
    expect(s).toBe(0);
    expect(e).toBeGreaterThanOrEqual(0);
    expect(buildClip(synced, s, e).duration).toBeLessThanOrEqual(30000);
  });

  it('starts at the given index and clamps it', () => {
    expect(defaultRange(flat, 18)).toEqual([18, 19]);
    expect(defaultRange(flat, 99)).toEqual([19, 19]);
  });

  it('always includes at least one line', () => {
    const huge = [fl('0:0', 0, 60000), fl('0:1', 60000, 120000)];
    expect(defaultRange(huge, 0)).toEqual([0, 0]);
  });
});
