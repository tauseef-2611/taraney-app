// Interactive player + mini-player sharing one state. Line-level sync only.
// If the sample audio is missing, a silent clock drives the same UI (clearly labelled).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { expandSung, scriptsOf } from '../../lib/song-shape';
import { activeCue, buildTimeline, cueIndexAt, formatTime } from '../../lib/timeline';
import type { Song } from '../../lib/types';
import { Artwork, Lyrics, MetaRow } from '../ui/content';
import { IconButton, ModeSwitch, Chip, type ReadingMode } from '../ui/controls';

const RATES = [0.75, 1, 1.25];

function readMode(fallback: ReadingMode): ReadingMode {
  try {
    const m = localStorage.getItem('taraney_mode');
    return m === 'ur' || m === 'ro' || m === 'both' ? m : fallback;
  } catch { return fallback; }
}

export default function PlayerDemo({ song }: { song: Song }) {
  const rec = song.recording!;
  const cues = useMemo(() => buildTimeline(rec), [rec]);
  const blocks = useMemo(() => expandSung(song.doc), [song]);
  const scripts = useMemo(() => scriptsOf(song.doc), [song]);
  const synced = cues.length > 0;

  const audio = useRef<HTMLAudioElement>(null);
  const lyricsBox = useRef<HTMLDivElement>(null);
  const clock = useRef({ base: 0, at: 0, running: false });
  const [silent, setSilent] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(synced ? cues[0].start - 1500 : 0);
  const [duration, setDuration] = useState(rec.duration_ms || 0);
  const [rate, setRate] = useState(1);
  const [mode, setMode] = useState<ReadingMode>('both');
  const [follow, setFollow] = useState(true);

  useEffect(() => setMode(readMode('both')), []);
  const changeMode = (m: ReadingMode) => { setMode(m); try { localStorage.setItem('taraney_mode', m); } catch { /* private mode */ } };

  // Time source: the audio element, or a silent clock when audio is unavailable.
  const now = () => {
    if (!silent) return (audio.current?.currentTime || 0) * 1000;
    const c = clock.current;
    return c.running ? c.base + (performance.now() - c.at) * rate : c.base;
  };
  const seek = (ms: number) => {
    const v = Math.max(0, Math.min(ms, duration || ms));
    if (!silent && audio.current) audio.current.currentTime = v / 1000;
    clock.current = { ...clock.current, base: v, at: performance.now() };
    setT(v);
  };
  const toggle = async () => {
    if (silent) {
      const c = clock.current;
      clock.current = c.running ? { base: now(), at: 0, running: false } : { base: c.base, at: performance.now(), running: true };
      setPlaying(!c.running);
      return;
    }
    const a = audio.current!;
    if (a.paused) { try { await a.play(); } catch { setSilent(true); } } else a.pause();
  };

  useEffect(() => {
    const a = audio.current!;
    a.currentTime = Math.max(0, t / 1000);
    const onMeta = () => setDuration(a.duration * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => setSilent(true);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('error', onErr);
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); a.removeEventListener('error', onErr); };
  }, []);

  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; }, [rate]);

  // One animation loop while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { setT(now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, silent, rate]);

  // Lock-screen / headset controls (real audio only).
  useEffect(() => {
    if (silent || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: song.title_ro || song.title_ur || 'Tarana', artist: 'Taraney' });
    navigator.mediaSession.setActionHandler('play', () => audio.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => seek(now() - 10000));
    navigator.mediaSession.setActionHandler('seekforward', () => seek(now() + 10000));
  }, [silent]);

  const cue = synced ? activeCue(cues, t) : null;
  const past = useMemo(() => {
    const s = new Set<string>();
    if (!synced) return s;
    const i = cueIndexAt(cues, t);
    for (let k = 0; k < i; k++) s.add(cues[k].key);
    return s;
  }, [cues, cue?.key]);

  // Keep the active line centred inside the lyrics viewport (never scrolls the page).
  useEffect(() => {
    if (!follow || !cue || !lyricsBox.current) return;
    const box = lyricsBox.current;
    const el = box.querySelector<HTMLElement>(`[data-key="${cue.key}"]`);
    if (!el) return;
    const top = box.scrollTop + (el.getBoundingClientRect().top - box.getBoundingClientRect().top);
    box.scrollTo({ top: top - box.clientHeight / 2 + el.clientHeight / 2 });
  }, [cue?.key, follow, mode]);

  const jumpLine = (dir: -1 | 1) => {
    if (!synced) return seek(t + dir * 10000);
    const i = cueIndexAt(cues, t);
    const target = dir < 0 ? (cue && t - cue.start > 1500 ? i : i - 1) : i + 1;
    const c = cues[Math.max(0, Math.min(cues.length - 1, target))];
    seek(c.start);
  };
  const onLine = (occ: number, line: number) => {
    const c = cues.find((x) => x.occ === occ && x.line === line);
    if (c) { seek(c.start); setFollow(true); }
  };

  const pct = duration ? Math.min(100, (t / duration) * 100) : 0;
  const currentLine = (() => {
    if (!cue) return null;
    const l = blocks.find((b) => b.occ === cue.occ)?.lines[cue.line];
    return l ? (mode === 'ro' ? { text: l.ro, lang: 'ur-Latn' } : l.ur ? { text: l.ur, lang: 'ur' } : { text: l.ro, lang: 'ur-Latn' }) : null;
  })();
  const card = { ...song, has_audio: true, synced };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <audio ref={audio} src={rec.audio_url || ''} preload="metadata" />

      <section class="player" aria-label="Player">
        <Artwork song={song} variant="hero" animated={playing} class="player__backdrop" />
        <div class="player__veil" />
        <div class="player__head">
          <Artwork song={song} size="sm" />
          <div class="player__titles">
            {song.title_ur && <p class="player__title-ur" lang="ur">{song.title_ur}</p>}
            {song.title_ro && <p class="player__title-ro" lang="ur-Latn">{song.title_ro}</p>}
          </div>
          <IconButton icon="heart" label="Save" />
        </div>

        <div class="player__lyrics" ref={lyricsBox} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
          <Lyrics blocks={blocks} mode={mode} synced={synced} active={cue?.key} past={past} onLine={synced ? onLine : undefined} />
        </div>

        <div class="player__bar">
          <input class="seek" type="range" min={0} max={duration || 1} step={100} value={t} aria-label="Seek"
            style={{ '--pct': `${pct}%` }} onInput={(e) => seek(Number((e.target as HTMLInputElement).value))} />
          <div class="player__time"><span>{formatTime(t)}</span><span>{formatTime(duration)}</span></div>
          <div class="player__controls">
            <IconButton icon="prev-line" label={synced ? 'Previous line' : 'Back 10 seconds'} onClick={() => jumpLine(-1)} />
            <IconButton icon="back10" label="Back 10 seconds" size="lg" onClick={() => seek(t - 10000)} />
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} variant="primary" size="xl" onClick={toggle} />
            <IconButton icon="fwd10" label="Forward 10 seconds" size="lg" onClick={() => seek(t + 10000)} />
            <IconButton icon="next-line" label={synced ? 'Next line' : 'Forward 10 seconds'} onClick={() => jumpLine(1)} />
          </div>
          <div class="player__tools">
            <ModeSwitch mode={mode} scripts={scripts} onChange={changeMode} />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {synced && !follow && <Chip icon="lyrics" onClick={() => setFollow(true)}>Follow</Chip>}
              <Chip icon="repeat" selected={rate !== 1} onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}>{rate}×</Chip>
            </div>
          </div>
          {silent && <p class="player__note">Sample audio not found. A silent clock is driving the demo (run <code>npm run setup</code>).</p>}
        </div>
      </section>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <p class="t-label-sm c-muted">Mini-player · appears only while audio is active, shares the same state</p>
        <div class="mini-player">
          <Artwork song={song} size="sm" />
          <div class="mini-player__text">
            <span class="mini-player__title" lang="ur-Latn">{song.title_ro || song.title_ur}</span>
            {currentLine
              ? <span class="mini-player__line" lang={currentLine.lang}>{currentLine.text}</span>
              : <MetaRow song={card} />}
          </div>
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} variant="primary" onClick={toggle} />
          <IconButton icon="next-line" label="Next line" size="sm" onClick={() => jumpLine(1)} />
          <div class="mini-player__progress"><span style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
    </div>
  );
}
