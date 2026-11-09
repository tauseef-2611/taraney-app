// Renders a shareable couplet card on Canvas (browser does real Nastaliq shaping).
// Same mood colours and seeded choices as the living artwork, so the card matches the song.
import { seeded } from '../lib/hash';
import { MOODS, type Mood } from '../lib/mood';
import { moodColors } from '../design/tokens';

export const FORMATS = {
  status: { w: 1080, h: 1920, label: 'Status 9:16' },
  square: { w: 1080, h: 1080, label: 'Square' },
  wide: { w: 1200, h: 630, label: 'Wide' },
} as const;
export type Format = keyof typeof FORMATS;

export interface CardInput {
  songId: string; mood: string; title_ur?: string | null; title_ro?: string | null;
  lines: { ur?: string; ro?: string }[]; script: 'ur' | 'both' | 'ro'; format: Format; url: string;
}

const URDU = "'Gulzar', 'Noto Nastaliq Urdu', serif";
const SANS = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif";
const hexA = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`64px ${URDU}`, 'ترانے عزم'),
    document.fonts.load(`600 32px ${SANS}`, 'Taraney'),
    document.fonts.load(`400 32px ${SANS}`, 'Taraney'),
  ]).catch(() => {});
}

function paintBackground(g: CanvasRenderingContext2D, w: number, h: number, id: string, moodIn: string) {
  const mood = (MOODS as readonly string[]).includes(moodIn) ? (moodIn as Mood) : 'generic';
  const [deep, mid, light] = moodColors[mood];
  const pick = seeded(id);
  const angle = ((120 + pick(120, 'angle')) * Math.PI) / 180;
  const cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
  const lin = g.createLinearGradient(cx - Math.sin(angle) * r, cy + Math.cos(angle) * r, cx + Math.sin(angle) * r, cy - Math.cos(angle) * r);
  lin.addColorStop(0, deep); lin.addColorStop(0.58, hexA(mid, 0.9)); lin.addColorStop(1, light);
  g.fillStyle = deep; g.fillRect(0, 0, w, h);
  g.fillStyle = lin; g.fillRect(0, 0, w, h);

  const lx = ((15 + pick(70, 'lx')) / 100) * w, ly = ((10 + pick(45, 'ly')) / 100) * h;
  const glow = g.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.55);
  glow.addColorStop(0, hexA(light, 0.55)); glow.addColorStop(1, hexA(light, 0));
  g.fillStyle = glow; g.fillRect(0, 0, w, h);

  // Readability veil: darker toward the text block, like the app's player.
  const veil = g.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, 'rgba(13,21,23,0.25)'); veil.addColorStop(0.5, 'rgba(13,21,23,0.55)'); veil.addColorStop(1, 'rgba(13,21,23,0.78)');
  g.fillStyle = veil; g.fillRect(0, 0, w, h);

  // Film grain, seeded so the same couplet always renders identically.
  let seed = pick(2 ** 30, 'grain') || 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.globalAlpha = 0.06;
  for (let i = 0; i < (w * h) / 90; i++) { g.fillStyle = rand() > 0.5 ? '#fff' : '#000'; g.fillRect(rand() * w, rand() * h, 2, 2); }
  g.globalAlpha = 1;
}

/** Largest font size (<= max) at which every line fits the width. */
function fit(g: CanvasRenderingContext2D, lines: string[], family: string, weight: string, max: number, min: number, width: number) {
  for (let s = max; s >= min; s -= 2) {
    g.font = `${weight} ${s}px ${family}`;
    if (lines.every((l) => g.measureText(l).width <= width)) return s;
  }
  return min;
}

