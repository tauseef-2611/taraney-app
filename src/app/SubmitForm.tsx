// Reader submissions: a new tarana (lyrics and/or YouTube link) or a recording for an existing tarana.
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/controls';

export default function SubmitForm({ songs }: { songs: { id: string; title: string }[] }) {
  const [type, setType] = useState<'tarana' | 'audio'>('tarana');
  const [songId, setSongId] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | string>('idle');
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('type') === 'audio') setType('audio');
    if (p.get('song')) setSongId(p.get('song')!);
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    fd.set('type', type);
    if (type === 'audio') fd.set('song_id', songId);
    const file = fd.get('file');
    if (file instanceof File && !file.size) fd.delete('file');
    setState('sending');
    const res = await fetch('/api/submissions', { method: 'POST', body: fd }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setState(res?.ok ? 'done' : data?.error || 'Could not send. Try again later.');
  };

  if (state === 'done') return (
    <div class="card form-card empty-state"><Icon name="check" /><p class="t-title-md">Thank you</p><p>An editor will review it. Nothing is published without a check.</p>
      <Button onClick={() => setState('idle')}>Send another</Button></div>
  );

  return (
    <form class="card form-card" onSubmit={submit}>
      <div class="segmented" role="group" aria-label="What are you sending">
        <button type="button" class="interactive" aria-pressed={type === 'tarana' ? 'true' : 'false'} onClick={() => setType('tarana')}>A new tarana</button>
        <button type="button" class="interactive" aria-pressed={type === 'audio' ? 'true' : 'false'} onClick={() => setType('audio')}>A recording</button>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
      {type === 'tarana' ? (
        <>
          <label class="field"><span class="field__label">Title (Roman)</span><input class="input" name="title_ro" /></label>
          <label class="field"><span class="field__label">Title (Urdu)</span><input class="input input--ur" name="title_ur" lang="ur" dir="rtl" /></label>
          <label class="field"><span class="field__label">Urdu lyrics · blank line between stanzas</span><textarea class="input textarea input--ur" name="lyrics_ur" lang="ur" dir="rtl" rows={7} /></label>
          <label class="field"><span class="field__label">Roman lyrics</span><textarea class="input textarea" name="lyrics_ro" rows={7} /></label>
          <label class="field"><span class="field__label">Poet, if known</span><input class="input" name="poet" /></label>
          <label class="field"><span class="field__label">YouTube link (optional)</span><input class="input" name="youtube_url" inputMode="url" /></label>
        </>
      ) : (
        <>
          <label class="field"><span class="field__label">Which tarana?</span>
            <select class="input" value={songId} onChange={(e) => setSongId((e.target as HTMLSelectElement).value)} required>
              <option value="">Choose…</option>{songs.map((s) => <option value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label class="field"><span class="field__label">YouTube link</span><input class="input" name="youtube_url" inputMode="url" /></label>
          <label class="field"><span class="field__label">or an audio file (up to 30 MB)</span><input class="input" type="file" name="file" accept="audio/*" /></label>
          <label class="field"><span class="field__label">About this recording (optional)</span><input class="input" name="label" placeholder="Camp 2024, live" /></label>
        </>
      )}
      <label class="field"><span class="field__label">Note for the editor (optional)</span><input class="input" name="note" /></label>
      <label class="field"><span class="field__label">Your name (optional)</span><input class="input" name="name" /></label>
      {state !== 'idle' && state !== 'sending' && <p class="field__error">{state}</p>}
      <Button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send for review'}</Button>
    </form>
  );
}
