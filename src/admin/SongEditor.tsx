import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button, Chip } from '../components/ui/controls';
import { GENRES, THEMES } from '../lib/taxonomy';
import { MOODS, MOOD_LABELS } from '../lib/mood';
import { docErrors } from '../lib/song-shape';
import { sectionText } from '../lib/paste';
import type { Section, SongDoc, TimedLine } from '../lib/types';
import { api } from './api';
import { go, useToast } from './App';
import { STATE_LABEL } from './Songs';
import SyncStudio from './SyncStudio';

export interface Rec {
  id: string; kind: 'audio' | 'youtube'; label: string | null; audio_url: string | null; youtube_id: string | null;
  duration_ms: number | null; is_primary: boolean; sync_level: number; lines: TimedLine[]; structure: string[] | null;
}
export interface FullSong {
  id: string; slug: string; publish_state: string; reviewed: boolean; title_ur: string | null; title_ro: string | null;
  genre: string | null; themes: string[]; mood: string | null; mood_locked: boolean; poet_ur: string | null; poet_ro: string | null;
  singer: string | null; doc: SongDoc; issues: string[]; review_reason: string | null; recordings: Rec[];
}

const TABS = [{ key: 'details', label: 'Details' }, { key: 'lyrics', label: 'Lyrics' }, { key: 'audio', label: 'Audio & sync' }];

export default function SongEditor({ id, tab }: { id: string; tab: string }) {
  const [song, setSong] = useState<FullSong | null>(null);
  const [err, setErr] = useState('');
  const load = () => api.get<FullSong>(`/admin/songs/${id}`).then(setSong).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);
  if (err) return <div class="admin-page"><p class="notice">{err}</p></div>;
  if (!song) return <div class="admin-loading">Loading…</div>;
  const recParam = new URLSearchParams(location.hash.split('?')[1] || '').get('rec');

  return (
    <div class="admin-page">
      <header class="admin-head">
        <div>
          <a class="t-label-md c-muted" href="#/songs">← All taraney</a>
          <h1 class="t-headline-sm">{song.title_ro || song.title_ur || song.id}</h1>
          {song.title_ro && song.title_ur && <p class="t-lyric-ur-sm c-variant" lang="ur" style={{ textAlign: 'left' }}>{song.title_ur}</p>}
        </div>
        <span class={`badge state state--${song.publish_state}`}>{STATE_LABEL[song.publish_state]}</span>
      </header>
      <nav class="tabs" role="tablist">
        {TABS.map((t) => <a role="tab" aria-selected={tab === t.key} class="tabs__tab interactive" href={`#/songs/${id}/${t.key}`}>{t.label}</a>)}
      </nav>
      {tab === 'details' && <Details song={song} reload={load} />}
      {tab === 'lyrics' && <Lyrics song={song} reload={load} />}
      {tab === 'audio' && (recParam
        ? <SyncStudio song={song} rec={song.recordings.find((r) => r.id === recParam)!} onSaved={load} />
        : <Recordings song={song} reload={load} />)}
    </div>
  );
}

