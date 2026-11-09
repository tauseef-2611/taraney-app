// Reader suggestions: lyric corrections, audio submissions, new tarana submissions.
// Approving applies the change (with a version snapshot); nothing reaches readers until you publish.
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/controls';
import { parseYouTubeId } from '../lib/youtube';
import { api } from './api';
import { go, useToast } from './App';

interface Sub {
  id: string; type: string; song_id: string | null; status: string; created_at: string;
  payload: Record<string, string>; title_ur: string | null; title_ro: string | null;
}

const TABS = [
  { key: 'lyrics_fix', label: 'Lyric corrections' },
  { key: 'audio', label: 'Audio' },
  { key: 'tarana', label: 'New taraney' },
];

export default function Inbox({ type }: { type: string }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const load = () => {
    api.get<Sub[]>(`/admin/submissions?type=${type}&status=${status}`).then(setRows);
    api.get<{ pending: Record<string, number> }>('/admin/stats').then((s) => setCounts(s.pending));
  };
  useEffect(() => { setRows(null); load(); }, [type, status]);

  return (
    <div class="admin-page">
      <header class="admin-head"><h1 class="t-headline-md">Suggestions</h1></header>
      <nav class="tabs" role="tablist">
        {TABS.map((t) => (
          <a role="tab" aria-selected={type === t.key} class="tabs__tab interactive" href={`#/inbox/${t.key}`}>
            {t.label}{counts[t.key] ? <span class="admin__count">{counts[t.key]}</span> : null}
          </a>
        ))}
        <span class="spacer" />
        <select class="input input--sm" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </nav>
      {!rows ? <div class="admin-loading">Loading…</div> : !rows.length
        ? <div class="card admin-card empty"><Icon name="check" /><p>Nothing {status} here.</p></div>
        : <div class="stack-lg">{rows.map((s) => <SubCard key={s.id} s={s} onDone={load} />)}</div>}
    </div>
  );
}

function SubCard({ s, onDone }: { s: Sub; onDone: () => void }) {
  const toast = useToast();
  const p = s.payload;
  const [edit, setEdit] = useState<Record<string, string>>({ proposed_ur: p.proposed_ur || '', proposed_ro: p.proposed_ro || '' });
  const [busy, setBusy] = useState(false);
  const act = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const r = await api.post<{ song_id?: string }>(`/admin/submissions/${s.id}`, { action, edit: s.type === 'lyrics_fix' ? edit : undefined });
      toast(action === 'approve' ? 'Approved and applied' : 'Rejected');
      if (action === 'approve' && s.type === 'tarana' && r.song_id) go(`#/songs/${r.song_id}/lyrics`); else onDone();
    } catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };
  const songTitle = s.title_ro || s.title_ur;
  const yt = parseYouTubeId(p.youtube_url);
  const pending = s.status === 'pending';

  return (
    <article class="card admin-card sub">
      <header class="sub__head">
        <span class="t-title-sm">{s.type === 'tarana' ? (p.title_ro || p.title_ur || 'Untitled tarana') : songTitle ? <a href={`#/songs/${s.song_id}`}>{songTitle}</a> : 'No song attached'}</span>
        <span class="t-body-sm c-muted">{p.name || 'Anonymous'} · {s.created_at.slice(0, 16)}</span>
      </header>
      {p.note && <p class="sub__note">“{p.note}”</p>}

      {s.type === 'lyrics_fix' && (
        <div class="diff">
          <p class="t-label-sm c-muted">Line {Number(p.line) + 1} of {p.section}</p>
          {p.proposed_ur && (
            <div class="diff__row">
              <p class="diff__old" lang="ur">{p.current_ur || '—'}</p>
              {pending ? <input class="input input--ur diff__new" lang="ur" dir="rtl" value={edit.proposed_ur} onInput={(e) => setEdit({ ...edit, proposed_ur: (e.target as HTMLInputElement).value })} />
                : <p class="diff__new" lang="ur">{p.proposed_ur}</p>}
            </div>
          )}
          {p.proposed_ro && (
            <div class="diff__row">
              <p class="diff__old">{p.current_ro || '—'}</p>
              {pending ? <input class="input diff__new" value={edit.proposed_ro} onInput={(e) => setEdit({ ...edit, proposed_ro: (e.target as HTMLInputElement).value })} />
                : <p class="diff__new">{p.proposed_ro}</p>}
            </div>
          )}
          {pending && <p class="t-body-sm c-muted">You can adjust the suggestion before approving.</p>}
        </div>
      )}

      {s.type === 'audio' && (
        <div class="stack">
          {p.label && <p class="t-body-md">{p.label}</p>}
          {yt && <iframe class="sub__video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Submitted video" loading="lazy" allow="encrypted-media" allowFullScreen />}
          {p.file_key && <p class="t-body-sm c-muted"><Icon name="music" /> Uploaded file ({p.file_key.split('.').pop()}) · becomes a hosted recording on approval</p>}
          {!s.song_id && <p class="field__error">Not attached to a song; it cannot be approved yet.</p>}
        </div>
      )}

      {s.type === 'tarana' && (
        <div class="sub__lyrics">
          {p.poet && <p class="t-body-sm c-muted">Poet: {p.poet}</p>}
          <div class="section-edit__cols">
            {p.lyrics_ur && <pre class="sub__pre" lang="ur" dir="rtl">{p.lyrics_ur}</pre>}
            {p.lyrics_ro && <pre class="sub__pre">{p.lyrics_ro}</pre>}
          </div>
          {yt && <iframe class="sub__video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Submitted video" loading="lazy" allow="encrypted-media" allowFullScreen />}
          <p class="t-body-sm c-muted">Approving creates an unpublished draft and opens it in the editor.</p>
        </div>
      )}

      {pending && (
        <footer class="form-actions">
          <Button variant="outlined" disabled={busy} onClick={() => act('reject')}>Reject</Button>
          <Button icon="check" disabled={busy || (s.type === 'audio' && !s.song_id)} onClick={() => act('approve')}>
            {s.type === 'tarana' ? 'Approve as draft' : 'Approve'}
          </Button>
        </footer>
      )}
    </article>
  );
}
