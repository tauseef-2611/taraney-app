// Share a couplet: pick 1-4 lines, choose a format and script, preview, then share or download.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button, Chip, IconButton } from '../components/ui/controls';
import { FORMATS, renderCard, shareOrDownload, toBlob, download, type Format } from './share-card';
import { slugify } from '../lib/slug';

export interface ShareLine { key: string; ur: string; ro: string }

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: preact.ComponentChildren }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = prev; };
  }, []);
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span class="sheet__grip" />
        <header class="sheet__head"><h2 class="t-title-lg">{title}</h2><IconButton icon="close" label="Close" onClick={onClose} /></header>
        {children}
      </div>
    </>
  );
}

export default function ShareSheet({ song, options, initial, onClose }: {
  song: { id: string; slug: string; mood: string; title_ur: string | null; title_ro: string | null };
  options: ShareLine[]; initial: string[]; onClose: () => void;
}) {
  const hasUr = options.some((o) => o.ur);
  const hasRo = options.some((o) => o.ro);
  const [picked, setPicked] = useState<string[]>(initial);
  const [format, setFormat] = useState<Format>('status');
  const [script, setScript] = useState<'ur' | 'both' | 'ro'>(hasUr && hasRo ? 'both' : hasUr ? 'ur' : 'ro');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const url = `${location.origin}/t/${song.slug}/`;

  const lines = options.filter((o) => picked.includes(o.key));
  useEffect(() => {
    let live = true;
    renderCard({ songId: song.id, mood: song.mood, title_ur: song.title_ur, title_ro: song.title_ro, lines, script, format, url }).then((cv) => {
      if (!live || !box.current) return;
      canvas.current = cv;
      box.current.replaceChildren(cv);
    });
    return () => { live = false; };
  }, [picked.join(','), format, script]);

  const toggle = (k: string) => {
    if (picked.includes(k)) { if (picked.length > 1) setPicked(picked.filter((x) => x !== k)); }
    else if (picked.length < 4) setPicked(options.filter((o) => [...picked, k].includes(o.key)).map((o) => o.key));
  };
  const name = `taraney-${slugify(song.title_ro || song.id).slice(0, 40) || song.id}`;
  const text = lines.map((l) => (script === 'ro' ? l.ro : l.ur || l.ro)).join('\n');

  const share = async () => {
    if (!canvas.current) return;
    setBusy(true);
    const r = await shareOrDownload(canvas.current, name, text, url);
    setBusy(false);
    setMsg(r === 'shared' ? 'Shared.' : r === 'downloaded' ? 'Saved to your downloads. Post it as your status from the gallery.' : '');
  };
  const save = async () => { if (canvas.current) { download(await toBlob(canvas.current), `${name}.png`); setMsg('Saved to your downloads.'); } };
  const copy = async () => { try { await navigator.clipboard.writeText(`${text}\n${url}`); setMsg('Text copied.'); } catch { setMsg('Copy is blocked in this browser.'); } };

  return (
    <Sheet title="Share couplet" onClose={onClose}>
      <div class="share-preview" ref={box}><p class="t-body-sm c-muted">Drawing…</p></div>
      <div class="chip-row">
        {(Object.keys(FORMATS) as Format[]).map((f) => <Chip selected={format === f} onClick={() => setFormat(f)}>{FORMATS[f].label}</Chip>)}
      </div>
      {hasUr && hasRo && (
        <div class="segmented" role="group" aria-label="Script">
          {(['ur', 'both', 'ro'] as const).map((s) => (
            <button class="interactive" aria-pressed={script === s ? 'true' : 'false'} onClick={() => setScript(s)}>
              {s === 'ur' ? <span class="ur-label" lang="ur">اردو</span> : s === 'both' ? 'Both' : 'Roman'}
            </button>
          ))}
        </div>
      )}
      <div class="share-lines">
        <p class="t-label-sm c-muted">Lines (up to 4)</p>
        {options.map((o) => (
          <label class="share-line">
            <input type="checkbox" checked={picked.includes(o.key)} onChange={() => toggle(o.key)} />
            <span class="share-line__text">
              {o.ro && <span>{o.ro}</span>}
              {o.ur && <span lang="ur">{o.ur}</span>}
            </span>
          </label>
        ))}
      </div>
      <div class="form-actions">
        <Button variant="secondary" icon="lyrics" onClick={copy}>Copy text</Button>
        <Button variant="secondary" icon="download" onClick={save}>Save image</Button>
        <Button icon="share" disabled={busy} onClick={share}>{busy ? 'Preparing…' : 'Share as status'}</Button>
      </div>
      {msg && <p class="t-body-sm c-variant" role="status"><Icon name="check" class="inline-icon" /> {msg}</p>}
    </Sheet>
  );
}
