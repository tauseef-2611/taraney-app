import { useState } from 'preact/hooks';
import { Button } from '../components/ui/controls';
import { GENRES } from '../lib/taxonomy';
import { docFromPaste } from '../lib/paste';
import { api } from './api';
import { go, useToast } from './App';

export default function NewSong() {
  const toast = useToast();
  const [f, setF] = useState({ title_ro: '', title_ur: '', genre: '', youtube_url: '', lyrics_ur: '', lyrics_ro: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });
  const preview = docFromPaste(f.lyrics_ur, f.lyrics_ro);

  const create = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ id: string }>('/admin/songs', f);
      toast('Tarana created');
      go(`#/songs/${r.id}/lyrics`);
    } catch (x) { toast((x as Error).message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div class="admin-page">
      <header class="admin-head"><h1 class="t-headline-md">New tarana</h1></header>
      <form class="card admin-card form-grid" onSubmit={create}>
        <label class="field"><span class="field__label">Title (Roman)</span><input class="input" value={f.title_ro} onInput={set('title_ro')} placeholder="Hum Duniya Par Chha Jayen Ge" /></label>
        <label class="field"><span class="field__label">Title (Urdu)</span><input class="input input--ur" lang="ur" dir="rtl" value={f.title_ur} onInput={set('title_ur')} /></label>
        <label class="field"><span class="field__label">Genre</span>
          <select class="input" value={f.genre} onChange={set('genre')}><option value="">Not set</option>{Object.entries(GENRES).map(([k, g]) => <option value={k}>{g.ro}</option>)}</select>
        </label>
        <label class="field"><span class="field__label">YouTube link (optional)</span><input class="input" value={f.youtube_url} onInput={set('youtube_url')} placeholder="https://youtube.com/watch?v=…" /></label>
        <label class="field field--wide"><span class="field__label">Urdu lyrics · blank line between stanzas</span><textarea class="input textarea input--ur" lang="ur" dir="rtl" rows={10} value={f.lyrics_ur} onInput={set('lyrics_ur')} /></label>
        <label class="field field--wide"><span class="field__label">Roman lyrics · same stanzas, same order</span><textarea class="input textarea" rows={10} value={f.lyrics_ro} onInput={set('lyrics_ro')} /></label>
        <p class="field--wide t-body-sm c-muted">
          {preview.sections.length
            ? `Will create ${preview.sections.length} stanza(s), sung order ${preview.structure.join(' → ')}. A stanza repeated word for word becomes a refrain.`
            : 'Lyrics are optional here; you can add them in the editor.'}
          {' '}Audio upload and sync come next, on the song page.
        </p>
        <div class="field--wide form-actions"><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and edit lyrics'}</Button></div>
      </form>
    </div>
  );
}
