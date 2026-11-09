import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Artwork } from '../components/ui/content';
import { GENRES } from '../lib/taxonomy';
import { api, type SongListItem } from './api';

const FILTERS = [
  { key: '', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'review', label: 'In review' },
  { key: 'published', label: 'Published' }, { key: 'issues', label: 'Need fixing' }, { key: 'rejected', label: 'Rejected' },
];

export const STATE_LABEL: Record<string, string> = { draft: 'Draft', review: 'In review', published: 'Published', rejected: 'Rejected' };

export default function Songs() {
  const initial = new URLSearchParams(location.hash.split('?')[1] || '').get('state') || '';
  const [state, setState] = useState(initial);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SongListItem[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<SongListItem[]>(`/admin/songs?state=${state}&q=${encodeURIComponent(q)}`).then(setRows);
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [state, q]);

  return (
    <div class="admin-page">
      <header class="admin-head">
        <h1 class="t-headline-md">Taraney</h1>
        <a class="btn btn--primary interactive" href="#/new"><Icon name="edit" />New tarana</a>
      </header>
      <div class="toolbar">
        <label class="search search--sm"><Icon name="search" /><input type="search" placeholder="Search title or id" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        <div class="chip-row">
          {FILTERS.map((f) => <button class="chip interactive" aria-pressed={state === f.key ? 'true' : 'false'} onClick={() => setState(f.key)}>{f.label}</button>)}
        </div>
      </div>
      {!rows ? <div class="admin-loading">Loading…</div> : (
        <div class="card song-table">
          <p class="t-body-sm c-muted song-table__count">{rows.length} taraney</p>
          {rows.map((s) => (
            <a class="song-row interactive" href={`#/songs/${s.id}`}>
              <Artwork song={s} size="sm" />
              <span class="song-row__titles">
                <span class="song-row__title">{s.title_ro || s.title_ur || s.id}</span>
                {s.title_ro && s.title_ur && <span class="song-row__ur" lang="ur">{s.title_ur}</span>}
              </span>
              <span class="song-row__meta t-body-sm c-muted">{[s.genre && GENRES[s.genre]?.ro, s.id].filter(Boolean).join(' · ')}</span>
              <span class="song-row__flags">
                {s.issues.length > 0 && <span class="badge badge--error" title={s.issues.join('\n')}><Icon name="info" />{s.issues.length}</span>}
                {s.rec_count > 0 && <span class={`badge${s.synced ? ' badge--tertiary' : ''}`}><Icon name={s.synced ? 'lyrics' : 'music'} />{s.synced ? 'Synced' : 'Audio'}</span>}
                <span class={`badge state state--${s.publish_state}`}>{STATE_LABEL[s.publish_state]}</span>
              </span>
            </a>
          ))}
          {!rows.length && <p class="t-body-md c-muted" style={{ padding: 'var(--space-6)' }}>Nothing matches.</p>}
        </div>
      )}
    </div>
  );
}