/* ---------- Details ---------- */
function Details({ song, reload }: { song: FullSong; reload: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ ...song });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FullSong) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });
  const toggleTheme = (t: string) => setF({ ...f, themes: f.themes.includes(t) ? f.themes.filter((x) => x !== t) : [...f.themes, t].slice(0, 4) });

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/songs/${song.id}`, {
        title_ro: f.title_ro, title_ur: f.title_ur, genre: f.genre, themes: f.themes, mood: f.mood, mood_locked: f.mood_locked,
        poet_ro: f.poet_ro, poet_ur: f.poet_ur, singer: f.singer, reviewed: f.reviewed,
      });
      toast('Saved'); reload();
    } catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };
  const setState = async (state: string) => {
    if (state === 'published' && song.issues.length && !confirm(`This tarana has ${song.issues.length} issue(s). Publish anyway?`)) return;
    const r = await api.post<{ site?: string; note?: string }>(`/admin/songs/${song.id}/state`, { state });
    if (r.site === 'rebuilding') toast(`Now ${STATE_LABEL[state].toLowerCase()}. The public site updates in about 2 minutes.`);
    else if (r.site === 'not-connected') toast(`Now ${STATE_LABEL[state].toLowerCase()}, but the site was not rebuilt: ${r.note}`, 'err');
    else toast(`Now ${STATE_LABEL[state].toLowerCase()}`);
    reload();
  };
  const remove = async () => {
    if (!confirm('Delete this tarana and its recordings? A copy stays in version history, but the audio files are removed.')) return;
    await api.del(`/admin/songs/${song.id}`); toast('Deleted'); go('#/songs');
  };

  return (
    <div class="admin-cols admin-cols--wide">
      <section class="card admin-card form-grid">
        <label class="field"><span class="field__label">Title (Roman)</span><input class="input" value={f.title_ro || ''} onInput={set('title_ro')} /></label>
        <label class="field"><span class="field__label">Title (Urdu)</span><input class="input input--ur" lang="ur" dir="rtl" value={f.title_ur || ''} onInput={set('title_ur')} /></label>
        <label class="field"><span class="field__label">Genre</span>
          <select class="input" value={f.genre || ''} onChange={set('genre')}><option value="">Not set</option>{Object.entries(GENRES).map(([k, g]) => <option value={k}>{g.ro}</option>)}</select>
        </label>
        <label class="field"><span class="field__label">Mood (artwork) {f.mood_locked ? '· locked' : '· automatic'}</span>
          <select class="input" value={f.mood || 'generic'} onChange={(e) => setF({ ...f, mood: (e.target as HTMLSelectElement).value, mood_locked: true })}>
            {MOODS.map((m) => <option value={m}>{MOOD_LABELS[m].ro}</option>)}
          </select>
        </label>
        <label class="field"><span class="field__label">Poet (Roman)</span><input class="input" value={f.poet_ro || ''} onInput={set('poet_ro')} /></label>
        <label class="field"><span class="field__label">Poet (Urdu)</span><input class="input input--ur" lang="ur" dir="rtl" value={f.poet_ur || ''} onInput={set('poet_ur')} /></label>
        <label class="field"><span class="field__label">Singer</span><input class="input" value={f.singer || ''} onInput={set('singer')} /></label>
        <div class="field field--wide"><span class="field__label">Themes (up to 4)</span>
          <div class="chip-row">{Object.entries(THEMES).map(([k, t]) => <Chip selected={f.themes.includes(k)} onClick={() => toggleTheme(k)}>{t.ro}</Chip>)}</div>
        </div>
        <label class="check field--wide"><input type="checkbox" checked={f.reviewed} onChange={(e) => setF({ ...f, reviewed: (e.target as HTMLInputElement).checked })} /> Lyrics checked by a reader (removes the “Unreviewed draft” badge)</label>
        <div class="field--wide form-actions">
          {f.mood_locked && <Button variant="text" onClick={() => setF({ ...f, mood_locked: false })}>Use automatic mood</Button>}
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save details'}</Button>
        </div>
      </section>
      <aside class="admin-side">
        <section class="card admin-card">
          <h2 class="t-title-md">Status</h2>
          <p class="t-body-md c-variant">Currently <b>{STATE_LABEL[song.publish_state]}</b>.</p>
          <div class="stack">
            {song.publish_state !== 'published' && <Button icon="check" onClick={() => setState('published')}>Publish</Button>}
            {song.publish_state === 'published' && <Button variant="secondary" onClick={() => setState('draft')}>Unpublish</Button>}
            {song.publish_state !== 'review' && <Button variant="outlined" onClick={() => setState('review')}>Send to review</Button>}
            {song.publish_state !== 'rejected' && <Button variant="outlined" onClick={() => setState('rejected')}>Reject</Button>}
          </div>
        </section>
        {song.issues.length > 0 && (
          <section class="card admin-card">
            <h2 class="t-title-md">Needs fixing</h2>
            <ul class="issues">{song.issues.map((i) => <li>{i}</li>)}</ul>
            <a class="btn btn--text btn--sm interactive" href={`#/songs/${song.id}/lyrics`}>Fix in lyrics</a>
          </section>
        )}
        <section class="card admin-card">
          <Button variant="text" icon="trash" onClick={remove}>Delete tarana</Button>
        </section>
      </aside>
    </div>
  );
}

/* ---------- Lyrics ---------- */
const splitLines = (t: string) => t.replace(/\r/g, '').split('\n').map((l) => l.trim());

