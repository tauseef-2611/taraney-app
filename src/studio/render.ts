// Reel Studio frame renderer. drawFrame is a pure function of (project, clip time) so the preview
// and the exporter draw identical frames. Font loading and text measurement follow share-card.ts.
import { FORMATS, type FontStyle, type FormatKey, type FrameKind, type Project, type Script, type StudioLine, type TextAnim, type TextPosition } from './types';
import { paintBackground } from './backgrounds';

export const FONTS: Record<FontStyle, { ur: string; ro: string; label: string }> = {
  default: {
    ur: "'Gulzar', 'Noto Nastaliq Urdu', serif",
    ro: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
    label: 'Standard',
  },
  serif: {
    ur: "'Gulzar', 'Noto Nastaliq Urdu', serif",
    ro: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    label: 'Cinematic Serif',
  },
  sans: {
    ur: "'Gulzar', 'Noto Sans Arabic', system-ui, sans-serif",
    ro: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
    label: 'Modern Sans',
  },
  nastaliq: {
    ur: "'Gulzar', 'Noto Nastaliq Urdu', serif",
    ro: "'Cormorant Garamond', Georgia, serif",
    label: 'Pure Nastaliq',
  },
  mono: {
    ur: "'Gulzar', 'Noto Nastaliq Urdu', monospace",
    ro: "'Courier Prime', 'Courier New', monospace",
    label: 'Typewriter Mono',
  },
};

const URDU = FONTS.default.ur;
const SANS = FONTS.default.ro;
const FORMAT_FACTOR: Record<FormatKey, number> = { reel: 1, square: 0.85, wide: 0.8 };
const ANCHOR: Record<TextPosition, number> = { top: 0.3, center: 0.47, bottom: 0.66 };
const TEXT_W = 0.82; // lyric block width: canvas width minus 2 x 0.09w padding
const MIN_SHRINK = 0.86; // long lines shrink to this share of their size before wrapping
const URDU_RE = /[؀-ۿ]/;
const BRAND_UR = 'ترانے';
const CACHE_LIMIT = 5000;

/** Loads the canvas fonts so the first frames are not drawn with fallbacks. */
export async function ensureStudioFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (!document.getElementById('studio-google-fonts')) {
    const link = document.createElement('link');
    link.id = 'studio-google-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Noto+Nastaliq+Urdu:wght@400;600&family=Playfair+Display:ital,wght@0,500;1,400&family=Courier+Prime:ital,wght@0,400;0,700&display=swap';
    document.head.appendChild(link);
  }
  await Promise.all([
    document.fonts.load(`400 64px ${URDU}`, 'ترانے عزم'),
    document.fonts.load(`600 32px ${SANS}`, 'Taraney'),
    document.fonts.load(`400 32px ${SANS}`, 'Taraney'),
    document.fonts.load(`400 36px 'Cormorant Garamond', Georgia, serif`, 'Taraney Roman'),
  ]).catch(() => {});
}

// ---------- measurement caches (module level, shared by every frame) ----------

const measureCache = new Map<string, number>();
const wrapCache = new Map<string, string[]>();

function measureW(g: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}\u0001${text}`;
  let v = measureCache.get(key);
  if (v === undefined) {
    g.font = font;
    v = g.measureText(text).width;
    if (measureCache.size > CACHE_LIMIT) measureCache.clear();
    measureCache.set(key, v);
  }
  return v;
}

/** Word-wraps text to the width (same approach as share-card wrap). Cached by (font, width, text). */
function wrapText(g: CanvasRenderingContext2D, text: string, font: string, width: number): string[] {
  const key = `${font}\u0001${width}\u0001${text}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  let out: string[];
  if (measureW(g, font, text) <= width) out = [text];
  else {
    out = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (measureW(g, font, next) > width && cur) { out.push(cur); cur = word; } else cur = next;
    }
    if (cur) out.push(cur);
  }
  if (wrapCache.size > CACHE_LIMIT) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}

