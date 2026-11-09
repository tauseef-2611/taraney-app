import { describe, expect, it } from 'vitest';
import { fold } from '../src/lib/normalize';
import { slugify, uniqueSlug } from '../src/lib/slug';
import { docErrors, expandSung, scriptsOf } from '../src/lib/song-shape';
import { deriveMood } from '../src/lib/mood';
import { activeCue, buildTimeline } from '../src/lib/timeline';
import { composeArtwork } from '../src/design/artwork';
import { contrast } from '../src/design/color';
import { resolve, schemes, tokensCss, ROLE_NAMES } from '../src/design/tokens';
import sample from '../fixtures/sample-song.json';
import type { Recording, SongDoc } from '../src/lib/types';

describe('search folding', () => {
  it('matches Urdu variants and Roman spellings', () => {
    expect(fold('دُعا')).toBe(fold('دعا'));
    expect(fold('Khudaaya')).toBe(fold('khudaya'));
    expect(fold('Azm-e mohkam')).toBe('azme mohkam');
  });
});

describe('slugs', () => {
  it('is ASCII and unique', () => {
    expect(slugify('Hum Duniya Par Chha Jayen Ge')).toBe('hum-duniya-par-chha-jayen-ge');
    const taken = new Set(['ae-watan']);
    expect(uniqueSlug('Ae watan', (s) => taken.has(s))).toBe('ae-watan-2');
  });
});

describe('song shape', () => {
  const doc = sample.doc as SongDoc;
  it('expands sung order and marks repeats', () => {
    const blocks = expandSung(doc);
    expect(blocks.length).toBe(doc.structure.length);
    expect(blocks.filter((b) => b.repeat).every((b) => b.section === 'r1')).toBe(true);
  });
  it('detects which scripts exist', () => {
    expect(scriptsOf({ sections: [{ id: 'v1', type: 'verse', layout: 'single', lines: [{ ro: 'Ae watan' }] }], structure: ['v1'] }))
      .toEqual({ ur: false, ro: true });
  });
  it('accepts single-script lines but flags token mismatch', () => {
    expect(docErrors({ sections: [{ id: 'v1', type: 'verse', layout: 'single', lines: [{ ur: 'اے وطن' }] }], structure: ['v1'] })).toEqual([]);
    expect(docErrors({ sections: [{ id: 'v1', type: 'verse', layout: 'single', lines: [{ ur: 'اے وطن', ro: 'Ae' }] }], structure: ['v1'] })).toHaveLength(1);
  });
});

describe('mood', () => {
  it('derives from genre, strong themes win', () => {
    expect(deriveMood('tarana', ['himmat'])).toBe('josh');
    expect(deriveMood('tarana', ['falasteen'])).toBe('gham');
    expect(deriveMood(null, [])).toBe('generic');
  });
});

describe('line timeline', () => {
  const rec = sample.recording as unknown as Recording;
  const cues = buildTimeline(rec);
  it('builds sorted cues, line level only', () => {
    expect(cues.length).toBe(rec.lines.length);
    expect(cues.every((c, i) => i === 0 || c.start >= cues[i - 1].start)).toBe(true);
  });
  it('finds the active line and nothing before the first', () => {
    expect(activeCue(cues, cues[0].start - 1)).toBeNull();
    expect(activeCue(cues, cues[3].start + 1)?.key).toBe(cues[3].key);
  });
  it('is empty without timing', () => {
    expect(buildTimeline({ ...rec, sync_level: 0 })).toEqual([]);
  });
});

describe('artwork', () => {
  it('is deterministic per song id', () => {
    expect(composeArtwork('p026', 'sukoon')).toEqual(composeArtwork('p026', 'sukoon'));
    expect(composeArtwork('p026', 'unknown-mood').mood).toBe('generic');
  });
});

describe('tokens', () => {
  it('defines every role in both schemes', () => {
    const css = tokensCss();
    for (const r of ROLE_NAMES) expect(css).toContain(`--color-${r}:`);
  });
  it('meets text contrast on the main pairs', () => {
    for (const s of ['dark', 'light'] as const) {
      const c = (a: keyof typeof schemes.dark, b: keyof typeof schemes.dark) => contrast(resolve(schemes[s][a]), resolve(schemes[s][b]));
      expect(c('on-bg', 'bg')).toBeGreaterThanOrEqual(7);
      expect(c('on-surface-variant', 'bg')).toBeGreaterThanOrEqual(4.5);
      expect(c('on-primary', 'primary')).toBeGreaterThanOrEqual(4.5);
      expect(c('ink', 'paper')).toBeGreaterThanOrEqual(7);
    }
  });
});
