// Reel Studio: full-screen lyric video editor. The engine in src/studio draws each frame to a canvas;
// this file owns editor state, the preview clock, the tool panels and the export sheet.
import '../styles/studio.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from '../components/ui/Icon';
import { Button, Chip, IconButton, Progress } from '../components/ui/controls';
import { Sheet } from './ShareSheet';
import { player } from './store';
import { FORMATS, type Clip, type ExportResult, type FontStyle, type FormatKey, type Project, type Script, type Template, type TextAnim, type TextPosition, type WordSplit } from '../studio/types';
import { DEFAULT_TEMPLATE_ID, TEMPLATES, TEMPLATE_BY_ID, recommendedTemplates, templatesForMood } from '../studio/templates';
import { activeIndex, drawFrame, ensureStudioFonts } from '../studio/render';
import { MAX_CLIP_MS, buildClip, chunkStudioLines, defaultRange, flattenSong } from '../studio/clip';
import { STOCK_VIDEOS, STOCK_VIDEO_BY_ID, type StockVideo } from '../studio/stock-videos';
import { canExport, exportVideo, saveVideo, shareOrSaveVideo } from '../studio/export';
import { MOODS, MOOD_LABELS, type Mood } from '../lib/mood';
import { scriptsOf } from '../lib/song-shape';
import { formatTime } from '../lib/timeline';
import { slugify } from '../lib/slug';
import type { Recording, SongDoc } from '../lib/types';
import type { PubRecording } from '../data/load';

export interface StudioSong {
  id: string; slug: string; title_ur: string | null; title_ro: string | null; mood: string; themes: string[];
  poet_ro: string | null; singer: string | null; doc: SongDoc; audio: PubRecording | null;
}

type Tool = 'templates' | 'lines' | 'text' | 'background' | 'format';
const TOOLS: { key: Tool; label: string; icon: IconName }[] = [
  { key: 'templates', label: 'Templates', icon: 'layers' },
  { key: 'lines', label: 'Lines', icon: 'lyrics' },
  { key: 'text', label: 'Text', icon: 'type' },
  { key: 'background', label: 'Background', icon: 'image' },
  { key: 'format', label: 'Format', icon: 'ratio' },
];
const POSITIONS: { key: TextPosition; label: string }[] = [
  { key: 'top', label: 'Top' }, { key: 'center', label: 'Center' }, { key: 'bottom', label: 'Bottom' },
];
/** Format preview shapes in CSS px, same aspect as FORMATS. */
const SHAPE: Record<FormatKey, [number, number]> = { reel: [36, 64], square: [48, 48], wide: [64, 36] };
/** Timeline scale: 70px per second, with a 56px minimum per block. */
const PX_PER_MS = 0.07;
const THUMB_W = 270;
const THUMB_H = 480;

const errText = (e: unknown): string => (e instanceof Error && e.message ? e.message : 'Something went wrong. Try again.');
const isAbort = (e: unknown): boolean => typeof e === 'object' && e !== null && 'name' in e && (e as { name: unknown }).name === 'AbortError';
const seg = (on: boolean, label: ComponentChildren, onClick: () => void) => (
  <button type="button" class="interactive" aria-pressed={on ? 'true' : 'false'} onClick={onClick}>{label}</button>
);