/** Truncates with an ellipsis so the text fits the width. */
function fitText(g: CanvasRenderingContext2D, text: string, font: string, maxW: number): string {
  if (measureW(g, font, text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && measureW(g, font, `${s}…`) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// ---------- small helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
/** Enter progress for a line that starts at `start` (450 ms). */
const enterE = (t: number, start: number) => easeOutCubic(clamp01((t - start) / 450));
/** Exit alpha: fades over the 300 ms before `boundary`. */
const exitAlpha = (t: number, boundary: number) => clamp01((boundary - t) / 300);

function resetState(g: CanvasRenderingContext2D): void {
  g.globalAlpha = 1;
  g.direction = 'ltr';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetX = 0;
  g.shadowOffsetY = 0;
}

function setShadow(g: CanvasRenderingContext2D, on: boolean, blur: number, color = 'rgba(0,0,0,0.35)'): void {
  g.shadowColor = on ? color : 'rgba(0,0,0,0)';
  g.shadowBlur = on ? blur : 0;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Active line index: the last line (in array order) whose start <= t, or -1. */
export function activeIndex(lines: StudioLine[], t: number): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].start <= t) return i;
  }
  return -1;
}

// ---------- lyric segments and layout ----------

/** One text run of a lyric line: Urdu (rtl) or Roman (ltr). base is the size before shrinking. */
interface Seg { ur: boolean; text: string; base: number; weight: number }
interface LaidSeg { ur: boolean; font: string; lh: number; lines: string[]; top: number; h: number }
/** A laid-out lyric line: its runs stacked top to bottom. dividerAt is set when both scripts show. */
interface Laid { segs: LaidSeg[]; h: number; dividerAt: number | null }

interface Piece {
  laid: Laid;
  cy: number;
  color: string;
  alpha: number;
  anim: TextAnim;
  e: number;
  sc: number;
  dy: number;
  divider: boolean;
  lineStart: number;
  lineEnd: number;
  t: number;
}
interface Plan { pieces: Piece[]; topY: number }
interface Ctx { g: CanvasRenderingContext2D; p: Project; t: number; w: number; h: number; k: number; maxW: number; cy: number }

const fontOf = (sg: { ur: boolean; weight: number }, size: number, fontStyle: FontStyle = 'default') => {
  const pair = FONTS[fontStyle] ?? FONTS.default;
  return sg.ur ? `400 ${size}px ${pair.ur}` : `${sg.weight} ${size}px ${pair.ro}`;
};

/** Picks which script runs to show for a line, falling back to the other script when one is empty. */
function segsFor(line: StudioLine, script: Script, k: number): Seg[] {
  let ur = '';
  let ro = '';
  if (script === 'ur') {
    if (line.ur.trim()) ur = line.ur.trim();
    else ro = line.ro.trim();
  } else if (script === 'ro') {
    if (line.ro.trim()) ro = line.ro.trim();
    else ur = line.ur.trim();
  } else {
    ur = line.ur.trim();
    ro = line.ro.trim();
  }
  const both = ur !== '' && ro !== '';
  const segs: Seg[] = [];
  if (ur) segs.push({ ur: true, text: ur, base: 100 * k, weight: 400 });
  if (ro) segs.push({ ur: false, text: ro, base: (both ? 48 : 68) * k, weight: both ? 400 : 600 });
  return segs;
}

/** One shared shrink factor (1 down to 0.7) so every line in the group fits; wrapping happens at 0.7. */
function pickScale(g: CanvasRenderingContext2D, group: Seg[][], maxW: number, fontStyle: FontStyle = 'default'): number {
  const fits = (s: number) =>
    group.every((segs) => segs.every((sg) => measureW(g, fontOf(sg, Math.round(sg.base * s), fontStyle), sg.text) <= maxW));
  if (fits(1)) return 1;
  for (let s = 0.98; s > MIN_SHRINK + 1e-6; s -= 0.02) {
    if (fits(s)) return s;
  }
  return MIN_SHRINK;
}

function buildLaid(g: CanvasRenderingContext2D, segs: Seg[], s: number, maxW: number, k: number, fontStyle: FontStyle = 'default'): Laid {
  const gap = segs.length > 1 ? Math.round(36 * k * s) : 0;
  const out: LaidSeg[] = [];
  let top = 0;
  for (const sg of segs) {
    const size = Math.round(sg.base * s);
    const font = fontOf(sg, size, fontStyle);
    const lh = sg.ur ? size * 2.1 : size * 1.5;
    const lines = wrapText(g, sg.text, font, maxW);
    out.push({ ur: sg.ur, font, lh, lines, top, h: lines.length * lh });
    top += lines.length * lh + gap;
  }
  const h = segs.length ? top - gap : 0;
  const first = out[0];
  return { segs: out, h, dividerAt: gap && first ? first.h + gap / 2 : null };
}

