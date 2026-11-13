// Animated background painter for Reel Studio. Pure function of its arguments: every particle
// field comes from a seeded PRNG, and all motion is a periodic function of t (ms), so frames loop.
import { hash32 } from '../lib/hash';
import type { Template } from './types';

type RGB = [number, number, number];
interface Palette { deep: RGB; mid: RGB; light: RGB; tint: RGB }

const TAU = Math.PI * 2;
const WHITE: RGB = [255, 255, 255];
const frac = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function toRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function col(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp01(a).toFixed(3)})`;
}
function palette(tpl: Template): Palette {
  const deep = toRgb(tpl.colors[0]);
  const mid = toRgb(tpl.colors[1]);
  const light = toRgb(tpl.colors[2]);
  return { deep, mid, light, tint: mixRgb(light, WHITE, 0.55) };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cached seeded random fields: `count` records of `stride` values in [0, 1).
// The cache only memoises deterministic output, so the painter stays a pure function.
const fieldCache = new Map<string, Float32Array>();
function field(seed: string, kind: string, count: number, stride: number): Float32Array {
  const key = `${kind}|${seed}|${count}x${stride}`;
  const hit = fieldCache.get(key);
  if (hit) return hit;
  if (fieldCache.size > 64) fieldCache.clear();
  const rnd = mulberry32(hash32(`${kind}|${seed}`));
  const arr = new Float32Array(count * stride);
  for (let i = 0; i < arr.length; i++) arr[i] = rnd();
  fieldCache.set(key, arr);
  return arr;
}

function fillVGrad(g: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

/** Soft circular glow, drawn inside its bounding box only. */
function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string) {
  const rr = Math.max(r, 1);
  const gr = g.createRadialGradient(x, y, 0, x, y, rr);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
}

/** Darkens the corners softly. */
function vignette(g: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

/** Readability veil for dark backgrounds: slightly darker toward the middle and bottom. */
function veil(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.18)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0.30)');
  gr.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

// ---- base layers (everything except the particle layer) ----

function paintAurora(g: CanvasRenderingContext2D, w: number, h: number, t: number, P: Palette, seed: string, s: number) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [1, col(mixRgb(P.deep, P.mid, 0.4), 1)]]);
  const f = field(seed, 'aurora', 4, 3);
  for (let i = 0; i < 4; i++) {
    const ax = f[i * 3], ay = f[i * 3 + 1], ph = f[i * 3 + 2] * TAU;
    const period = 16000 + i * 3500;
    const cx = w * (0.1 + 0.8 * ax + 0.14 * Math.sin((TAU * t) / period + ph));
    const cy = h * (0.12 + 0.76 * ay + 0.07 * Math.cos((TAU * t) / (period * 1.37) + ph));
    const r = s * (0.9 + 0.35 * f[i * 3 + 2]);
    const c = i % 2 === 0 ? P.light : P.mid;
    radial(g, cx, cy, r, col(c, 0.34), col(c, 0));
  }
}

function paintPlain(g: CanvasRenderingContext2D, w: number, h: number, P: Palette) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [1, col(mixRgb(P.deep, P.mid, 0.55), 1)]]);
  vignette(g, w, h, 0.35);
}

function paintStars(g: CanvasRenderingContext2D, w: number, h: number, P: Palette, s: number) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [1, col(P.mid, 1)]]);
  radial(g, w / 2, h * 0.1, s * 1.1, col(P.light, 0.16), col(P.light, 0));
}

function paintRain(g: CanvasRenderingContext2D, w: number, h: number, P: Palette, s: number) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [1, col(P.mid, 1)]]);
  radial(g, w / 2, h, s * 1.2, col(P.light, 0.1), col(P.light, 0));
}

function paintRays(g: CanvasRenderingContext2D, w: number, h: number, t: number, P: Palette, seed: string, s: number) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [0.8, col(P.mid, 1)], [1, col(P.mid, 1)]]);
  const sx = w / 2, sy = h * 0.8;
  radial(g, sx, sy, s * 1.3, col(P.light, 0.6), col(P.light, 0));
  const f = field(seed, 'rays', 9, 2);
  for (let i = 0; i < 9; i++) {
    const a0 = f[i * 2], a1 = f[i * 2 + 1];
    const sway = 0.12 * Math.sin((TAU * t) / (14000 + a0 * 6000) + a1 * TAU);
    const ang = -Math.PI / 2 + (i - 4) * 0.2 + sway;
    const spread = 0.05 + 0.03 * a1;
    const L = s * (1.4 + 0.6 * a0);
    const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / (5000 + a0 * 4000) + i);
    g.fillStyle = col(P.light, 0.05 + 0.07 * pulse);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + L * Math.cos(ang - spread), sy + L * Math.sin(ang - spread));
    g.lineTo(sx + L * Math.cos(ang + spread), sy + L * Math.sin(ang + spread));
    g.closePath();
    g.fill();
  }
  // Ground below the horizon.
  const gr = g.createLinearGradient(0, sy, 0, h);
  gr.addColorStop(0, col(P.deep, 0.25));
  gr.addColorStop(1, col(P.deep, 0.95));
  g.fillStyle = gr;
  g.fillRect(0, sy, w, h - sy);
}

function paintBokehBase(g: CanvasRenderingContext2D, w: number, h: number, P: Palette) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [1, col(P.mid, 1)]]);
  vignette(g, w, h, 0.25);
}

function paintEmbersBase(g: CanvasRenderingContext2D, w: number, h: number, P: Palette, s: number) {
  fillVGrad(g, w, h, [[0, col(P.deep, 1)], [0.6, col(mixRgb(P.deep, P.mid, 0.5), 1)], [1, col(P.mid, 1)]]);
  radial(g, w / 2, h * 1.05, s * 1.2, col(P.light, 0.42), col(P.light, 0));
}

function paintPaper(g: CanvasRenderingContext2D, w: number, h: number, t: number, P: Palette, seed: string, s: number) {
  fillVGrad(g, w, h, [[0, col(P.light, 1)], [1, col(mixRgb(P.light, P.mid, 0.35), 1)]]);
  // Gentle moving light patch.
  const cx = w * (0.5 + 0.22 * Math.sin((TAU * t) / 24000));
  const cy = h * (0.42 + 0.08 * Math.cos((TAU * t) / 31000));
  radial(g, cx, cy, s * 1.05, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)');
  // Fibres (one batched stroke).
  const fb = field(seed, 'paper', 160, 4);
  g.strokeStyle = col(P.deep, 0.07);
  g.lineWidth = Math.max(1, s * 0.0012);
  g.beginPath();
  for (let i = 0; i < 160; i++) {
    const x = fb[i * 4] * w, y = fb[i * 4 + 1] * h;
    const L = s * (0.01 + 0.03 * fb[i * 4 + 2]);
    const a = fb[i * 4 + 3] * TAU;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
  }
  g.stroke();
  // Speckle.
  const sp = field(seed, 'speck', 240, 3);
  g.fillStyle = col(P.deep, 0.09);
  for (let i = 0; i < 240; i++) {
    const sz = Math.max(1, s * 0.002 * (0.5 + sp[i * 3 + 2]));
    g.fillRect(sp[i * 3] * w, sp[i * 3 + 1] * h, sz, sz);
  }
  vignette(g, w, h, 0.22);
}

function paintPattern(g: CanvasRenderingContext2D, w: number, h: number, t: number, P: Palette, s: number) {
  const lg = g.createLinearGradient(0, 0, w, h);
  lg.addColorStop(0, col(P.deep, 1));
  lg.addColorStop(1, col(P.mid, 1));
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);

  // Tiled 8-point stars: two overlapping squares (one axis-aligned, one at 45 degrees).
  // The tile repeats every T, so shifting by T over 30s loops seamlessly.
  const T = s * 0.2;
  const shift = frac(t / 30000) * T;
  const a = T * 0.32;
  const d = a * Math.SQRT2;
  const cols = Math.ceil(w / T) + 3;
  const rows = Math.ceil(h / T) + 3;
  g.strokeStyle = col(P.light, 0.1);
  g.lineWidth = Math.max(1, s * 0.0021);
  g.beginPath();
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const cx = i * T + shift, cy = j * T + shift;
      g.rect(cx - a, cy - a, a * 2, a * 2);
      g.moveTo(cx + d, cy);
      g.lineTo(cx, cy + d);
      g.lineTo(cx - d, cy);
      g.lineTo(cx, cy - d);
      g.closePath();
    }
  }
  g.stroke();
  radial(g, w / 2, h / 2, s * 0.9, col(P.light, 0.18), col(P.light, 0));
}

function paintClouds(g: CanvasRenderingContext2D, w: number, h: number, t: number, P: Palette, seed: string, s: number) {
  fillVGrad(g, w, h, [[0, col(P.mid, 1)], [0.6, col(mixRgb(P.mid, P.light, 0.6), 1)], [1, col(P.light, 1)]]);
  const CLOUDS = 7, STRIDE = 19;
  const f = field(seed, 'clouds', CLOUDS, STRIDE);
  const span = w * 1.6;
  for (let i = 0; i < CLOUDS; i++) {
    const b = i * STRIDE;
    const speed = 1 / (60000 + 40000 * f[b + 3]);
    // Wraps across a span wider than the canvas so clouds drift in and out of view.
    const x = frac(f[b] + t * speed) * span - w * 0.3;
    const y = h * (0.08 + 0.8 * f[b + 1]) + h * 0.01 * Math.sin((TAU * t) / (9000 + f[b + 2] * 6000) + f[b + 2] * TAU);
    const R = s * (0.14 + 0.12 * f[b + 2]);
    for (let k = 0; k < 5; k++) {
      const o = b + 4 + k * 3;
      const bx = x + (f[o] - 0.5) * 2.2 * R;
      const by = y + (f[o + 1] - 0.5) * 0.6 * R;
      const br = R * (0.55 + 0.45 * f[o + 2]);
      radial(g, bx, by + br * 0.25, br * 0.95, col(P.mid, 0.18), col(P.mid, 0));
      radial(g, bx, by, br, 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
    }
  }
}

// ---- particle layer (drawn over the base, or alone over an image at reduced strength) ----

function particleLayer(g: CanvasRenderingContext2D, w: number, h: number, t: number, kind: Template['bg'], P: Palette, seed: string, s: number, k: number) {
  if (kind === 'stars') {
    const f = field(seed, 'stars', 140, 5);
    for (let i = 0; i < 140; i++) {
      const x = f[i * 5] * w, y = f[i * 5 + 1] * h;
      const ph = f[i * 5 + 2] * TAU;
      const period = 2200 + f[i * 5 + 3] * 3800;
      const tw = 0.5 + 0.5 * Math.sin((TAU * t) / period + ph);
      const r = s * (0.0018 + 0.0035 * f[i * 5 + 4]) * (0.6 + 0.4 * tw);
      g.fillStyle = col(P.tint, (0.25 + 0.75 * tw) * k);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  } else if (kind === 'rain') {
    const f = field(seed, 'rain', 120, 4);
    g.lineWidth = Math.max(1, s * 0.0016);
    for (let i = 0; i < 120; i++) {
      const x0 = f[i * 4], y0 = f[i * 4 + 1], sp = f[i * 4 + 2], al = f[i * 4 + 3];
      const p = frac(y0 + t / (2600 + sp * 3400));
      const y = -0.05 * h + p * 1.1 * h;
      const x = (((x0 * w + p * 0.18 * h) % w) + w) % w;
      const L = s * (0.025 + 0.04 * al);
      g.strokeStyle = col(P.tint, (0.12 + 0.22 * al) * k);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + L * 0.18, y + L);
      g.stroke();
    }
  } else if (kind === 'bokeh') {
    const f = field(seed, 'bokeh', 26, 4);
    for (let i = 0; i < 26; i++) {
      const x0 = f[i * 4], y0 = f[i * 4 + 1], sz = f[i * 4 + 2], ph = f[i * 4 + 3];
      const p = frac(y0 + t / (15000 + ph * 9000));
      const y = h * (1.08 - 1.16 * p);
      const x = (x0 + 0.025 * Math.sin((TAU * t) / (9000 + ph * 6000) + ph * TAU)) * w;
      const r = s * (0.035 + 0.11 * sz);
      const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / (3200 + ph * 2600) + ph * TAU);
      radial(g, x, y, r, col(P.tint, (0.07 + 0.13 * pulse) * k), col(P.tint, 0));
    }
  } else if (kind === 'embers') {
    const f = field(seed, 'embers', 70, 5);
    for (let i = 0; i < 70; i++) {
      const x0 = f[i * 5], ph = f[i * 5 + 1], sp = f[i * 5 + 2], sw = f[i * 5 + 3], sz = f[i * 5 + 4];
      const p = frac(ph + t / (6000 + sp * 7000));
      const y = h * (1.05 - 1.1 * p);
      const x = (x0 + 0.015 * Math.sin((TAU * t) / (2200 + sw * 2400) + sw * TAU)) * w;
      const tw = 0.5 + 0.5 * Math.sin((TAU * t) / (700 + sz * 900) + sw * TAU);
      const a = Math.sin(Math.PI * p) * (0.5 + 0.5 * tw) * k;
      const r = s * (0.0016 + 0.0028 * sz);
      g.fillStyle = col(P.light, a);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      g.fillStyle = col(P.light, a * 0.22);
      g.beginPath();
      g.arc(x, y, r * 3.2, 0, TAU);
      g.fill();
    }
  }
}

function hasParticles(kind: Template['bg']): boolean {
  return kind === 'stars' || kind === 'rain' || kind === 'bokeh' || kind === 'embers';
}

interface SizedSource {
  naturalWidth?: number; naturalHeight?: number;
  videoWidth?: number; videoHeight?: number;
  displayWidth?: number; displayHeight?: number;
  width?: number; height?: number;
}
function srcSize(src: CanvasImageSource): [number, number] {
  const o = src as unknown as SizedSource;
  if (o.naturalWidth) return [o.naturalWidth, o.naturalHeight ?? 0];
  if (o.videoWidth) return [o.videoWidth, o.videoHeight ?? 0];
  if (o.displayWidth) return [o.displayWidth, o.displayHeight ?? 0];
  return [o.width ?? 0, o.height ?? 0];
}

/**
 * Paints one full background frame at time t (ms). Pure: same arguments give the same pixels.
 * With an image, the image is drawn cover-fit with a slow ping-pong zoom (1 to 1.06 over 20s),
 * darkened by imageDim (0..1, default 0.45), with a bottom-heavy vignette.
 */
export function paintBackground(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  tpl: Template,
  seed: string,
  image?: CanvasImageSource | null,
  imageDim?: number,
): void {
  const s = Math.min(w, h);
  const P = palette(tpl);
  const kind = tpl.bg;
  const [iw, ih] = image ? srcSize(image) : [0, 0];

  g.save();
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;
  g.filter = 'none';

  if (image && iw > 0 && ih > 0) {
    const isVideo = typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement;
    if (isVideo && image.duration && Number.isFinite(image.duration)) {
      const targetTime = (t / 1000) % image.duration;
      if (Math.abs(image.currentTime - targetTime) > 0.08) {
        image.currentTime = targetTime;
      }
    }

    // Ping-pong zoom for static images; video already has natural motion.
    const tri = frac(t / 40000) * 2;
    const zoom = isVideo ? 1 : 1 + 0.06 * (tri < 1 ? tri : 2 - tri);
    const scale = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * scale, dh = ih * scale;
    g.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);

    const dim = imageDim === undefined ? 0.45 : clamp01(imageDim);
    g.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`;
    g.fillRect(0, 0, w, h);

    if (hasParticles(kind)) particleLayer(g, w, h, t, kind, P, seed, s, 0.4);

    const bottom = g.createLinearGradient(0, 0, 0, h);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(0.5, 'rgba(0,0,0,0.15)');
    bottom.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = bottom;
    g.fillRect(0, 0, w, h);
  } else {
    switch (kind) {
      case 'aurora': paintAurora(g, w, h, t, P, seed, s); break;
      case 'stars': paintStars(g, w, h, P, s); break;
      case 'rain': paintRain(g, w, h, P, s); break;
      case 'rays': paintRays(g, w, h, t, P, seed, s); break;
      case 'bokeh': paintBokehBase(g, w, h, P); break;
      case 'embers': paintEmbersBase(g, w, h, P, s); break;
      case 'paper': paintPaper(g, w, h, t, P, seed, s); break;
      case 'pattern': paintPattern(g, w, h, t, P, s); break;
      case 'clouds': paintClouds(g, w, h, t, P, seed, s); break;
      case 'plain': paintPlain(g, w, h, P); break;
    }
    if (hasParticles(kind)) particleLayer(g, w, h, t, kind, P, seed, s, 1);
    if (kind !== 'paper' && kind !== 'clouds') veil(g, w, h);
  }

  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;
  g.filter = 'none';
  g.restore();
}