function Lyrics({ song, reload }: { song: FullSong; reload: () => void }) {
  const toast = useToast();
  const [secs, setSecs] = useState(() => song.doc.sections.map((s) => ({ id: s.id, type: s.type, ur: sectionText(s, 'ur'), ro: sectionText(s, 'ro') })));
  const [structure, setStructure] = useState<string[]>(song.doc.structure || []);
  const [busy, setBusy] = useState(false);

  const toDoc = (): SongDoc => ({
    sections: secs.map((s): Section => {
      const U = splitLines(s.ur); const R = splitLines(s.ro);
      const n = Math.max(U.length, R.length);
      const lines = Array.from({ length: n }, (_, i) => ({ ...(U[i] ? { ur: U[i] } : {}), ...(R[i] ? { ro: R[i] } : {}) })).filter((l) => l.ur || l.ro);
      return { id: s.id, type: s.type, layout: 'single', lines };
    }),
    structure: structure.filter((id) => secs.some((s) => s.id === id)),
    notes: song.doc.notes || [],
  });
  const errors = docErrors(toDoc());
  const update = (i: number, patch: Partial<(typeof secs)[number]>) => setSecs(secs.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addSection = (type: 'verse' | 'refrain') => {
    const prefix = type === 'refrain' ? 'r' : 'v';
    let n = 1; while (secs.some((s) => s.id === `${prefix}${n}`)) n++;
    const id = `${prefix}${n}`;
    setSecs([...secs, { id, type, ur: '', ro: '' }]);
    setStructure([...structure, id]);
  };
  const removeSection = (i: number) => {
    const id = secs[i].id;
    if (!confirm(`Remove section ${id}?`)) return;
    setSecs(secs.filter((_, k) => k !== i));
    setStructure(structure.filter((x) => x !== id));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= structure.length) return;
    const s = [...structure]; [s[i], s[j]] = [s[j], s[i]]; setStructure(s);
  };
  const save = async () => {
    setBusy(true);
    try { await api.put(`/admin/songs/${song.id}`, { doc: toDoc() }); toast('Lyrics saved'); reload(); }
    catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div class="stack-lg">
      <section class="card admin-card">
        <h2 class="t-title-md">Sung order</h2>
        <p class="t-body-sm c-muted">The order lines are sung in, with repeats. Sync uses this order.</p>
        <div class="order">
          {structure.map((id, i) => (
            <span class="order__item">
              <button class="icon-btn icon-btn--sm interactive" aria-label="Move left" onClick={() => move(i, -1)}>‹</button>
              <b>{id}</b>
              <button class="icon-btn icon-btn--sm interactive" aria-label="Move right" onClick={() => move(i, 1)}>›</button>
              <button class="icon-btn icon-btn--sm interactive" aria-label="Remove" onClick={() => setStructure(structure.filter((_, k) => k !== i))}><Icon name="close" /></button>
            </span>
          ))}
          <select class="input input--sm" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) setStructure([...structure, v]); }}>
            <option value="">+ Add repeat…</option>{secs.map((s) => <option value={s.id}>{s.id}</option>)}
          </select>
        </div>
      </section>

      {secs.map((s, i) => (
        <section class="card admin-card section-edit">
          <header class="section-edit__head">
            <b>{s.id}</b>
            <select class="input input--sm" value={s.type} onChange={(e) => update(i, { type: (e.target as HTMLSelectElement).value as 'verse' })}>
              <option value="verse">Verse</option><option value="refrain">Refrain</option>
            </select>
            <span class="t-body-sm c-muted">One line per row. Urdu and Roman rows pair up.</span>
            <button class="icon-btn icon-btn--sm interactive" aria-label="Remove section" onClick={() => removeSection(i)}><Icon name="trash" /></button>
          </header>
          <div class="section-edit__cols">
            <textarea class="input textarea input--ur" lang="ur" dir="rtl" rows={Math.max(3, splitLines(s.ur).length + 1)} value={s.ur} placeholder="اردو" onInput={(e) => update(i, { ur: (e.target as HTMLTextAreaElement).value })} />
            <textarea class="input textarea" rows={Math.max(3, splitLines(s.ro).length + 1)} value={s.ro} placeholder="Roman" onInput={(e) => update(i, { ro: (e.target as HTMLTextAreaElement).value })} />
          </div>
        </section>
      ))}

      <div class="form-actions sticky-actions">
        <Button variant="secondary" icon="edit" onClick={() => addSection('verse')}>Add verse</Button>
        <Button variant="secondary" icon="repeat" onClick={() => addSection('refrain')}>Add refrain</Button>
        <span class="spacer" />
        {errors.length > 0 && <span class="t-body-sm field__error" title={errors.join('\n')}>{errors.length} warning(s): {errors[0]}</span>}
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save lyrics'}</Button>
      </div>
    </div>
  );
}