function layoutLines(g: CanvasRenderingContext2D, group: Seg[][], maxW: number, k: number, fontStyle: FontStyle = 'default'): Laid[] {
  const s = pickScale(g, group, maxW, fontStyle);
  return group.map((segs) => buildLaid(g, segs, s, maxW, k, fontStyle));
}

function layoutLine(g: CanvasRenderingContext2D, segs: Seg[], maxW: number, k: number, fontStyle: FontStyle = 'default'): Laid {
  return buildLaid(g, segs, pickScale(g, [segs], maxW, fontStyle), maxW, k, fontStyle);
}

// ---------- layouts ----------

/** focus: one line, animated in on its start and out before the next line. */
function planFocus(c: Ctx, i: number): Plan {
  const { p, t } = c;
  const fontStyle = p.fontStyle || p.template.fontStyle || 'default';
  const anim = p.animOverride || p.template.anim;
  const line: StudioLine | undefined = p.lines[i];
  const next: StudioLine | undefined = p.lines[i + 1];
  if (!line) return { pieces: [], topY: c.cy };
  const boundary = next ? Math.min(next.start, line.end) : line.end;
  const alpha = exitAlpha(t, boundary);
  if (alpha <= 0) return { pieces: [], topY: c.cy };
  const laid = layoutLine(c.g, segsFor(line, p.script, c.k), c.maxW, c.k, fontStyle);
  return {
    pieces: [{
      laid, cy: c.cy, color: p.template.text, alpha, anim,
      e: enterE(t, line.start), sc: 1, dy: 0, divider: laid.dividerAt !== null,
      lineStart: line.start, lineEnd: boundary, t,
    }],
    topY: c.cy - laid.h / 2,
  };
}

/** couplet: the active pair, both lines shown. stack: the second line appears at its own start and stays. */
function planPairs(c: Ctx, i: number, stack: boolean): Plan {
  const { p, t } = c;
  const fontStyle = p.fontStyle || p.template.fontStyle || 'default';
  const anim = p.animOverride || p.template.anim;
  const { text, dim } = p.template;
  const lines = p.lines;
  const a0 = Math.floor(i / 2) * 2;
  const a: StudioLine | undefined = lines[a0];
  const b: StudioLine | undefined = lines[a0 + 1];
  const nextPair: StudioLine | undefined = lines[a0 + 2];
  if (!a) return { pieces: [], topY: c.cy };
  const pairEnd = (b ?? a).end;
  const boundary = nextPair ? Math.min(nextPair.start, pairEnd) : pairEnd;
  const alpha = exitAlpha(t, boundary);
  if (alpha <= 0) return { pieces: [], topY: c.cy };

  const group: Seg[][] = [segsFor(a, p.script, c.k)];
  if (b) group.push(segsFor(b, p.script, c.k));
  const laid = layoutLines(c.g, group, c.maxW, c.k, fontStyle);
  const gap = Math.round(36 * c.k);
  const total = laid.reduce((s, l) => s + l.h, 0) + gap * (laid.length - 1);
  let top = c.cy - total / 2;
  const topY = top;

  const pieces: Piece[] = [];
  laid.forEach((l, j) => {
    const line = j === 0 ? a : b;
    const cy = top + l.h / 2;
    top += l.h + gap;
    if (!line) return;
    if (stack && j === 1 && t < line.start) return; // reserved space, drawn once it starts
    const idx = a0 + j;
    const color = stack
      ? (j === 0 && i === a0 + 1 ? dim : text)
      : (idx === i ? text : dim);
    pieces.push({
      laid: l, cy, color, alpha, anim,
      e: enterE(t, stack && j === 1 ? line.start : a.start),
      sc: 1, dy: 0, divider: false,
      lineStart: line.start, lineEnd: boundary, t,
    });
  });
  return { pieces, topY };
}

