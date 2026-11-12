// Reel Studio contract. Every studio module (templates, backgrounds, render, clip, export, UI)
// imports its shared types from here. All times are milliseconds.
import type { Mood } from '../lib/mood';

export type Script = 'ur' | 'ro' | 'both';

export const FORMATS = {
  reel: { w: 1080, h: 1920, label: 'Reel 9:16' },
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  wide: { w: 1920, h: 1080, label: 'Wide 16:9' },
} as const;
export type FormatKey = keyof typeof FORMATS;

/** One lyric line inside the clip. start/end are relative to the clip start (0 = first frame). */
export interface StudioLine { key: string; ur: string; ro: string; start: number; end: number }

/** A line of the whole song in sung order. start/end are absolute positions in the recording, or null when unsynced. */
export interface FlatLine { key: string; occ: number; line: number; ur: string; ro: string; start: number | null; end: number | null }

export interface Clip { lines: StudioLine[]; duration: number; audioStartMs: number; synced: boolean }

export type BgKind = 'aurora' | 'stars' | 'rain' | 'rays' | 'bokeh' | 'paper' | 'pattern' | 'embers' | 'clouds' | 'plain';
/** focus: one line at a time. couplet: current line + its partner. scroll: karaoke list, active line centred. stack: lines of a couplet appear one by one and stay. */
export type TextLayout = 'focus' | 'couplet' | 'scroll' | 'stack';
export type TextAnim = 'fade' | 'rise' | 'zoom' | 'blur' | 'wipe';
export type FrameKind = 'none' | 'border' | 'corners' | 'bar';

export interface Template {
  id: string;
  name: string;
  mood: Mood;
  /** Theme keys from src/lib/taxonomy.ts THEMES this template suits (used for "recommended"). */
  themes: string[];
  bg: BgKind;
  /** [deep, mid, light] hex colours (#RRGGBB) for the background painter. */
  colors: [string, string, string];
  /** Active lyric colour, accent (dividers, progress, brand) and inactive lyric colour. CSS colour strings. */
  text: string;
  accent: string;
  dim: string;
  layout: TextLayout;
  anim: TextAnim;
  frame: FrameKind;
}

export type TextPosition = 'top' | 'center' | 'bottom';

export interface Project {
  template: Template;
  format: FormatKey;
  script: Script;
  lines: StudioLine[];
  duration: number;
  /** Song title (Roman or Urdu) and a small subtitle such as the poet or singer. */
  title: string;
  subtitle: string;
  showTitle: boolean;
  showBrand: boolean;
  showProgress: boolean;
  /** 0.7 to 1.4, multiplies lyric font sizes. */
  textScale: number;
  position: TextPosition;
  /** Optional user photo that replaces the painted background (drawn cover-fit, then darkened by imageDim 0..1). */
  image: CanvasImageSource | null;
  imageDim: number;
  /** Stable seed (song id) so particles and angles are deterministic. */
  seed: string;
}

export interface ExportResult { blob: Blob; ext: 'mp4' | 'webm'; mime: string }
