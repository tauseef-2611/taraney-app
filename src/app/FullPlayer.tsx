// Full-screen player (the /design "Player"): artwork backdrop, centred synced lyrics, big controls.
// Opened from the mini-player or "Listen"; slides up over the app and keeps playing when closed.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Artwork, Lyrics } from '../components/ui/content';
import { Chip, IconButton, ModeSwitch, type ReadingMode } from '../components/ui/controls';
import { expandSung, scriptsOf } from '../lib/song-shape';
import { activeCue, buildTimeline, cueIndexAt, formatTime } from '../lib/timeline';
import type { Recording } from '../lib/types';
import { player, usePlayer } from './store';
import ShareSheet from './ShareSheet';

const RATES = [1, 1.25, 0.75];
const readMode = (): ReadingMode => { try { const m = localStorage.getItem('taraney_mode'); return m === 'ur' || m === 'ro' ? m : 'both'; } catch { return 'both'; } };

export default function FullPlayer() {
  const s = usePlayer();
  const song = s.song!;
  const rec = s.rec!;
  const cues = useMemo(() => buildTimeline(rec as unknown as Recording), [rec]);
  const blocks = useMemo(() => expandSung(song.doc, rec.structure || song.doc.structure), [song, rec]);
  const scripts = useMemo(() => scriptsOf(song.doc), [song]);
  const synced = cues.length > 0;
  const [mode, setMode] = useState<ReadingMode>(readMode);
  const [follow, setFollow] = useState(true);
  const [closing, setClosing] = useState(false);
  const [share, setShare] = useState<string[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const cue = synced ? activeCue(cues, s.t) : null;
  const past = useMemo(() => {
    const set = new Set<string>();
    for (let k = 0; k < cueIndexAt(cues, s.t); k++) set.add(cues[k].key);
    return set;
  }, [cue?.key]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); player.toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);

  // Keep the sung line centred inside the lyrics viewport.
  useEffect(() => {
    if (!follow || !cue || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(`[data-key="${cue.key}"]`);
    if (!el) return;
    const top = box.current.scrollTop + (el.getBoundingClientRect().top - box.current.getBoundingClientRect().top);
    box.current.scrollTo({ top: top - box.current.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [cue?.key, follow, mode]);

  const close = () => { setClosing(true); setTimeout(() => player.expand(false), 260); };
  const jumpLine = (dir: -1 | 1) => {
    if (!synced) return player.seek(s.t + dir * 10000);
    const i = cueIndexAt(cues, s.t);
    const target = dir < 0 ? (cue && s.t - cue.start > 1500 ? i : i - 1) : i + 1;
    player.seek(cues[Math.max(0, Math.min(cues.length - 1, target))].start);
  };
  const onLine = (occ: number, line: number) => {
    const c = cues.find((x) => x.occ === occ && x.line === line);
    if (c) { player.seek(c.start); setFollow(true); }
  };
  const changeMode = (m: ReadingMode) => { setMode(m); try { localStorage.setItem('taraney_mode', m); } catch { /* ignore */ } };
  const pct = s.duration ? Math.min(100, (s.t / s.duration) * 100) : 0;

  // Couplet around the current line, for sharing from the player.
  const shareNow = () => {
    const b = blocks.find((x) => x.occ === (cue?.occ ?? blocks[0].occ))!;
    const line = cue?.line ?? 0;
    const start = Math.max(0, Math.min(line % 2 ? line - 1 : line, b.lines.length - 2));
    setShare(b.lines.slice(start, start + 2).map((l) => `${b.occ}:${l.line}`));
  };
  const shareBlock = blocks.find((x) => x.occ === (cue?.occ ?? blocks[0]?.occ));

  return (
    <div class={`fullplayer${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Player">
      <Artwork song={song} variant="hero" animated={s.playing} class="fullplayer__art" />
      <div class="player__veil" />
      <header class="fullplayer__head">
        <IconButton icon="chevron-down" label="Close player" onClick={close} />
        <a class="fullplayer__titles" href={`/t/${song.slug}/`} onClick={() => player.expand(false)}>
          <span class="fullplayer__title">{song.title_ro || song.title_ur}</span>
          {song.title_ro && song.title_ur && <span class="fullplayer__title-ur" lang="ur">{song.title_ur}</span>}
        </a>
        <IconButton icon="sparkles" label="Share couplet" onClick={shareNow} />
      </header>

      <div class="player__lyrics fullplayer__lyrics" ref={box} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
        <Lyrics blocks={blocks} mode={mode} synced={synced} active={cue?.key} past={past} onLine={synced ? onLine : undefined} />
      </div>

      <div class="player__bar fullplayer__bar">
        <input class="seek" type="range" min={0} max={s.duration || 1} step={100} value={s.t} aria-label="Seek"
          style={{ '--pct': `${pct}%` }} onInput={(e) => player.seek(Number((e.target as HTMLInputElement).value))} />
        <div class="player__time"><span>{formatTime(s.t)}</span><span>{formatTime(s.duration)}</span></div>
        <div class="player__controls">
          <IconButton icon="prev-line" label={synced ? 'Previous line' : 'Back 10 seconds'} onClick={() => jumpLine(-1)} />
          <IconButton icon="back10" label="Back 10 seconds" size="lg" onClick={() => player.seek(s.t - 10000)} />
          <IconButton icon={s.playing ? 'pause' : 'play'} label={s.playing ? 'Pause' : 'Play'} variant="primary" size="xl" onClick={() => player.toggle()} />
          <IconButton icon="fwd10" label="Forward 10 seconds" size="lg" onClick={() => player.seek(s.t + 10000)} />
          <IconButton icon="next-line" label={synced ? 'Next line' : 'Forward 10 seconds'} onClick={() => jumpLine(1)} />
        </div>
        <div class="player__tools">
          <ModeSwitch mode={mode} scripts={scripts} onChange={changeMode} />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {synced && !follow && <Chip icon="lyrics" onClick={() => setFollow(true)}>Follow</Chip>}
            <Chip onClick={() => player.setRate(RATES[(RATES.indexOf(s.rate) + 1) % RATES.length])}>{s.rate}×</Chip>
          </div>
        </div>
      </div>

      {share && shareBlock && (
        <ShareSheet song={song} options={shareBlock.lines.map((l) => ({ key: `${shareBlock.occ}:${l.line}`, ur: l.ur, ro: l.ro }))} initial={share} onClose={() => setShare(null)} />
      )}
    </div>
  );
}