/** scroll: karaoke list. Active line centred at the anchor, the list eases between lines. */
function planScroll(c: Ctx, i: number): Plan {
  const { p, t } = c;
  const fontStyle = p.fontStyle || p.template.fontStyle || 'default';
  const lines = p.lines;
  const laid = lines.map((l) => layoutLine(c.g, segsFor(l, p.script, c.k), c.maxW, c.k, fontStyle));
  const gap = Math.round(36 * c.k);
  const centres: number[] = [];
  let y = 0;
  for (const l of laid) {
    centres.push(y + l.h / 2);
    y += l.h + gap;
  }
  const target = (j: number) => c.cy - (centres[j] ?? 0);
  let offset = target(0);
  const cur: StudioLine | undefined = lines[i];
  if (i >= 0 && cur) {
    const from = target(Math.max(i - 1, 0));
    const e = easeOutCubic(clamp01((t - cur.start) / 400));
    offset = from + (target(i) - from) * e;
  }

  const { text, dim } = p.template;
  const pieces: Piece[] = [];
  laid.forEach((l, j) => {
    const cyAbs = (centres[j] ?? 0) + offset;
    const d = Math.abs(cyAbs - c.cy);
    const alpha = clamp01(1 - d / (0.32 * c.h));
    if (alpha <= 0.01) return;
    const active = j === i;
    pieces.push({
      laid: l, cy: cyAbs, color: active ? text : dim, alpha, anim: 'fade',
      e: 1, sc: active ? 1 : 0.72, dy: 0, divider: false,
      lineStart: cur?.start ?? 0, lineEnd: cur?.end ?? 0, t,
    });
  });
  const act = Math.max(i, 0);
  const actLaid = laid[act];
  const topY = (centres[act] ?? 0) + offset - (actLaid ? actLaid.h / 2 : 0);
  return { pieces, topY };
}

function planLyrics(c: Ctx): Plan {
  const { p, t } = c;
  if (!p.lines.length) return { pieces: [], topY: c.cy };
  const layout = p.template.layout;
  if (layout === 'scroll') return planScroll(c, activeIndex(p.lines, t));
  const i = activeIndex(p.lines, t);
  if (i < 0) return { pieces: [], topY: c.cy };
  if (layout === 'focus') return planFocus(c, i);
  return planPairs(c, i, layout === 'stack');
}

// ---------- drawing ----------

function drawPiece(g: CanvasRenderingContext2D, pc: Piece, w: number, u: number, dark: boolean, accent: string, textW: number): void {
  const e = pc.e;
  let alpha = pc.alpha;
  let dy = pc.dy;
  let sc = pc.sc;
  if (pc.anim === 'fade' || pc.anim === 'blur') {
    alpha *= e;
  } else if (pc.anim === 'rise') {
    alpha *= e;
    dy += (1 - e) * 40 * u;
  } else if (pc.anim === 'zoom') {
    alpha *= e;
    sc *= 0.92 + 0.08 * e;
  } else if (pc.anim === 'drift') {
    alpha *= e;
    const dur = Math.max(1000, pc.lineEnd - pc.lineStart);
    const progress = clamp01((pc.t - pc.lineStart) / dur);
    dy += Math.sin(progress * Math.PI) * (-12 * u);
  }
  if (alpha <= 0.001) return;

  const top = pc.cy - pc.laid.h / 2;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  g.translate(w / 2, pc.cy + dy);
  g.scale(sc, sc);
  g.translate(-w / 2, -pc.cy);

  if (pc.divider && pc.laid.dividerAt !== null) {
    g.save();
    setShadow(g, false, 0);
    g.fillStyle = accent;
    g.fillRect(w / 2 - 36 * u, top + pc.laid.dividerAt - 1.5 * u, 72 * u, 3 * u);
    g.restore();
  }

  const isWordAnim = pc.anim === 'word-karaoke' || pc.anim === 'word-rise';

  for (const seg of pc.laid.segs) {
    const y = top + seg.top;
    g.save();
    if (pc.anim === 'wipe' && e < 1) {
      // Urdu reveals right to left, Roman left to right.
      const x = seg.ur ? w / 2 + textW / 2 - e * textW : w / 2 - textW / 2;
      g.beginPath();
      g.rect(x, y - seg.lh / 2, e * textW, seg.h + seg.lh);
      g.clip();
    }
    if (pc.anim === 'blur' && e < 1) setShadow(g, true, 36 * u * (1 - e), accent);
    else setShadow(g, dark, 24 * u);
    g.direction = seg.ur ? 'rtl' : 'ltr';
    g.font = seg.font;
    g.textBaseline = 'middle';

    if (!isWordAnim) {
      g.fillStyle = pc.color;
      g.textAlign = 'center';
      seg.lines.forEach((ln, j) => g.fillText(ln, w / 2, y + j * seg.lh + seg.lh / 2));
    } else {
      const dur = Math.max(1000, pc.lineEnd - pc.lineStart);
      const allWords = seg.lines.flatMap((ln) => ln.split(' ').filter(Boolean));
      const totalWords = Math.max(1, allWords.length);
      let wordCounter = 0;
      const spaceW = measureW(g, seg.font, ' ');

      seg.lines.forEach((ln, j) => {
        const lineWords = ln.split(' ').filter(Boolean);
        if (!lineWords.length) return;
        const lineY = y + j * seg.lh + seg.lh / 2;
        const wordWidths = lineWords.map((wd) => measureW(g, seg.font, wd));
        const totalLineWidth = wordWidths.reduce((a, b) => a + b, 0) + (lineWords.length - 1) * spaceW;

        if (seg.ur) {
          let curX = w / 2 + totalLineWidth / 2;
          g.textAlign = 'right';

          lineWords.forEach((word, wi) => {
            const wIdx = wordCounter++;
            const wordCue = pc.lineStart + (wIdx / totalWords) * dur * 0.85;
            const wordW = wordWidths[wi];

            if (pc.anim === 'word-karaoke') {
              const active = pc.t >= wordCue;
              g.save();
              g.fillStyle = active ? pc.color : 'rgba(255,255,255,0.32)';
              if (active) setShadow(g, true, 28 * u, accent);
              g.fillText(word, curX, lineY);
              g.restore();
            } else if (pc.anim === 'word-rise') {
              const wE = easeOutCubic(clamp01((pc.t - wordCue) / 300));
              if (wE > 0.01) {
                g.save();
                g.globalAlpha = Math.min(1, alpha * wE);
                const wDy = (1 - wE) * 20 * u;
                g.fillStyle = pc.color;
                g.fillText(word, curX, lineY + wDy);
                g.restore();
              }
            }
            curX -= (wordW + spaceW);
          });
        } else {
          let curX = w / 2 - totalLineWidth / 2;
          g.textAlign = 'left';

          lineWords.forEach((word, wi) => {
            const wIdx = wordCounter++;
            const wordCue = pc.lineStart + (wIdx / totalWords) * dur * 0.85;
            const wordW = wordWidths[wi];

            if (pc.anim === 'word-karaoke') {
              const active = pc.t >= wordCue;
              g.save();
              g.fillStyle = active ? pc.color : 'rgba(255,255,255,0.32)';
              if (active) setShadow(g, true, 28 * u, accent);
              g.fillText(word, curX, lineY);
              g.restore();
            } else if (pc.anim === 'word-rise') {
              const wE = easeOutCubic(clamp01((pc.t - wordCue) / 300));
              if (wE > 0.01) {
                g.save();
                g.globalAlpha = Math.min(1, alpha * wE);
                const wDy = (1 - wE) * 20 * u;
                g.fillStyle = pc.color;
                g.fillText(word, curX, lineY + wDy);
                g.restore();
              }
            }
            curX += (wordW + spaceW);
          });
        }
      });
    }

    g.restore();
  }
  g.restore();
}

