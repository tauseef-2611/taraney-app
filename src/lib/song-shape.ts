import type { SongDoc } from './types';

const tokens = (text: unknown) => String(text ?? '').trim().split(/\s+/).filter(Boolean);

export interface SungLine { line: number; ur: string; ro: string; uncertain: boolean }
export interface SungBlock { occ: number; section: string; type: string; layout: string; lines: SungLine[]; repeat: boolean }

/** The song in sung order: one block per entry of the structure. */
export function expandSung(doc: SongDoc, structure: string[] = doc?.structure || []): SungBlock[] {
  const sections = new Map((doc?.sections || []).map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: SungBlock[] = [];
  structure.forEach((id, occ) => {
    const s = sections.get(id);
    if (!s) return;
    out.push({
      occ,
      section: s.id,
      type: s.type,
      layout: s.layout,
      repeat: seen.has(s.id),
      lines: (s.lines || []).map((l, line) => ({
        line,
        ur: tokens(l.ur).join(' '),
        ro: tokens(l.ro).join(' '),
        uncertain: !!l.uncertain,
      })),
    });
    seen.add(s.id);
  });
  return out;
}

/** Which scripts the song actually has. Drives the reading-mode switch. */
export function scriptsOf(doc: SongDoc): { ur: boolean; ro: boolean } {
  let ur = false;
  let ro = false;
  for (const s of doc?.sections || []) for (const l of s.lines || []) {
    if (tokens(l.ur).length) ur = true;
    if (tokens(l.ro).length) ro = true;
  }
  return { ur, ro };
}

/** Problems that would break display or line sync. Empty means sound. */
export function docErrors(doc: SongDoc): string[] {
  const errors: string[] = [];
  const sections = doc?.sections || [];
  const ids = new Set<string>();
  if (!sections.length) errors.push('no sections');
  for (const s of sections) {
    if (ids.has(s.id)) errors.push(`duplicate section id ${s.id}`);
    ids.add(s.id);
    if (!s.lines?.length) errors.push(`${s.id}: no lines`);
    (s.lines || []).forEach((l, i) => {
      const ur = tokens(l.ur).length;
      const ro = tokens(l.ro).length;
      if (!ur && !ro) errors.push(`${s.id}[${i}]: empty line`);
      else if (ur && ro && ur !== ro) errors.push(`${s.id}[${i}]: ${ur} Urdu tokens, ${ro} Roman tokens`);
    });
  }
  if (!doc?.structure?.length) errors.push('empty structure');
  for (const id of doc?.structure || []) if (!ids.has(id)) errors.push(`structure references missing section ${id}`);
  return errors;
}