export default function Studio({ song }: { song: StudioSong }) {
  const scripts = useMemo(() => scriptsOf(song.doc), [song]);
  const bilingual = scripts.ur && scripts.ro;
  const audioUrl = song.audio?.audio_url ?? null;
  const title = song.title_ro || song.title_ur || '';
  const subtitle = song.poet_ro || song.singer || '';
  const fileName = `taraney-${slugify(song.title_ro || song.id).slice(0, 40) || song.id}`;

  const flat = useMemo(
    () => flattenSong(song.doc, song.audio?.structure, song.audio as unknown as Recording),
    [song],
  );
  const startIndex = useMemo(() => {
    if (typeof location === 'undefined') return 0;
    const key = new URLSearchParams(location.search).get('line');
    return key ? Math.max(0, flat.findIndex((f) => f.key === key)) : 0;
  }, [flat]);

  // Editor state
  const initialTpl = useMemo(() => recommendedTemplates(song.mood, song.themes)[0] ?? TEMPLATES[0], [song]);
  const [templateId, setTemplateId] = useState(() => initialTpl.id);
  const [format, setFormat] = useState<FormatKey>('reel');
  const [script, setScript] = useState<Script>(() => initialTpl.defaultScript ?? (bilingual ? 'both' : scripts.ur ? 'ur' : 'ro'));
  const [fontStyle, setFontStyle] = useState<FontStyle>(() => initialTpl.fontStyle ?? 'default');
  const [animOverride, setAnimOverride] = useState<TextAnim | 'default'>('default');
  const [wordSplit, setWordSplit] = useState<WordSplit>('full');
  const [range, setRange] = useState<[number, number]>(() => defaultRange(flat, startIndex));
  const [secPerLine, setSecPerLine] = useState(3.5);
  const [useAudio, setUseAudio] = useState(!!audioUrl);
  const [textScale, setTextScale] = useState(() => initialTpl.defaultScale ?? 1);
  const [position, setPosition] = useState<TextPosition>('center');
  const [showTitle, setShowTitle] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showProgress, setShowProgress] = useState(false);
  const [image, setImage] = useState<CanvasImageSource | null>(null);
  const [isVideoMedia, setIsVideoMedia] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(() => initialTpl.suggestedVideoId ?? null);
  const [imageDim, setImageDim] = useState(0.45);
  const [tool, setTool] = useState<Tool>('templates');
  const [tplMood, setTplMood] = useState<Mood | 'rec'>('rec');
  const [notice, setNotice] = useState('');

  // Preview clock
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [fontsTick, setFontsTick] = useState(0);

  // Export
  const [exportOpen, setExportOpen] = useState(false);
  const [quality, setQuality] = useState<'hd' | 'fast'>('hd');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const [exportErr, setExportErr] = useState('');

  const [from, to] = range;
  const rawClip: Clip = useMemo(() => buildClip(flat, from, to, secPerLine), [flat, from, to, secPerLine]);
  const clip: Clip = useMemo(() => {
    if (wordSplit === 'chunk2') {
      return { ...rawClip, lines: chunkStudioLines(rawClip.lines, 2) };
    }
    if (wordSplit === 'chunk3') {
      return { ...rawClip, lines: chunkStudioLines(rawClip.lines, 3) };
    }
    return rawClip;
  }, [rawClip, wordSplit]);
  const template: Template = TEMPLATE_BY_ID[templateId] ?? TEMPLATES[0];

  const applyStockVideo = (v: StockVideo) => {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.playsInline = true;
    vid.muted = true;
    vid.loop = true;
    vid.autoplay = true;
    vid.preload = 'auto';
    vid.onloadeddata = () => {
      if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current);
      imgUrlRef.current = null;
      vid.play().catch(() => {});
      setImage(vid);
      setIsVideoMedia(true);
      setImageDim(v.defaultDim);
      setSelectedStockId(v.id);
      setNotice(`Background video: ${v.title}`);
    };
    vid.onerror = () => {
      if (vid.src !== v.fallbackUrl) {
        vid.src = v.fallbackUrl;
      } else {
        setNotice('Could not stream that background video.');
      }
    };
    vid.src = `/api/media/${v.r2Key}`;
  };

  const selectTemplate = (t: Template) => {
    setTemplateId(t.id);
    if (t.defaultScript && bilingual) setScript(t.defaultScript);
    if (t.fontStyle) setFontStyle(t.fontStyle);
    if (t.defaultScale) setTextScale(t.defaultScale);
    if (t.suggestedVideoId && STOCK_VIDEO_BY_ID[t.suggestedVideoId]) {
      applyStockVideo(STOCK_VIDEO_BY_ID[t.suggestedVideoId]);
    }
  };

  useEffect(() => {
    if (initialTpl.suggestedVideoId && STOCK_VIDEO_BY_ID[initialTpl.suggestedVideoId]) {
      applyStockVideo(STOCK_VIDEO_BY_ID[initialTpl.suggestedVideoId]);
    }
  }, []);

  const base = useMemo<Omit<Project, 'template' | 'format'>>(() => ({
    script, lines: clip.lines, duration: clip.duration, title, subtitle, showTitle, showBrand, showProgress,
    textScale, position, image, imageDim, seed: song.id,
    fontStyle,
    animOverride: animOverride === 'default' ? undefined : animOverride,
  }), [script, clip, title, subtitle, showTitle, showBrand, showProgress, textScale, position, image, imageDim, song.id, fontStyle, animOverride]);
  const project: Project = useMemo(() => ({ ...base, template, format }), [base, template, format]);

  // Refs read by the frame loop, so it never needs re-subscribing.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project>(project);
  projectRef.current = project;
  const clipRef = useRef<Clip>(clip);
  clipRef.current = clip;
  const useAudioRef = useRef(useAudio);
  useAudioRef.current = useAudio;
  const tRef = useRef(0);
  const playingRef = useRef(false);
  // True while a new clip is parked on its first line (not played yet). Cleared by manual seeks and by play.
  const parkedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const imgUrlRef = useRef<string | null>(null);
  const thumbCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const offRef = useRef<HTMLCanvasElement | null>(null);

  const dims = FORMATS[format];
  const pct = clip.duration ? Math.min(100, (now / clip.duration) * 100) : 0;
  const activeIdx = activeIndex(clip.lines, now);

  // Mount: pause the app's main player, create the studio's own audio, load fonts.
  useEffect(() => {
    if (player.get().playing) player.toggle();
    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.preload = 'auto';
      audioRef.current = a;
    }
    let alive = true;
    ensureStudioFonts().then(() => { if (alive) setFontsTick((n) => n + 1); }).catch(() => { /* fallback fonts */ });
    return () => {
      alive = false;
      const a = audioRef.current;
      if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
      audioRef.current = null;
      abortRef.current?.abort();
      if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current);
    };
  }, []);

  // One rAF loop draws every frame; the clock advances only while playing.
  useEffect(() => {
    const g = canvasRef.current?.getContext('2d');
    if (!g) return;
    let raf = 0;
    let last = 0;
    let uiAt = 0;
    const frame = (ts: number) => {
      const dt = last ? Math.min(100, ts - last) : 0;
      last = ts;
      const c = clipRef.current;
      const a = audioRef.current;
      if (playingRef.current) {
        if (useAudioRef.current && a && !a.error) {
          const t = a.currentTime * 1000 - c.audioStartMs;
          if (t >= c.duration) { a.currentTime = c.audioStartMs / 1000; tRef.current = 0; }
          else tRef.current = Math.max(0, t);
        } else {
          const t = tRef.current + dt;
          tRef.current = c.duration > 0 && t < c.duration ? t : 0;
        }
      }
      drawFrame(g, projectRef.current, tRef.current);
      if (ts - uiAt > 120) { uiAt = ts; setNow(tRef.current); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seekTo = (ms: number) => {
    const c = clipRef.current;
    const t = Math.max(0, Math.min(ms, c.duration));
    tRef.current = t;
    setNow(t);
    const a = audioRef.current;
    if (a && useAudioRef.current) a.currentTime = (c.audioStartMs + t) / 1000;
  };
  /** Manual seek (slider, timeline): leaves the parked state. */
  const seek = (ms: number) => {
    parkedRef.current = false;
    seekTo(ms);
  };

  const setPlay = (on: boolean) => {
    const c = clipRef.current;
    const a = audioRef.current;
    if (on) {
      if (parkedRef.current) tRef.current = 0; // play from the top, not from the parked frame
      parkedRef.current = false;
    }
    if (on && tRef.current >= c.duration) tRef.current = 0;
    playingRef.current = on;
    setPlaying(on);
    if (a && useAudioRef.current) {
      if (on) {
        a.currentTime = (c.audioStartMs + tRef.current) / 1000;
        a.play().catch(() => setPlay(false));
      } else {
        a.pause();
      }
    }
  };
  const togglePlay = () => setPlay(!playingRef.current);

  // A new clip is parked on its first line when paused, so the lyrics show at once. Playing restarts it from the top.
  // The audio is re-seeded to match either way.
  useEffect(() => {
    if (playingRef.current) {
      parkedRef.current = false;
      seekTo(0);
      return;
    }
    seekTo(Math.min(clip.duration, (clip.lines[0]?.start ?? 0) + 900));
    parkedRef.current = true;
  }, [clip]);

  // Turning audio off mid-play falls back to the clock; turning it back on resumes it.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!useAudio) { a.pause(); return; }
    if (playingRef.current) {
      a.currentTime = (clipRef.current.audioStartMs + tRef.current) / 1000;
      a.play().catch(() => setPlay(false));
    }
  }, [useAudio]);

  // Keep the active timeline block in view while playing.
  useEffect(() => {
    if (!playing) return;
    const strip = stripRef.current;
    const el = strip?.children[activeIdx] as HTMLElement | undefined;
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [activeIdx, playing]);

  // Any change to the video invalidates the last export.
  useEffect(() => { setResult(null); setExportMsg(''); }, [project]);
  useEffect(() => {
    if (!result) { setResultUrl(null); return; }
    const u = URL.createObjectURL(result.blob);
    setResultUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);

  // Template thumbnails: draw once per change (debounced), from an offscreen 1080x1920 canvas.
  const shownTemplates = useMemo(
    () => (tplMood === 'rec' ? recommendedTemplates(song.mood, song.themes) : templatesForMood(tplMood)),
    [tplMood, song.mood, song.themes],
  );
  const thumbKey = shownTemplates.map((t) => t.id).join(',');
  useEffect(() => {
    if (tool !== 'templates') return;
    const timer = setTimeout(() => {
      const off = offRef.current ?? (offRef.current = document.createElement('canvas'));
      off.width = 1080;
      off.height = 1920;
      const og = off.getContext('2d');
      if (!og) return;
      const t = (clip.lines[0]?.start ?? 0) + 800;
      for (const tpl of shownTemplates) {
        const dst = thumbCanvases.current.get(tpl.id)?.getContext('2d');
        if (!dst) continue;
        drawFrame(og, { ...base, template: tpl, format: 'reel' }, t);
        dst.clearRect(0, 0, THUMB_W, THUMB_H);
        dst.drawImage(off, 0, 0, THUMB_W, THUMB_H);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [tool, base, thumbKey, fontsTick]);

  // Actions
  const goBack = () => {
    if (history.length > 1) history.back();
    else location.assign(`/t/${song.slug}/`);
  };

  const tapLine = (i: number) => {
    const [a, b] = range;
    let next: [number, number] | null;
    if (i < a) next = [i, b];
    else if (i > b) next = [a, i];
    else if (a === b) next = null;
    else if (i === a) next = [a + 1, b];
    else if (i === b) next = [a, b - 1];
    else next = [i, b];
    if (!next) return;
    if (buildClip(flat, next[0], next[1], secPerLine).duration > MAX_CLIP_MS) {
      setNotice(`Clips can be up to ${Math.round(MAX_CLIP_MS / 1000)} seconds`);
      return;
    }
    setNotice('');
    setRange(next);
  };

  const resetRange = () => { setNotice(''); setRange(defaultRange(flat, startIndex)); };

  const onMedia = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);

    if (isVid) {
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.playsInline = true;
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.onloadeddata = () => {
        if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current);
        imgUrlRef.current = url;
        vid.play().catch(() => {});
        setImage(vid);
        setIsVideoMedia(true);
        setSelectedStockId(null);
        setNotice('Video background added');
      };
      vid.onerror = () => { URL.revokeObjectURL(url); setNotice('That video could not be opened.'); };
      vid.src = url;
    } else {
      const img = new Image();
      img.onload = () => {
        if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current);
        imgUrlRef.current = url;
        setImage(img);
        setIsVideoMedia(false);
        setSelectedStockId(null);
        setNotice('Photo added');
      };
      img.onerror = () => { URL.revokeObjectURL(url); setNotice('That photo could not be opened.'); };
      img.src = url;
    }
  };
  const removeMedia = () => {
    if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current);
    imgUrlRef.current = null;
    setImage(null);
    setIsVideoMedia(false);
    setSelectedStockId(null);
  };

  const openExport = () => { setPlay(false); setExportOpen(true); };
  const closeExport = () => { abortRef.current?.abort(); setExportOpen(false); };

  const runExport = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlay(false);
    setExporting(true);
    setProgress(0);
    setExportErr('');
    setExportMsg('');
    setResult(null);
    try {
      const r = await exportVideo({
        project: projectRef.current,
        audioUrl: useAudio ? audioUrl : null,
        audioStartMs: clip.audioStartMs,
        scale: quality === 'hd' ? 1 : 2 / 3,
        onProgress: setProgress,
        signal: ctrl.signal,
      });
      setResult(r);
    } catch (e) {
      if (isAbort(e)) setExportMsg('Export cancelled.');
      else setExportErr(errText(e));
    } finally {
      abortRef.current = null;
      setExporting(false);
    }
  };

  const share = async () => {
    if (!result) return;
    setExportErr('');
    try {
      const r = await shareOrSaveVideo(result, fileName, `${title}\n${location.origin}/t/${song.slug}/`);
      setExportMsg(r === 'shared' ? 'Shared.' : r === 'downloaded' ? 'Saved to your downloads.' : '');
    } catch (e) {
      setExportErr(errText(e));
    }
  };
  const save = () => {
    if (!result) return;
    try {
      saveVideo(result, fileName);
      setExportMsg('Saved to your downloads.');
    } catch (e) {
      setExportErr(errText(e));
    }
  };

  const stripUr = script === 'ur';
  const tplMoods = MOODS.filter((m) => templatesForMood(m).length > 0);

  return (
    <div class="studio">
      <header class="studio__top">
        <IconButton icon="arrow-left" label="Back" onClick={goBack} />
        <div class="studio__title">
          <span>{title || 'Reel Studio'}</span>
          {song.title_ro && song.title_ur && <span lang="ur">{song.title_ur}</span>}
        </div>
        <Button size="sm" icon="video" onClick={openExport}>Export</Button>
      </header>

      <div class="studio__body">
        <div class="studio__main">
          <div class="studio__stage">
            <div class="studio__frame" style={{ '--ar': `${dims.w} / ${dims.h}`, '--ar-n': String(dims.w / dims.h) }}>
              <canvas ref={canvasRef} class="studio__canvas" width={dims.w} height={dims.h}
                onClick={togglePlay} role="img" aria-label="Video preview. Tap to play or pause." />
              {!playing && <span class="studio__big-play"><Icon name="play" /></span>}
            </div>
          </div>

          <div class="studio__transport">
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} variant="primary" onClick={togglePlay} />
            <input class="seek" type="range" min={0} max={Math.max(1, clip.duration)} step={10} value={now}
              aria-label="Seek" style={{ '--pct': `${pct}%` }}
              onInput={(e) => seek(Number((e.target as HTMLInputElement).value))} />
            <span class="studio__time">{formatTime(now)} / {formatTime(clip.duration)}</span>
          </div>

          <div class="studio__strip" ref={stripRef} aria-label="Clip timeline">
            {clip.lines.map((l, i) => {
              const text = stripUr ? (l.ur || l.ro) : (l.ro || l.ur);
              return (
                <button type="button" key={`${l.key}-${i}`} class={`studio__clip interactive${i === activeIdx ? ' is-active' : ''}`}
                  style={{ width: `${Math.max(56, (l.end - l.start) * PX_PER_MS)}px` }}
                  aria-current={i === activeIdx ? 'true' : undefined} onClick={() => seek(l.start)}>
                  <span lang={stripUr && l.ur ? 'ur' : undefined}>{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div class="studio__tools">
          <section class="studio__panel" aria-label={TOOLS.find((t) => t.key === tool)?.label}>
            {tool === 'templates' && (
              <div class="studio__section">
                <div class="studio__scroll">
                  <Chip selected={tplMood === 'rec'} onClick={() => setTplMood('rec')}>For this song</Chip>
                  {tplMoods.map((m) => (
                    <Chip key={m} selected={tplMood === m} onClick={() => setTplMood(m)}>{MOOD_LABELS[m].ro}</Chip>
                  ))}
                </div>
                <div class="studio__thumbs">
                  {shownTemplates.map((t) => (
                    <button type="button" key={t.id} class={`studio__thumb interactive${t.id === templateId ? ' is-selected' : ''}`}
                      aria-pressed={t.id === templateId ? 'true' : 'false'} onClick={() => selectTemplate(t)}>
                      <canvas width={THUMB_W} height={THUMB_H}
                        ref={(el) => { if (el) thumbCanvases.current.set(t.id, el); else thumbCanvases.current.delete(t.id); }} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
                {shownTemplates.length === 0 && <p class="studio__note">No templates for this mood yet.</p>}
              </div>
            )}

            {tool === 'lines' && (
              <div class="studio__section">
                <p class="studio__note">
                  Clip length {formatTime(clip.duration)} · {clip.synced ? 'Synced to the recording' : 'Timed evenly'}
                </p>
                {clip.duration > MAX_CLIP_MS && <p class="studio__warn">This clip is longer than {Math.round(MAX_CLIP_MS / 1000)} seconds.</p>}
                {notice && <p class="studio__warn" role="status">{notice}</p>}
                {flat.length === 0 && <p class="studio__note">This song has no lines to make a video from.</p>}
                <div class="studio__lines">
                  {flat.map((l, i) => {
                    const inRange = i >= from && i <= to;
                    return (
                      <button type="button" key={`${l.key}-${i}`} class={`studio__line interactive${inRange ? ' is-in' : ''}`}
                        aria-pressed={inRange ? 'true' : 'false'} onClick={() => tapLine(i)}>
                        {l.ro && <span>{l.ro}</span>}
                        {l.ur && <span lang="ur">{l.ur}</span>}
                      </button>
                    );
                  })}
                </div>
                <div class="studio__actions">
                  <Button variant="secondary" size="sm" icon="reset" onClick={resetRange}>Reset</Button>
                </div>
                {audioUrl && (
                  <label class="studio__check">
                    <input type="checkbox" checked={useAudio} onChange={(e) => setUseAudio((e.target as HTMLInputElement).checked)} />
                    Include audio
                  </label>
                )}
                {!clip.synced && (
                  <div class="studio__slider">
                    <div class="studio__slider-head">
                      <span>Seconds per line</span>
                      <span class="studio__value">{secPerLine.toFixed(1)} s</span>
                    </div>
                    <input class="seek" type="range" min={2} max={6} step={0.5} value={secPerLine} aria-label="Seconds per line"
                      style={{ '--pct': `${((secPerLine - 2) / 4) * 100}%` }}
                      onInput={(e) => setSecPerLine(Number((e.target as HTMLInputElement).value))} />
                  </div>
                )}
              </div>
            )}

            {tool === 'text' && (
              <div class="studio__section">
                {bilingual && (
                  <div class="studio__field">
                    <span class="studio__field-label">Script</span>
                    <div class="segmented studio__seg" role="group" aria-label="Script">
                      {seg(script === 'ur', <span class="ur-label" lang="ur">اردو</span>, () => setScript('ur'))}
                      {seg(script === 'both', 'Both', () => setScript('both'))}
                      {seg(script === 'ro', 'Roman', () => setScript('ro'))}
                    </div>
                  </div>
                )}
                <div class="studio__field">
                  <span class="studio__field-label">Font Style</span>
                  <div class="segmented studio__seg" role="group" aria-label="Font Style">
                    {seg(fontStyle === 'default', 'Standard', () => setFontStyle('default'))}
                    {seg(fontStyle === 'serif', 'Serif', () => setFontStyle('serif'))}
                    {seg(fontStyle === 'sans', 'Sans', () => setFontStyle('sans'))}
                    {seg(fontStyle === 'nastaliq', 'Nastaliq', () => setFontStyle('nastaliq'))}
                    {seg(fontStyle === 'mono', 'Mono', () => setFontStyle('mono'))}
                  </div>
                </div>
                <div class="studio__field">
                  <span class="studio__field-label">Text Animation</span>
                  <div class="segmented studio__seg" role="group" aria-label="Text Animation">
                    {seg(animOverride === 'default', 'Default', () => setAnimOverride('default'))}
                    {seg(animOverride === 'word-karaoke', 'Karaoke', () => setAnimOverride('word-karaoke'))}
                    {seg(animOverride === 'word-rise', 'Word Rise', () => setAnimOverride('word-rise'))}
                    {seg(animOverride === 'drift', 'Drift', () => setAnimOverride('drift'))}
                    {seg(animOverride === 'fade', 'Fade', () => setAnimOverride('fade'))}
                    {seg(animOverride === 'rise', 'Rise', () => setAnimOverride('rise'))}
                  </div>
                </div>
                <div class="studio__field">
                  <span class="studio__field-label">Word Splitting</span>
                  <div class="segmented studio__seg" role="group" aria-label="Word Splitting">
                    {seg(wordSplit === 'full', 'Full Line', () => setWordSplit('full'))}
                    {seg(wordSplit === 'chunk2', '2 Words', () => setWordSplit('chunk2'))}
                    {seg(wordSplit === 'chunk3', '3-4 Words', () => setWordSplit('chunk3'))}
                  </div>
                </div>
                <div class="studio__slider">
                  <div class="studio__slider-head">
                    <span>Text size</span>
                    <span class="studio__value">{Math.round(textScale * 100)}%</span>
                  </div>
                  <input class="seek" type="range" min={0.4} max={1.4} step={0.05} value={textScale} aria-label="Text size"
                    style={{ '--pct': `${((textScale - 0.4) / 1.0) * 100}%` }}
                    onInput={(e) => setTextScale(Number((e.target as HTMLInputElement).value))} />
                </div>
                <div class="segmented studio__seg" role="group" aria-label="Text position">
                  {POSITIONS.map((p) => seg(position === p.key, p.label, () => setPosition(p.key)))}
                </div>
                <label class="studio__check">
                  <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle((e.target as HTMLInputElement).checked)} />
                  Show title
                </label>
                <label class="studio__check">
                  <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand((e.target as HTMLInputElement).checked)} />
                  Show Taraney watermark
                </label>
                <label class="studio__check">
                  <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress((e.target as HTMLInputElement).checked)} />
                  Show progress bar
                </label>
              </div>
            )}

            {tool === 'background' && (
              <div class="studio__section">
                <input ref={fileRef} type="file" accept="video/*,image/*" hidden
                  onChange={(e) => onMedia(e.currentTarget as HTMLInputElement)} />
                <div class="studio__actions">
                  <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
                    {image && !selectedStockId ? 'Replace custom media' : 'Upload custom video/photo'}
                  </Button>
                  {image && <Button variant="text" onClick={removeMedia}>Use canvas artwork</Button>}
                </div>

                <div class="studio__field">
                  <span class="studio__field-label">Curated Background Videos</span>
                  <div class="studio__stock-list">
                    {STOCK_VIDEOS.map((v) => (
                      <button type="button" key={v.id}
                        class={`studio__stock-item interactive${selectedStockId === v.id ? ' is-selected' : ''}`}
                        aria-pressed={selectedStockId === v.id ? 'true' : 'false'}
                        onClick={() => applyStockVideo(v)}>
                        <span class="studio__stock-tag">{v.category}</span>
                        <span class="studio__stock-title">{v.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {image && (
                  <div class="studio__slider">
                    <div class="studio__slider-head">
                      <span>{isVideoMedia ? 'Darken video' : 'Darken photo'}</span>
                      <span class="studio__value">{Math.round(imageDim * 100)}%</span>
                    </div>
                    <input class="seek" type="range" min={0} max={0.8} step={0.05} value={imageDim}
                      aria-label={isVideoMedia ? 'Darken video' : 'Darken photo'}
                      style={{ '--pct': `${(imageDim / 0.8) * 100}%` }}
                      onInput={(e) => setImageDim(Number((e.target as HTMLInputElement).value))} />
                  </div>
                )}
                <p class="studio__note">Curated videos stream from Cloudflare R2 and loop seamlessly behind your lyrics.</p>
              </div>
            )}

            {tool === 'format' && (
              <div class="studio__section">
                <div class="studio__formats">
                  {(Object.keys(FORMATS) as FormatKey[]).map((f) => (
                    <button type="button" key={f} class={`studio__format interactive${format === f ? ' is-selected' : ''}`}
                      aria-pressed={format === f ? 'true' : 'false'} onClick={() => setFormat(f)}>
                      <span class="studio__format-shape" style={{ width: `${SHAPE[f][0]}px`, height: `${SHAPE[f][1]}px` }} />
                      <span>{FORMATS[f].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <nav class="studio__tabs" role="tablist" aria-label="Tools">
            {TOOLS.map((t) => (
              <button type="button" key={t.key} role="tab" class="studio__tab interactive"
                aria-selected={tool === t.key ? 'true' : 'false'} onClick={() => setTool(t.key)}>
                <span class="studio__tab-icon"><Icon name={t.icon} /></span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {exportOpen && (
        <Sheet title="Export video" onClose={closeExport}>
          {!canExport() ? (
            <p class="studio__note">This browser cannot record video. Try Chrome, Edge or Safari.</p>
          ) : result && resultUrl ? (
            <div class="studio__section">
              <video class="studio__export-video" src={resultUrl} controls playsinline />
              {result.ext === 'webm' && (
                <p class="studio__note">Saved as WebM. If an app rejects it, try exporting from Chrome on Android or Safari for MP4.</p>
              )}
              <div class="studio__actions">
                <Button variant="secondary" icon="download" onClick={save}>Save</Button>
                <Button icon="share" onClick={share}>Share</Button>
              </div>
            </div>
          ) : (
            <div class="studio__section">
              <div class="chip-row">
                <Chip selected={quality === 'hd'} onClick={() => setQuality('hd')}>HD 1080</Chip>
                <Chip selected={quality === 'fast'} onClick={() => setQuality('fast')}>Fast 720</Chip>
              </div>
              <p class="studio__note">Recording takes as long as the clip ({formatTime(clip.duration)}). Keep this tab open.</p>
              {exporting ? (
                <div class="studio__progress">
                  <Progress value={progress} label="Export progress" />
                  <span>{Math.round(progress * 100)}%</span>
                  <div class="studio__actions">
                    <Button variant="secondary" onClick={() => abortRef.current?.abort()}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button icon="video" block disabled={clip.lines.length === 0} onClick={runExport}>Create video</Button>
              )}
            </div>
          )}
          {exportMsg && <p class="t-body-sm c-variant" role="status">{exportMsg}</p>}
          {exportErr && <p class="studio__warn" role="alert">{exportErr}</p>}
        </Sheet>
      )}
    </div>
  );
}