function drawDeco(g: CanvasRenderingContext2D, frame: FrameKind, w: number, h: number, u: number, topY: number, accent: string): void {
  if (frame === 'none') return;
  g.save();
  g.globalAlpha = 0.6;
  g.strokeStyle = accent;
  g.fillStyle = accent;
  g.lineCap = 'round';
  if (frame === 'border') {
    g.lineWidth = 3 * u;
    rr(g, 40 * u, 40 * u, w - 80 * u, h - 80 * u, 28 * u);
    g.stroke();
  } else if (frame === 'corners') {
    g.lineWidth = 4 * u;
    const x0 = 48 * u, y0 = 48 * u, x1 = w - 48 * u, y1 = h - 48 * u, a = 90 * u;
    g.beginPath();
    g.moveTo(x0, y0 + a); g.lineTo(x0, y0); g.lineTo(x0 + a, y0);
    g.moveTo(x1 - a, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + a);
    g.moveTo(x1, y1 - a); g.lineTo(x1, y1); g.lineTo(x1 - a, y1);
    g.moveTo(x0 + a, y1); g.lineTo(x0, y1); g.lineTo(x0, y1 - a);
    g.stroke();
  } else if (frame === 'bar') {
    rr(g, w / 2 - 60 * u, topY - 56 * u, 120 * u, 4 * u, 2 * u);
    g.fill();
  }
  g.restore();
}

function drawLabel(g: CanvasRenderingContext2D, text: string, ur: boolean, size: number, weight: number, y: number, maxW: number, w: number, fontStyle: FontStyle = 'default'): void {
  const pair = FONTS[fontStyle] ?? FONTS.default;
  const font = ur ? `400 ${size}px ${pair.ur}` : `${weight} ${size}px ${pair.ro}`;
  const shown = fitText(g, text, font, maxW);
  g.direction = ur ? 'rtl' : 'ltr';
  g.font = font;
  g.fillText(shown, w / 2, y);
}

