// Client search index: card fields plus folded text of titles and every line (Urdu and Roman).
import { allSongs, cardOf } from '../data/load';
import { fold } from '../lib/normalize';

export function GET() {
  const items = allSongs().map((s) => {
    const lines = s.doc.sections.flatMap((x) => x.lines.map((l) => `${l.ur || ''} ${l.ro || ''}`));
    return {
      ...cardOf(s),
      t: fold(`${s.title_ur || ''} ${s.title_ro || ''} ${s.poet_ro || ''} ${s.poet_ur || ''}`),
      x: fold(lines.join(' ')),
    };
  });
  return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
}
