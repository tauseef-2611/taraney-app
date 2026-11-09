// Turns pasted lyrics into a SongDoc. Blank lines separate stanzas; Urdu and Roman stanzas pair by order.
// A stanza identical to an earlier one is treated as a repeat of it (and that section becomes a refrain).
import type { Section, SongDoc } from './types';

const stanzas = (text?: string | null) =>
  String(text ?? '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);

export function docFromPaste(ur?: string | null, ro?: string | null): SongDoc {
  const U = stanzas(ur);
  const R = stanzas(ro);
  const n = Math.max(U.length, R.length);
  const sections: Section[] = [];
  const structure: string[] = [];
  const seen = new Map<string, string>();
  let v = 0;
  for (let i = 0; i < n; i++) {
    const u = U[i] || [];
    const r = R[i] || [];
    const key = (u.length ? u : r).join('\n');
    const existing = seen.get(key);
    if (existing) {
      structure.push(existing);
      const s = sections.find((x) => x.id === existing)!;
      s.type = 'refrain';
      continue;
    }
    const id = `s${++v}`;
    const lines = Array.from({ length: Math.max(u.length, r.length) }, (_, k) => ({
      ...(u[k] ? { ur: u[k] } : {}),
      ...(r[k] ? { ro: r[k] } : {}),
    }));
    sections.push({ id, type: 'verse', layout: 'single', lines });
    structure.push(id);
    seen.set(key, id);
  }
  return { sections, structure, notes: [] };
}

/** Back to editable text, one script at a time (for the lyrics editor). */
export function sectionText(s: Section, script: 'ur' | 'ro'): string {
  return s.lines.map((l) => l[script] || '').join('\n');
}