function drawTitle(g: CanvasRenderingContext2D, p: Project, w: number, h: number, u: number, dark: boolean): void {
  const fontStyle = p.fontStyle || p.template.fontStyle || 'default';
  const maxW = w * 0.8;
  const title = p.title.trim();
  const sub = p.subtitle.trim();
  let y = h * (p.position === 'top' ? 0.86 : 0.085);
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = p.template.text;
  setShadow(g, dark, 12 * u);
  if (title) {
    const ur = URDU_RE.test(title);
    drawLabel(g, title, ur, ur ? 50 * u : 40 * u, 600, y, maxW, w, fontStyle);
    y += ur ? 60 * u : 46 * u;
  }
  if (sub) {
    g.globalAlpha = 0.75;
    drawLabel(g, sub, URDU_RE.test(sub), 28 * u, 400, y, maxW, w, fontStyle);
  }
  g.restore();
}

function drawBrand(g: CanvasRenderingContext2D, p: Project, w: number, h: number, u: number, dark: boolean): void {
  const fontStyle = p.fontStyle || p.template.fontStyle || 'default';
  const pair = FONTS[fontStyle] ?? FONTS.default;
  const fs = 30 * u;
  const urduFont = `400 ${Math.round(fs * 1.25)}px ${pair.ur}`;
  const sansFont = `600 ${fs}px ${pair.ro}`;
  const y = h - 0.05 * h;
  g.save();
  g.direction = 'rtl';
  const urW = measureW(g, urduFont, BRAND_UR);
  g.direction = 'ltr';
  const brW = measureW(g, sansFont, ' Taraney');
  const start = w / 2 - (urW + brW) / 2;
  setShadow(g, dark, 12 * u);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = sansFont;
  g.fillStyle = p.template.text;
  g.globalAlpha = 0.7;
  g.fillText(' Taraney', start + urW, y);
  g.globalAlpha = 1;
  g.direction = 'rtl';
  g.textAlign = 'right';
  g.font = urduFont;
  g.fillStyle = p.template.accent;
  g.fillText(BRAND_UR, start + urW, y - fs * 0.1);
  g.restore();
}

function drawProgress(g: CanvasRenderingContext2D, p: Project, t: number, w: number, h: number, u: number): void {
  const x = w * 0.09;
  const W = w * 0.82;
  const H = 6 * u;
  const y = h - 0.028 * h - H;
  const frac = p.duration > 0 ? clamp01(t / p.duration) : 0;
  g.save();
  setShadow(g, false, 0);
  g.globalAlpha = 0.35;
  g.fillStyle = p.template.dim;
  rr(g, x, y, W, H, H / 2);
  g.fill();
  if (frac > 0) {
    g.globalAlpha = 1;
    g.fillStyle = p.template.accent;
    rr(g, x, y, Math.max(H, W * frac), H, H / 2);
    g.fill();
  }
  g.restore();
}

/** Draws one complete video frame at clip time t (ms, 0..p.duration). Pure function of (p, t). */
export function drawFrame(g: CanvasRenderingContext2D, p: Project, t: number): void {
  const { w, h } = FORMATS[p.format];
  const u = Math.min(w, h) / 1080;
  const k = p.textScale * FORMAT_FACTOR[p.format];
  const tpl = p.template;
  const dark = tpl.bg !== 'paper' && tpl.bg !== 'clouds';

  g.save();
  resetState(g);
  paintBackground(g, w, h, t, tpl, p.seed, p.image, p.imageDim, p.overlayEffect, p.overlayIntensity);
  resetState(g);

  const c: Ctx = { g, p, t, w, h, k, maxW: w * TEXT_W, cy: h * ANCHOR[p.position] };
  const plan = planLyrics(c);
  drawDeco(g, tpl.frame, w, h, u, plan.topY, tpl.accent);
  for (const pc of plan.pieces) drawPiece(g, pc, w, u, dark, tpl.accent, c.maxW);
  if (p.showTitle) drawTitle(g, p, w, h, u, dark);
  if (p.showBrand) drawBrand(g, p, w, h, u, dark);
  if (p.showProgress) drawProgress(g, p, t, w, h, u);

  resetState(g);
  g.restore();
}