/* ---------- Recordings ---------- */
function Recordings({ song, reload }: { song: FullSong; reload: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [yt, setYt] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: Event) => {
    e.preventDefault();
    const fd = new FormData();
    if (file) {
      fd.set('file', file);
      const dur = await new Promise<number>((res) => { const a = new Audio(URL.createObjectURL(file)); a.onloadedmetadata = () => res(a.duration * 1000); a.onerror = () => res(0); });
      if (dur) fd.set('duration_ms', String(Math.round(dur)));
    } else fd.set('youtube_url', yt);
    fd.set('label', label);
    setBusy(true);
    try { await api.post(`/admin/songs/${song.id}/recordings`, fd); toast('Recording added'); setFile(null); setYt(''); setLabel(''); reload(); }
    catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };
  const del = async (r: Rec) => { if (confirm('Delete this recording and its timing?')) { await api.del(`/admin/recordings/${r.id}`); reload(); } };
  const primary = async (r: Rec) => { await api.post(`/admin/recordings/${r.id}/primary`); reload(); };

  return (
    <div class="admin-cols admin-cols--wide">
      <section class="card admin-card">
        <h2 class="t-title-md">Recordings</h2>
        {!song.recordings.length && <p class="t-body-md c-muted">No audio yet. The tarana still works as a reading page.</p>}
        {song.recordings.map((r) => (
          <div class="rec-row">
            <span class="icon-btn icon-btn--tonal icon-btn--sm"><Icon name={r.kind === 'audio' ? 'music' : 'video'} /></span>
            <span class="rec-row__text">
              <b>{r.label || (r.kind === 'audio' ? 'Audio' : 'YouTube')}</b>
              <span class="t-body-sm c-muted">{r.kind === 'audio' ? 'Hosted audio' : `YouTube · ${r.youtube_id}`}{r.is_primary ? ' · primary' : ''} · {r.sync_level ? `${r.lines.length} lines synced` : 'not synced'}</span>
            </span>
            {r.kind === 'audio'
              ? <span class="rec-row__actions">
                  <button class="btn btn--secondary btn--sm interactive"
                    title={song.doc.sections.length ? 'Gemini drafts line timings from this audio (replaces current timing)' : 'Gemini writes the lyrics from this audio, then drafts line timings'}
                    onClick={async () => {
                      if (r.sync_level && !confirm('Replace the current timing with a new AI draft?')) return;
                      try { await api.post(`/admin/recordings/${r.id}/ingest`, { timing: true }); toast('Queued for local worker — run `npm run worker` on your PC'); }
                      catch (x) { toast((x as Error).message, 'err'); }
                    }}><Icon name="sparkles" />{song.doc.sections.length ? 'AI sync' : 'AI lyrics + sync'}</button>                  <a class="btn btn--primary btn--sm interactive" href={`#/songs/${song.id}/audio?rec=${r.id}`}><Icon name="lyrics" />{r.sync_level ? 'Edit sync' : 'Sync by hand'}</a>
                </span>
              : <button class="btn btn--secondary btn--sm interactive" title="Downloads the audio on your local PC via yt-dlp, drafts lyrics and line timings with Gemini"
                  onClick={async () => {
                    try { await api.post(`/admin/recordings/${r.id}/ingest`, { timing: true }); toast('Queued — run `npm run worker` on your PC to process'); }
                    catch (x) { toast((x as Error).message, 'err'); }
                  }}><Icon name="download" />Fetch audio + sync</button>}
            {!r.is_primary && <button class="btn btn--text btn--sm interactive" onClick={() => primary(r)}>Make primary</button>}
            <button class="icon-btn icon-btn--sm interactive" aria-label="Delete recording" onClick={() => del(r)}><Icon name="trash" /></button>
          </div>
        ))}
      </section>
      <form class="card admin-card stack" onSubmit={add}>
        <h2 class="t-title-md">Add a recording</h2>
        <label class="field"><span class="field__label">Audio file (mp3, m4a, opus… up to 40 MB)</span>
          <input class="input" type="file" accept="audio/*" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] || null)} />
        </label>
        <p class="t-body-sm c-muted">or</p>
        <label class="field"><span class="field__label">YouTube link</span><input class="input" value={yt} disabled={!!file} onInput={(e) => setYt((e.target as HTMLInputElement).value)} /></label>
        <label class="field"><span class="field__label">Label (optional)</span><input class="input" value={label} placeholder="Studio version, 2019" onInput={(e) => setLabel((e.target as HTMLInputElement).value)} /></label>
        <Button type="submit" disabled={busy || (!file && !yt)}>{busy ? 'Uploading…' : 'Add recording'}</Button>
      </form>
    </div>
  );
}
