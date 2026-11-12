// Reel Studio entry: pick a tarana to make a lyric video from. Search matches Explore.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { SearchField } from '../components/ui/controls';
import { TaranaCard, type CardSong } from '../components/ui/content';
import { fold } from '../lib/normalize';

type Item = CardSong & { slug: string; t: string; x: string };
const PAGE = 30;

// Synced songs first, then songs with audio, then the rest. Stable, so index order holds within a rank.
const rank = (it: Item) => (it.synced ? 2 : 0) + (it.has_audio ? 1 : 0);

export default function StudioPicker() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    fetch('/search-index.json')
      .then((r) => r.json() as Promise<Item[]>)
      .then((data) => setItems([...data].sort((a, b) => rank(b) - rank(a))))
      .catch(() => setItems([]));
  }, []);
  useEffect(() => setLimit(PAGE), [q]);

  const results = useMemo(() => {
    if (!items) return [];
    const words = fold(q).split(' ').filter(Boolean);
    if (!words.length) return items;
    const scored = items
      .map((it) => {
        let s = 0;
        for (const w of words) {
          if (it.t.includes(w)) s += it.t.startsWith(w) ? 6 : 4;
          else if (it.x.includes(w)) s += 1;
          else return { it, s: 0 };
        }
        return { it, s };
      })
      .filter((r) => r.s > 0);
    scored.sort((a, b) => b.s - a.s);
    return scored.map((r) => r.it);
  }, [items, q]);

  const shown = results.slice(0, limit);

  return (
    <div class="studio-picker">
      <SearchField value={q} onInput={setQ} placeholder="Title, a line, or poet · اردو یا رومن" />
      {!items ? <p class="t-body-md c-muted">Loading…</p> : shown.length ? (
        <>
          <div class="rows" key={q}>
            {shown.map((r, i) => (
              <div class="reveal" style={{ '--i': Math.min(i, 12) }}>
                <TaranaCard song={r} layout="row" href={`/studio/${r.slug}/`} />
              </div>
            ))}
          </div>
          {results.length > limit && (
            <button type="button" class="btn btn--secondary interactive studio-picker__more" onClick={() => setLimit(limit + PAGE)}>Show more</button>
          )}
        </>
      ) : (
        <div class="empty-state"><Icon name="search" /><p class="t-title-md">Nothing found</p><p>Try fewer words or the other script.</p></div>
      )}
    </div>
  );
}
