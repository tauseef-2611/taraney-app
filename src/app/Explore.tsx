// Explore: sticky search, moods strip, kinds, then the list. Search spans Urdu and Roman,
// titles first, then lyrics. Moods hide while searching so results come first.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Chip, SearchField } from '../components/ui/controls';
import { Artwork, TaranaCard, type CardSong } from '../components/ui/content';
import { GENRES } from '../lib/taxonomy';
import { fold } from '../lib/normalize';

type Item = CardSong & { slug: string; t: string; x: string };
interface MoodInfo { key: string; ur: string; ro: string; count: number }

export default function Explore({ genres, moods }: { genres: { key: string; count: number }[]; moods: MoodInfo[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQ(params.get('q') || '');
    setGenre(params.get('genre') || '');
    fetch('/search-index.json').then((r) => r.json()).then(setItems).catch(() => setItems([]));
    if (location.hash === '#search') setTimeout(() => document.querySelector<HTMLInputElement>('.explore-search input')?.focus(), 50);
  }, []);
  useEffect(() => {
    const u = new URL(location.href);
    q ? u.searchParams.set('q', q) : u.searchParams.delete('q');
    genre ? u.searchParams.set('genre', genre) : u.searchParams.delete('genre');
    history.replaceState(history.state, '', u);
    setLimit(30);
  }, [q, genre]);

  const results = useMemo(() => {
    if (!items) return [];
    const words = fold(q).split(' ').filter(Boolean);
    const scored = items
      .filter((it) => !genre || it.genre === genre)
      .map((it) => {
        if (!words.length) return { it, s: 1 };
        let s = 0;
        for (const w of words) {
          if (it.t.includes(w)) s += it.t.startsWith(w) ? 6 : 4;
          else if (it.x.includes(w)) s += 1;
          else return { it, s: 0 };
        }
        return { it, s };
      })
      .filter((r) => r.s > 0);
    if (words.length) scored.sort((a, b) => b.s - a.s);
    return scored.map((r) => r.it);
  }, [items, q, genre]);

  const searching = q.trim().length > 0;

  return (
    <div class="explore">
      <div class="explore-search" id="search"><SearchField value={q} onInput={setQ} placeholder="Title, a line, or poet · اردو یا رومن" /></div>

      {!searching && (
        <section class="sec reveal" style={{ '--i': 1 }}>
          <div class="sec__head"><h2>Moods</h2></div>
          <div class="mood-strip">
            {moods.map((m) => (
              <a class="mood-tile interactive" href={`/mood/${m.key}/`}>
                <Artwork song={{ id: `mood-${m.key}`, mood: m.key }} />
                <span class="mood-tile__label"><span lang="ur">{m.ur}</span><small>{m.ro} · {m.count}</small></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section class="sec reveal" style={{ '--i': 2 }}>
        <div class="sec__head"><h2>{searching ? 'Results' : 'All taraney'}</h2>{items && <span class="t-body-sm c-muted">{results.length}</span>}</div>
        <div class="chip-row chip-row--scroll">
          <Chip selected={!genre} onClick={() => setGenre('')}>All</Chip>
          {genres.map((g) => <Chip selected={genre === g.key} onClick={() => setGenre(genre === g.key ? '' : g.key)}>{GENRES[g.key]?.ro || g.key}</Chip>)}
        </div>
        {!items ? <p class="t-body-md c-muted">Loading…</p> : results.length ? (
          <>
            <div class="rows" key={`${q}|${genre}`}>
              {results.slice(0, limit).map((r, i) => <div class="reveal" style={{ '--i': Math.min(i, 12) }}><TaranaCard song={r} layout="row" href={`/t/${r.slug}/`} /></div>)}
            </div>
            {results.length > limit && <button class="btn btn--secondary interactive" style={{ justifySelf: 'center' }} onClick={() => setLimit(limit + 30)}>Show more</button>}
          </>
        ) : (
          <div class="empty-state"><Icon name="search" /><p class="t-title-md">Nothing found</p><p>Try fewer words or the other script. “khuda” and “khudaa” match each other.</p><a class="btn btn--primary interactive" href="/submit/">Suggest a tarana</a></div>
        )}
      </section>
    </div>
  );
}
