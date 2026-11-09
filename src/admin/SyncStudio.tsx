// Sync Studio: line-level timing in two passes.
// 1) Tap: play the song, press Space at the start of each line (auto-advances).
// 2) Refine: waveform timeline with draggable/resizable line blocks, nudges, loop, slow playback, undo.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { Button, Chip, IconButton } from '../components/ui/controls';
import { expandSung } from '../lib/song-shape';
import { formatTime } from '../lib/timeline';
import { api } from './api';
import { go, useToast } from './App';
import type { FullSong, Rec } from './SongEditor';

interface Item { key: string; occ: number; section: string; line: number; ur: string; ro: string; repeat: boolean }
type Timing = Record<string, { start: number | null; end: number | null }>;

const RATES = [0.5, 0.75, 1];
const ZOOMS = [15, 30, 60, 100]; // px per second
const MIN_LEN = 200;

export default function SyncStudio({ song, rec, onSaved }: { song: FullSong; rec: Rec; onSaved: () => void }) {
  const toast = useToast();
  const structure = rec.structure || song.doc.structure;
  const items = useMemo<Item[]>(() => expandSung(song.doc, structure).flatMap((b) =>
    b.lines.map((l) => ({ key: `${b.occ}:${l.line}`, occ: b.occ, section: b.section, line: l.line, ur: l.ur, ro: l.ro, repeat: b.repeat }))), [song, rec]);

  const [timing, setTiming] = useState<Timing>(() => {
    const t: Timing = {};
    for (const it of items) t[it.key] = { start: null, end: null };
    for (const l of rec.lines) if (t[`${l.occ}:${l.line}`]) t[`${l.occ}:${l.line}`] = { start: l.start_ms, end: l.end_ms ?? null };
    return t;
  });
  const history = useRef<Timing[]>([]);
  const [dirty, setDirty] = useState(false);
  const [cursor, setCursor] = useState(() => Math.max(0, items.findIndex((it) => timing[it.key]?.start == null)));
  const [selected, setSelected] = useState<number | null>(null);
  const [tapMode, setTapMode] = useState(true);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(rec.duration_ms || 0);
  const [rate, setRate] = useState(1);
  const [zoom, setZoom] = useState(30);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [saving, setSaving] = useState(false);

  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const commit = (next: Timing) => { history.current = [...history.current.slice(-80), timing]; setTiming(next); setDirty(true); };
  const undo = () => { const prev = history.current.pop(); if (prev) { setTiming(prev); setDirty(true); } };

  // Effective end of each line: its own end, else the next timed line's start, else +3s.
  const spans = useMemo(() => {
    const timed = items.map((it, i) => ({ i, s: timing[it.key].start })).filter((x) => x.s != null).sort((a, b) => a.s! - b.s!);
    const out: Record<number, { s: number; e: number }> = {};
    timed.forEach((x, k) => {
      const own = timing[items[x.i].key].end;
      const next = timed[k + 1]?.s;
      out[x.i] = { s: x.s!, e: own ?? next ?? x.s! + 3000 };
    });
    return out;
  }, [timing, items]);
  const activeIdx = useMemo(() => {
    let best = -1;
    for (const [i, sp] of Object.entries(spans)) if (t >= sp.s && t < sp.e && (best < 0 || sp.s >= spans[best].s)) best = Number(i);
    return best;
  }, [t, spans]);

  /* ---------- Audio ---------- */
  useEffect(() => {
    const a = audio.current!;
    const meta = () => setDuration(a.duration * 1000);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    a.addEventListener('loadedmetadata', meta); a.addEventListener('play', play); a.addEventListener('pause', pause);
    return () => { a.removeEventListener('loadedmetadata', meta); a.removeEventListener('play', play); a.removeEventListener('pause', pause); };
  }, []);
  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; }, [rate]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const now = (audio.current?.currentTime || 0) * 1000;
      if (loop && selected != null && spans[selected] && now >= spans[selected].e) seek(spans[selected].s);
      setT(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, selected, spans]);
  const seek = (ms: number) => { const a = audio.current!; a.currentTime = Math.max(0, ms) / 1000; setT(Math.max(0, ms)); };
  const toggle = () => { const a = audio.current!; if (a.paused) a.play(); else a.pause(); };

  /* ---------- Waveform ---------- */
  useEffect(() => {
    if (!rec.audio_url) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(rec.audio_url!)).arrayBuffer();
        const ctx = new AudioContext();
        const data = await ctx.decodeAudioData(buf);
        ctx.close();
        const ch = data.getChannelData(0);
        const perSec = 50;
        const n = Math.ceil(data.duration * perSec);
        const step = Math.floor(ch.length / n);
        const p = new Float32Array(n);
        let max = 0;
        for (let i = 0; i < n; i++) {
          let m = 0;
          for (let j = i * step, end = j + step; j < end; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
          p[i] = m; if (m > max) max = m;
        }
        for (let i = 0; i < n; i++) p[i] /= max || 1;
        if (!cancelled) { setPeaks(p); setDuration(data.duration * 1000); }
      } catch { /* waveform is optional */ }
    })();
    return () => { cancelled = true; };
  }, [rec.audio_url]);

  const width = Math.max(600, Math.ceil((duration / 1000) * zoom));
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !peaks) return;
    const h = 72;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.min(width * dpr, 32000); cv.height = h * dpr;
    cv.style.width = `${width}px`;
    const g = cv.getContext('2d')!;
    g.scale(cv.width / width, dpr);
    const color = getComputedStyle(cv).color;
    g.fillStyle = color;
    const perPx = peaks.length / width;
    for (let x = 0; x < width; x++) {
      const v = peaks[Math.floor(x * perPx)] || 0;
      const bh = Math.max(1, v * (h - 6));
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }, [peaks, width]);

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = track.current?.parentElement;
    if (!el || !playing) return;
    const x = (t / 1000) * zoom;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 80) el.scrollLeft = x - el.clientWidth / 3;
  }, [Math.floor(t / 500), playing, zoom]);
  // Keep the cursor / active line visible in the list.
  useEffect(() => {
    const idx = playing && activeIdx >= 0 ? activeIdx : tapMode ? cursor : selected;
    if (idx == null) return;
    listRef.current?.children[idx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, cursor, selected, playing, tapMode]);

  /* ---------- Editing ---------- */
  const tap = () => {
    if (cursor >= items.length) return toast('All lines are timed. Click a line to re-tap from there.');
    if (!playing) { toggle(); return; } // first press starts playback
    const now = Math.round(t);
    const next = { ...timing, [items[cursor].key]: { start: now, end: null } };
    commit(next);
    setSelected(cursor);
    setCursor(cursor + 1);
  };
  const markEnd = () => {
    const i = cursor - 1;
    if (i < 0) return;
    commit({ ...timing, [items[i].key]: { ...timing[items[i].key], end: Math.round(t) } });
  };
  const shift = (i: number, ds: number, de: number) => {
    const k = items[i].key; const cur = timing[k];
    if (cur.start == null) return;
    const sp = spans[i];
    const s = Math.max(0, sp.s + ds);
    const e = Math.max(s + MIN_LEN, sp.e + de);
    commit({ ...timing, [k]: { start: s, end: de !== 0 || cur.end != null ? e : null } });
  };
  const clearLine = (i: number) => commit({ ...timing, [items[i].key]: { start: null, end: null } });
  const clearFrom = (i: number) => {
    if (!confirm(`Clear timing from line ${i + 1} to the end?`)) return;
    const next = { ...timing };
    items.slice(i).forEach((it) => { next[it.key] = { start: null, end: null }; });
    commit(next); setCursor(i);
  };
  const pickLine = (i: number) => {
    setSelected(i);
    if (tapMode) setCursor(i);
    const s = timing[items[i].key].start;
    if (s != null) seek(Math.max(0, s - (tapMode ? 1500 : 0)));
  };

  /* ---------- Dragging blocks ---------- */
  const drag = useRef<{ i: number; mode: 'move' | 'start' | 'end'; x0: number; s0: number; e0: number; base: Timing } | null>(null);
  const onBlockDown = (e: PointerEvent, i: number) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const mode = e.clientX - r.left < 8 ? 'start' : r.right - e.clientX < 8 ? 'end' : 'move';
    drag.current = { i, mode, x0: e.clientX, s0: spans[i].s, e0: spans[i].e, base: timing };
    setSelected(i);
    el.setPointerCapture(e.pointerId);
  };
  const onBlockMove = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dt = ((e.clientX - d.x0) / zoom) * 1000;
    const k = items[d.i].key;
    let s = d.s0; let en = d.e0;
    if (d.mode === 'move') { s = Math.max(0, d.s0 + dt); en = s + (d.e0 - d.s0); }
    if (d.mode === 'start') s = Math.min(Math.max(0, d.s0 + dt), d.e0 - MIN_LEN);
    if (d.mode === 'end') en = Math.max(d.s0 + MIN_LEN, d.e0 + dt);
    setTiming({ ...d.base, [k]: { start: Math.round(s), end: d.mode === 'start' && d.base[k].end == null ? null : Math.round(en) } });
  };
  const onBlockUp = () => {
    const d = drag.current; if (!d) return;
    history.current = [...history.current.slice(-80), d.base]; setDirty(true);
    drag.current = null;
  };

  /* ---------- Keyboard ---------- */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.code === 'Space') { e.preventDefault(); tapMode ? tap() : toggle(); return; }
      if (e.key === 'k' || e.key === 'K') { toggle(); return; }
      if (e.key === 'e' || e.key === 'E') { markEnd(); return; }
      if (e.key === 'l' || e.key === 'L') { setLoop((v) => !v); return; }
      if (e.key === 'Backspace' && tapMode && cursor > 0) { e.preventDefault(); clearLine(cursor - 1); setCursor(cursor - 1); return; }
      if (selected != null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 500 : 100);
        shift(selected, d, d);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const save = async () => {
    setSaving(true);
    try {
      const lines = items.map((it, i) => ({ it, sp: spans[i], own: timing[it.key] }))
        .filter((x) => x.own.start != null)
        .map(({ it, own }) => ({ occ: it.occ, section: it.section, line: it.line, start_ms: own.start!, end_ms: own.end }));
      await api.put(`/admin/recordings/${rec.id}/timing`, { lines, structure, duration_ms: duration });
      setDirty(false); toast(`Saved ${lines.length} timed lines`); onSaved();
    } catch (x) { toast((x as Error).message, 'err'); } finally { setSaving(false); }
  };

  const timed = Object.keys(spans).length;
  const sel = selected != null ? items[selected] : null;

  return (
    <div class="studio">
      <audio ref={audio} src={rec.audio_url || ''} preload="auto" />
      <header class="studio__bar card">
        <button class="btn btn--text btn--sm interactive" onClick={() => { if (!dirty || confirm('Leave without saving?')) go(`#/songs/${song.id}/audio`); }}>← Recordings</button>
        <b class="t-title-sm">{rec.label || 'Recording'}</b>
        <span class="t-body-sm c-muted">{timed}/{items.length} lines timed</span>
        <span class="spacer" />
        <div class="segmented" role="group" aria-label="Mode">
          <button class="interactive" aria-pressed={tapMode ? 'true' : 'false'} onClick={() => setTapMode(true)}>Tap</button>
          <button class="interactive" aria-pressed={!tapMode ? 'true' : 'false'} onClick={() => setTapMode(false)}>Refine</button>
        </div>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : dirty ? 'Save timing' : 'Saved'}</Button>
      </header>

      <div class="studio__body">
        <ol class="studio__lines card" ref={listRef}>
          {items.map((it, i) => {
            const st = timing[it.key].start;
            const cls = ['studio-line', i === activeIdx && 'is-active', i === selected && 'is-selected', tapMode && i === cursor && 'is-cursor', st == null && 'is-untimed'].filter(Boolean).join(' ');
            return (
              <li class={cls} onClick={() => pickLine(i)}>
                <span class="studio-line__time">{st == null ? '—' : formatTime(st)}<small>{st == null ? '' : `.${String(Math.floor((st % 1000) / 100))}`}</small></span>
                <span class="studio-line__text">
                  {it.ro && <span lang="ur-Latn">{it.ro}</span>}
                  {it.ur && <span class="studio-line__ur" lang="ur">{it.ur}</span>}
                </span>
                <span class="studio-line__tag">{it.section}{it.repeat ? ' ↻' : ''}</span>
              </li>
            );
          })}
        </ol>

        <aside class="studio__side">
          <section class="card admin-card studio__now">
            {tapMode ? (
              <>
                <p class="t-label-sm c-muted">Next line to tap · {Math.min(cursor + 1, items.length)}/{items.length}</p>
                <p class="studio__next" lang="ur-Latn">{items[cursor]?.ro || items[cursor]?.ur || 'All lines timed'}</p>
                <button class="tap-btn interactive" onClick={tap}>{playing ? 'TAP · Space' : 'Start · Space'}</button>
                <p class="t-body-sm c-muted">Press when the singer starts the line. <b>E</b> marks where a line ends (before a long pause). <b>Backspace</b> un-taps.</p>
              </>
            ) : sel ? (
              <>
                <p class="t-label-sm c-muted">Selected · {sel.section} line {sel.line + 1}</p>
                <p class="studio__next" lang="ur-Latn">{sel.ro || sel.ur}</p>
                {spans[selected!] ? (
                  <div class="nudges">
                    <span>Start {formatTime(spans[selected!].s)}</span>
                    <Button size="sm" variant="secondary" onClick={() => shift(selected!, -100, 0)}>−0.1</Button>
                    <Button size="sm" variant="secondary" onClick={() => shift(selected!, 100, 0)}>+0.1</Button>
                    <span>End {formatTime(spans[selected!].e)}</span>
                    <Button size="sm" variant="secondary" onClick={() => shift(selected!, 0, -100)}>−0.1</Button>
                    <Button size="sm" variant="secondary" onClick={() => shift(selected!, 0, 100)}>+0.1</Button>
                  </div>
                ) : <p class="t-body-sm c-muted">Not timed yet. Switch to Tap, or drag on the timeline.</p>}
                <div class="chip-row">
                  <Chip icon="repeat" selected={loop} onClick={() => setLoop(!loop)}>Loop line (L)</Chip>
                  <Chip icon="close" onClick={() => clearLine(selected!)}>Clear</Chip>
                  <Chip icon="trash" onClick={() => clearFrom(selected!)}>Clear to end</Chip>
                </div>
                <p class="t-body-sm c-muted">← → move the line 0.1 s (Shift: 0.5 s). Drag blocks on the timeline; drag their edges to trim.</p>
              </>
            ) : <p class="t-body-md c-muted">Click a line or a timeline block to refine it.</p>}
          </section>
          <section class="card admin-card studio__preview">
            <p class="t-label-sm c-muted">Live preview</p>
            {activeIdx >= 0 ? (
              <>
                {items[activeIdx].ur && <p class="t-lyric-ur" lang="ur">{items[activeIdx].ur}</p>}
                {items[activeIdx].ro && <p class="t-body-lg" lang="ur-Latn">{items[activeIdx].ro}</p>}
              </>
            ) : <p class="t-body-md c-muted">{playing ? '♪ instrumental' : 'Play to preview the highlight'}</p>}
          </section>
        </aside>
      </div>

      <section class="studio__timeline card">
        <div class="studio__transport">
          <IconButton icon="back10" label="Back 5 seconds" onClick={() => seek(t - 5000)} />
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause (K)' : 'Play (K)'} variant="primary" size="lg" onClick={toggle} />
          <IconButton icon="fwd10" label="Forward 5 seconds" onClick={() => seek(t + 5000)} />
          <span class="t-label-md studio__clock">{formatTime(t)}.{Math.floor((t % 1000) / 100)} / {formatTime(duration)}</span>
          <span class="spacer" />
          <span class="t-body-sm c-muted">Speed</span>
          {RATES.map((r) => <Chip selected={rate === r} onClick={() => setRate(r)}>{r}×</Chip>)}
          <span class="t-body-sm c-muted">Zoom</span>
          {ZOOMS.map((z, i) => <Chip selected={zoom === z} onClick={() => setZoom(z)}>{i + 1}</Chip>)}
          <IconButton icon="repeat" label="Undo (Ctrl+Z)" onClick={undo} />
        </div>
        <div class="tl">
          <div class="tl__track" ref={track} style={{ width: `${width}px` }}
            onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); seek(((e.clientX - r.left) / zoom) * 1000); }}>
            <canvas class="tl__wave" ref={canvas} />
            {!peaks && <span class="tl__loading t-body-sm c-muted">Drawing waveform…</span>}
            <div class="tl__ruler">{Array.from({ length: Math.ceil(duration / 10000) }, (_, s) => <span style={{ left: `${s * 10 * zoom}px` }}>{formatTime(s * 10000)}</span>)}</div>
            <div class="tl__blocks">
              {Object.entries(spans).map(([k, sp]) => {
                const i = Number(k);
                return (
                  <div class={`tl__block${i === selected ? ' is-selected' : ''}${i === activeIdx ? ' is-active' : ''}`}
                    style={{ left: `${(sp.s / 1000) * zoom}px`, width: `${Math.max(6, ((sp.e - sp.s) / 1000) * zoom)}px` }}
                    title={items[i].ro || items[i].ur}
                    onPointerDown={(e) => onBlockDown(e as unknown as PointerEvent, i)}
                    onPointerMove={(e) => onBlockMove(e as unknown as PointerEvent)}
                    onPointerUp={onBlockUp}>
                    <span>{i + 1} {items[i].ro || items[i].ur}</span>
                  </div>
                );
              })}
            </div>
            <div class="tl__head" style={{ left: `${(t / 1000) * zoom}px` }} />
          </div>
        </div>
        <p class="t-body-sm c-muted studio__keys"><Icon name="info" /> Space: {tapMode ? 'tap line' : 'play/pause'} · K play/pause · E mark end · L loop · ← → nudge · Ctrl+Z undo · click the waveform to seek</p>
      </section>
    </div>
  );
}
