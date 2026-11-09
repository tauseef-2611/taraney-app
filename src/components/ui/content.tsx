// Content components. They adapt to missing data: no empty labels, no fake affordances.
import { composeArtwork } from '../../design/artwork';
import { GENRES } from '../../lib/taxonomy';
import { deriveMood } from '../../lib/mood';
import type { SungBlock } from '../../lib/song-shape';
import { Icon } from './Icon';
import { Badge } from './controls';

export interface CardSong {
  id: string;
  title_ur?: string | null;
  title_ro?: string | null;
  genre?: string | null;
  themes?: string[];
  mood?: string | null;
  poet_ro?: string | null;
  singer?: string | null;
  has_audio?: boolean;
  has_video?: boolean;
  synced?: boolean;
  image?: string | null;
}

const moodOf = (s: CardSong) => s.mood || deriveMood(s.genre, s.themes || []);

export function Artwork({ song, variant = 'square', animated = false, showTitle = false, size, class: cls }: {
  song: CardSong; variant?: 'square' | 'hero' | 'wide' | 'share'; animated?: boolean; showTitle?: boolean; size?: 'sm'; class?: string;
}) {
  const art = composeArtwork(song.id, moodOf(song), song.image);
  const c = ['artwork', `artwork--${variant}`, `artwork--layout-${art.layout}`, `art--${art.motion}`,
    animated && 'is-animated', size === 'sm' && 'artwork--sm artwork--round', cls].filter(Boolean).join(' ');
  const glyph = song.title_ur?.split(/\s+/).slice(0, 2).join(' ');
  return (
    <div class={c} style={art.style} data-mood={art.mood} data-tint={art.tint} role="img"
      aria-label={`Artwork for ${song.title_ro || song.title_ur || 'tarana'}`}>
      {showTitle ? (
        <div class="artwork__title">
          {song.title_ur && <span lang="ur">{song.title_ur}</span>}
          {song.title_ro && <span lang="ur-Latn">{song.title_ro}</span>}
        </div>
      ) : (
        glyph && size !== 'sm' && variant === 'square' && <span class="artwork__glyph" lang="ur">{glyph}</span>
      )}
    </div>
  );
}

/** Metadata row. Only renders items that exist. */
export function MetaRow({ song }: { song: CardSong }) {
  const items = [
    song.genre && GENRES[song.genre] && <span>{GENRES[song.genre].ro}</span>,
    song.poet_ro && <span>{song.poet_ro}</span>,
    song.singer && <span>{song.singer}</span>,
    song.has_audio && <span><Icon name="music" /> Audio</span>,
    !song.has_audio && song.has_video && <span><Icon name="video" /> Video</span>,
    song.synced && <span><Icon name="lyrics" /> Synced</span>,
  ].filter(Boolean);
  if (!items.length) return null;
  return <div class="meta">{items}</div>;
}

function Titles({ song }: { song: CardSong }) {
  return (
    <div class="tarana-card__text">
      {song.title_ur && <p class="tarana-card__title-ur" lang="ur">{song.title_ur}</p>}
      {song.title_ro && <p class="tarana-card__title-ro" lang="ur-Latn">{song.title_ro}</p>}
      <MetaRow song={song} />
    </div>
  );
}

/** Row titles: Roman leads and Urdu supports; whichever script exists alone leads. */
function RowTitles({ song }: { song: CardSong }) {
  const lead = song.title_ro
    ? <p class="tarana-row__title" lang="ur-Latn">{song.title_ro}</p>
    : song.title_ur && <p class="tarana-row__title" lang="ur">{song.title_ur}</p>;
  return (
    <div class="tarana-card__text">
      {lead}
      {song.title_ro && song.title_ur && <p class="tarana-row__support" lang="ur">{song.title_ur}</p>}
      <MetaRow song={song} />
    </div>
  );
}

export function TaranaCard({ song, layout = 'grid', href = '#' }: { song: CardSong; layout?: 'grid' | 'row'; href?: string }) {
  const row = layout === 'row';
  return (
    <a href={href} class={`tarana-card interactive${row ? ' tarana-card--row' : ''}`}>
      <Artwork song={song} size={row ? 'sm' : undefined} />
      {row ? <RowTitles song={song} /> : <Titles song={song} />}
      {row && song.has_audio && <span class="icon-btn icon-btn--tonal icon-btn--sm" aria-hidden="true"><Icon name="play" /></span>}
    </a>
  );
}

export function SongHeader({ song, reviewed = true }: { song: CardSong; reviewed?: boolean }) {
  return (
    <header style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <Artwork song={song} variant="wide" showTitle animated />
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {song.title_ur && <h3 class="t-title-ur" lang="ur" style={{ textAlign: 'right' }}>{song.title_ur}</h3>}
        {song.title_ro && <p class={song.title_ur ? 't-body-md c-variant' : 't-title-lg'} lang="ur-Latn">{song.title_ro}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <MetaRow song={song} />
          {!reviewed && <Badge>Unreviewed draft</Badge>}
        </div>
      </div>
    </header>
  );
}

/** Lyrics in sung order. `active` is "occ:line"; with `onLine`, lines become tappable buttons. */
export function Lyrics({ blocks, mode = 'both', surface = 'dark', synced = false, active, past, onLine, compactRepeats = false }: {
  blocks: SungBlock[]; mode?: 'ur' | 'both' | 'ro'; surface?: 'dark' | 'paper'; synced?: boolean;
  active?: string | null; past?: Set<string>; onLine?: (occ: number, line: number) => void; compactRepeats?: boolean;
}) {
  const c = ['lyrics', surface === 'paper' && 'lyrics--paper', synced && 'is-synced'].filter(Boolean).join(' ');
  return (
    <div class={c} data-mode={mode}>
      {blocks.map((b) => {
        if (compactRepeats && b.repeat) {
          return <p class="lyric-block__label">Refrain repeats</p>;
        }
        return (
          <section class={`lyric-block lyric-block--${b.type}${b.repeat ? ' lyric-block--repeat' : ''}`} data-occ={b.occ}>
            {b.lines.map((l) => {
              const key = `${b.occ}:${l.line}`;
              const cls = ['lyric-line', key === active && 'is-active', past?.has(key) && 'is-past', l.uncertain && 'lyric-line--uncertain'].filter(Boolean).join(' ');
              const body = [
                l.ur && <span class="ur" lang="ur">{l.ur}</span>,
                l.ro && <span class="ro" lang="ur-Latn">{l.ro}</span>,
              ];
              return onLine
                ? <button type="button" class={cls} data-key={key} onClick={() => onLine(b.occ, l.line)}>{body}</button>
                : <p class={cls} data-key={key}>{body}</p>;
            })}
          </section>
        );
      })}
    </div>
  );
}