/** Wraps a line that still does not fit at the minimum size. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  if (g.measureText(text).width <= width) return [text];
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (g.measureText(next).width > width && cur) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export async function renderCard(input: CardInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const { w, h } = FORMATS[input.format];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  paintBackground(g, w, h, input.songId, input.mood);

  const pad = Math.round(w * 0.09);
  const width = w - pad * 2;
  const ur = input.script !== 'ro' ? input.lines.map((l) => l.ur || '').filter(Boolean) : [];
  const ro = input.script !== 'ur' ? input.lines.map((l) => l.ro || '').filter(Boolean) : [];
  const wide = input.format === 'wide';
  const scale = wide ? 0.62 : input.format === 'square' ? 0.85 : 1;

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#FFFFFF';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 24;

  // Measure blocks
  // Big, readable sizes; long lines wrap instead of shrinking into tiny text.
  const urSize = ur.length ? fit(g, ur, URDU, '400', Math.round(92 * scale), Math.round((wide ? 40 : 64) * scale), width) : 0;
  g.font = `400 ${urSize}px ${URDU}`;
  const urLines = ur.flatMap((l) => wrap(g, l, width));
  const urLH = urSize * 2.1;
  const roSize = ro.length ? fit(g, ro, SANS, ur.length ? '400' : '600', Math.round((ur.length ? 42 : 64) * scale), Math.round((ur.length ? 34 : 48) * scale), width) : 0;
  g.font = `${ur.length ? '400' : '600'} ${roSize}px ${SANS}`;
  const roLines = ro.flatMap((l) => wrap(g, l, width));
  const roLH = roSize * 1.55;
  const gap = ur.length && ro.length ? Math.round(56 * scale) : 0;
  const blockH = urLines.length * urLH + gap + roLines.length * roLH;
  let y = h * (wide ? 0.46 : 0.47) - blockH / 2;

  g.direction = 'rtl';
  g.font = `400 ${urSize}px ${URDU}`;
  for (const l of urLines) { g.fillText(l, w / 2, y + urLH / 2); y += urLH; }
  g.direction = 'ltr';

  if (gap) {
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(212,175,55,0.9)';
    g.fillRect(w / 2 - 36 * scale, y + gap / 2 - 1.5, 72 * scale, 3);
    g.fillStyle = '#FFFFFF';
    g.shadowBlur = 24;
    y += gap;
  }
  g.font = `${ur.length ? '400' : '600'} ${roSize}px ${SANS}`;
  g.fillStyle = ur.length ? 'rgba(255,255,255,0.86)' : '#FFFFFF';
  for (const l of roLines) { g.fillText(l, w / 2, y + roLH / 2); y += roLH; }

  // Footer: title and brand
  g.shadowBlur = 12;
  const fs = Math.round((wide ? 24 : 30) * (input.format === 'status' ? 1 : 0.9));
  const fy = h - pad * (wide ? 0.55 : 0.9);
  const title = input.title_ro || input.title_ur || '';
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.font = `600 ${fs}px ${SANS}`;
  if (title) g.fillText(title.length > 48 ? `${title.slice(0, 46)}…` : title, w / 2, fy - fs * 1.6);
  g.fillStyle = '#D4AF37';
  g.direction = 'rtl';
  g.font = `400 ${Math.round(fs * 1.25)}px ${URDU}`;
  const brandUr = 'ترانے';
  const urW = g.measureText(brandUr).width;
  g.direction = 'ltr';
  g.font = `600 ${fs}px ${SANS}`;
  const brand = `  Taraney · ${input.url.replace(/^https?:\/\//, '')}`;
  const brW = g.measureText(brand).width;
  const start = w / 2 - (urW + brW) / 2;
  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText(brand, start + urW, fy);
  g.fillStyle = '#D4AF37';
  g.direction = 'rtl';
  g.textAlign = 'right';
  g.font = `400 ${Math.round(fs * 1.25)}px ${URDU}`;
  g.fillText(brandUr, start + urW, fy - fs * 0.1);
  return cv;
}

export const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res) => cv.toBlob((b) => res(b!), 'image/png'));

/** Shares as an image file where supported (WhatsApp/Instagram status via the OS sheet); otherwise downloads. */
export async function shareOrDownload(cv: HTMLCanvasElement, name: string, text: string, url: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await toBlob(cv);
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text}\n${url}` }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  download(blob, `${name}.png`);
  return 'downloaded';
}
export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
