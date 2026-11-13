// Tarana page island: reading modes, audio player + line sync, YouTube, line actions
// (share couplet, play from here, suggest a correction), save, offline.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button, Chip, IconButton, ModeSwitch, type ReadingMode } from '../components/ui/controls';
import { Lyrics } from '../components/ui/content';
import { expandSung, scriptsOf } from '../lib/song-shape';
import { activeCue, buildTimeline, cueIndexAt, formatTime } from '../lib/timeline';
import type { Recording, SongDoc } from '../lib/types';
import type { PubRecording } from '../data/load';
import { player, usePlayer, type PlayerRec } from './store';
import { library } from './user-library';
import ShareSheet, { Sheet, type ShareLine } from './ShareSheet';

export interface ReaderSong {
  id: string; slug: string; title_ur: string | null; title_ro: string | null; mood: string; genre: string | null;
  doc: SongDoc; audio: PubRecording | null; video: PubRecording | null;
}

const readMode = (fallback: ReadingMode): ReadingMode => {
  try { const m = localStorage.getItem('taraney_mode'); return m === 'ur' || m === 'ro' || m === 'both' ? m : fallback; } catch { return fallback; }
};

export default function SongReader({ song }: { song: ReaderSong }) {
  const scripts = scriptsOf(song.doc);
  const rec = song.audio;
  const structure = rec?.structure || song.doc.structure;
  const blocks = useMemo(() => expandSung(song.doc, structure), [song]);
  const cues = useMemo(() => (rec ? buildTimeline(rec as unknown as Recording) : []), [rec]);
  const synced = cues.length > 0;

  const p = usePlayer();
  const mine = !!rec && p.rec?.id === rec.id;
  const t = mine ? p.t : 0;
  const cue = mine && synced ? activeCue(cues, t) : null;
  const past = useMemo(() => {
    const s = new Set<string>();
    if (!cue) return s;
    for (let k = 0; k < cueIndexAt(cues, t); k++) s.add(cues[k].key);
    return s;
  }, [cue?.key]);

  const [mode, setMode] = useState<ReadingMode>('both');
  const [follow, setFollow] = useState(true);
  const [saved, setSaved] = useState(false);
  const [sheet, setSheet] = useState<{ occ: number; line: number } | null>(null);
  const [share, setShare] = useState<{ options: ShareLine[]; initial: string[] } | null>(null);
  const [suggest, setSuggest] = useState<{ occ: number; line: number } | null>(null);
  const [offline, setOffline] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lyricsRef = useRef<HTMLDivElement>(null);
  const summary = { id: song.id, slug: song.slug, title_ur: song.title_ur, title_ro: song.title_ro, mood: song.mood, genre: song.genre, has_audio: !!rec };

  useEffect(() => {
    setMode(readMode(scripts.ur && scripts.ro ? 'both' : scripts.ur ? 'ur' : 'ro'));
    setSaved(library.isSaved(song.id));
    library.visit(summary);
    caches?.open('taraney-pages').then((c) => c.match(location.pathname)).then((m) => m && setOffline('saved')).catch(() => {});
  }, [song.id]);
  const changeMode = (m: ReadingMode) => { setMode(m); try { localStorage.setItem('taraney_mode', m); } catch { /* ignore */ } };

  // Follow the sung line; stop following when the reader scrolls by hand.
  useEffect(() => {
    const stop = () => setFollow(false);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    return () => { window.removeEventListener('wheel', stop); window.removeEventListener('touchmove', stop); };
  }, []);
  useEffect(() => {
    if (!follow || !cue || !p.playing || p.expanded) return;
    const el = lyricsRef.current?.querySelector<HTMLElement>(`[data-key="${cue.key}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cue?.key, follow]);

  const playerRec = (): PlayerRec | null => rec && rec.audio_url ? { id: rec.id, audio_url: rec.audio_url, label: rec.label, duration_ms: rec.duration_ms, sync_level: rec.sync_level, structure: rec.structure, lines: rec.lines } : null;
  const listen = (at?: number) => {
    const r = playerRec(); if (!r) return;
    setFollow(true);
    if (mine && at === undefined && p.playing) { player.toggle(); return; }
    player.play({ id: song.id, slug: song.slug, title_ur: song.title_ur, title_ro: song.title_ro, mood: song.mood, doc: song.doc }, r, at);
    // "Listen" opens the full player; "Play from this line" stays in the lyrics page.
    if (at === undefined) player.expand(true);
  };

  const lineOf = (occ: number, line: number) => blocks.find((b) => b.occ === occ)?.lines[line];
  const openShare = (occ: number, line: number) => {
    const b = blocks.find((x) => x.occ === occ)!;
    const options = b.lines.map((l) => ({ key: `${b.occ}:${l.line}`, ur: l.ur, ro: l.ro }));
    // A couplet is a pair of lines: the tapped line and its partner (1+2, 3+4, ...).
    const start = Math.max(0, Math.min(line % 2 ? line - 1 : line, options.length - 2));
    setShare({ options, initial: options.slice(start, start + 2).map((o) => o.key) });
  };

  const saveOffline = async () => {
    if (!('caches' in window)) return;
    setOffline('saving');
    try {
      const pages = await caches.open('taraney-pages');
      await pages.add(location.pathname);
      if (rec?.audio_url) await (await caches.open('taraney-audio')).add(rec.audio_url);
      setOffline('saved');
    } catch { setOffline('idle'); alert('Could not save for offline. Check your connection and try again.'); }
  };
  const sharePage = async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: song.title_ro || song.title_ur || 'Taraney', url }); } catch { /* cancelled */ } }
    else { await navigator.clipboard?.writeText(url); alert('Link copied'); }
  };

  const sel = sheet ? lineOf(sheet.occ, sheet.line) : null;
  const selCue = sheet ? cues.find((c) => c.occ === sheet.occ && c.line === sheet.line) : null;

  return (
    <div class="song__body">
      <div class="song-cta">
        {rec && (
          <Button size="lg" icon={mine && p.playing ? 'pause' : 'play'} class="song-cta__main" onClick={() => listen()}>
            {mine && p.playing ? 'Pause' : mine ? 'Resume' : 'Listen'}
          </Button>
        )}
        <IconButton icon="heart" label={saved ? 'Remove from library' : 'Save to library'} variant="tonal" class={saved ? 'is-saved' : ''} aria-pressed={saved ? 'true' : 'false'}
          onClick={() => { library.toggleSave(summary); setSaved(!saved); }} />
        <IconButton icon="sparkles" label="Share couplet as status" variant="tonal" onClick={() => openShare(blocks[0].occ, 0)} />
        <IconButton icon="video" label="Create lyric video" variant="tonal" onClick={() => location.assign(`/studio/${song.slug}/`)} />
        <IconButton icon="share" label="Share link" variant="tonal" onClick={sharePage} />
        <IconButton icon={offline === 'saved' ? 'check' : 'download'} label={offline === 'saved' ? 'Saved for offline' : 'Save for offline'} variant="tonal" aria-pressed={offline === 'saved' ? 'true' : 'false'} disabled={offline === 'saving'} onClick={saveOffline} />
      </div>

      {song.video && !rec && <YouTube id={song.video.youtube_id!} title={song.title_ro || song.title_ur || ''} />}

      <div class="read-bar">
        <ModeSwitch mode={mode} scripts={scripts} onChange={changeMode} />
      </div>
      <p class="read-hint"><Icon name="info" /> Tap a line to {synced ? 'play, ' : ''}share or suggest a fix</p>

      <div ref={lyricsRef} class="read-lyrics">
        <Lyrics blocks={blocks} mode={mode} surface="paper" synced={mine && synced} active={cue?.key} selected={sheet ? `${sheet.occ}:${sheet.line}` : null} past={past}
          onLine={(occ, line) => setSheet({ occ, line })} compactRepeats={!mine} />
      </div>

      {song.video && rec && <details class="card admin-card"><summary class="t-title-sm">Watch on YouTube</summary><YouTube id={song.video.youtube_id!} title={song.title_ro || ''} /></details>}


      {mine && synced && !follow && p.playing && <div class="follow-chip"><Button size="sm" variant="inverted" icon="lyrics" onClick={() => setFollow(true)}>Follow lyrics</Button></div>}

      {sheet && sel && (
        <Sheet title={`Line ${sheet.line + 1}`} onClose={() => setSheet(null)}>
          <div class="sheet__line">{sel.ur && <p lang="ur">{sel.ur}</p>}{sel.ro && <p class="t-body-lg c-variant">{sel.ro}</p>}</div>
          <div class="sheet__actions">
            <button class="sheet__action interactive" onClick={() => { openShare(sheet.occ, sheet.line); setSheet(null); }}><Icon name="sparkles" />Share as status image</button>
            <a class="sheet__action interactive" href={`/studio/${song.slug}/?line=${sheet.occ}:${sheet.line}`}><Icon name="video" />Make a lyric video from here</a>
            {selCue && <button class="sheet__action interactive" onClick={() => { listen(selCue.start); setSheet(null); }}><Icon name="play" />Play from this line</button>}
            <button class="sheet__action interactive" onClick={() => { setSuggest(sheet); setSheet(null); }}><Icon name="edit" />Suggest a correction</button>
          </div>
        </Sheet>
      )}
      {share && <ShareSheet song={song} options={share.options} initial={share.initial} onClose={() => setShare(null)} />}
      {suggest && <SuggestFix song={song} blocks={blocks} at={suggest} onClose={() => setSuggest(null)} />}
    </div>
  );
}

function YouTube({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div class="yt">
      {on
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        : <button style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }} onClick={() => setOn(true)} aria-label="Play video"><span><Icon name="play" /></span></button>}
    </div>
  );
}

function SuggestFix({ song, blocks, at, onClose }: { song: ReaderSong; blocks: ReturnType<typeof expandSung>; at: { occ: number; line: number }; onClose: () => void }) {
  const b = blocks.find((x) => x.occ === at.occ)!;
  const l = b.lines[at.line];
  const [ur, setUr] = useState(l.ur);
  const [ro, setRo] = useState(l.ro);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | string>('idle');
  const send = async (e: Event) => {
    e.preventDefault();
    if (ur === l.ur && ro === l.ro) { setState('Change the line first.'); return; }
    setState('sending');
    const res = await fetch('/api/submissions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'lyrics_fix', song_id: song.id, section: b.section, line: String(at.line), current_ur: l.ur, current_ro: l.ro, proposed_ur: ur !== l.ur ? ur : '', proposed_ro: ro !== l.ro ? ro : '', note, name, website: '' }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setState(res?.ok ? 'done' : data?.error || 'Could not send. Try again later.');
  };
  return (
    <Sheet title="Suggest a correction" onClose={onClose}>
      {state === 'done' ? (
        <div class="empty-state"><Icon name="check" /><p class="t-title-md">Thank you</p><p>An editor will review your suggestion.</p><Button onClick={onClose}>Done</Button></div>
      ) : (
        <form class="stack" onSubmit={send}>
          {l.ur && <label class="field"><span class="field__label">Urdu</span><input class="input input--ur" lang="ur" dir="rtl" value={ur} onInput={(e) => setUr((e.target as HTMLInputElement).value)} /></label>}
          {l.ro && <label class="field"><span class="field__label">Roman</span><input class="input" value={ro} onInput={(e) => setRo((e.target as HTMLInputElement).value)} /></label>}
          <label class="field"><span class="field__label">What is wrong? (optional)</span><input class="input" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></label>
          <label class="field"><span class="field__label">Your name (optional)</span><input class="input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
          {state !== 'idle' && state !== 'sending' && <p class="field__error">{state}</p>}
          <Button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send suggestion'}</Button>
        </form>
      )}
    </Sheet>
  );
}
