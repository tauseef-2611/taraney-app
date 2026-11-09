// Tonal palettes from one seed colour, in OKLCH, gamut-clipped to sRGB.
// Tone 0 is black, 100 is white; the seed's hue and chroma carry through every tone.

type RGB = [number, number, number];

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
}
export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToOklch(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI];
}

function oklchToLinear(L: number, C: number, H: number): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (c: RGB) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to hex, reducing chroma until the colour fits in sRGB. */
export function oklchToHex(L: number, C: number, H: number): string {
  let lo = 0;
  let hi = C;
  if (!inGamut(oklchToLinear(L, C, H))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid; else hi = mid;
    }
    C = lo;
  }
  return rgbToHex(oklchToLinear(L, C, H).map(linearToSrgb) as RGB);
}

export const TONES = [0, 5, 10, 12, 15, 17, 20, 22, 25, 30, 35, 40, 45, 50, 60, 70, 80, 87, 90, 92, 95, 98, 100] as const;
/** The tones shown as a strip on the design page. */
export const STRIP_TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100] as const;
export type Tone = (typeof TONES)[number];

/**
 * A tonal palette from a seed. Chroma eases off toward black and white, so dark tones
 * stay rich without going muddy and light tones stay clean. `chromaScale` mutes a palette.
 */
export function tonalPalette(seedHex: string, chromaScale = 1): Record<Tone, string> {
  const [, C, H] = rgbToOklch(hexToRgb(seedHex));
  const out = {} as Record<Tone, string>;
  for (const t of TONES) {
    const L = t / 100;
    const ease = Math.sin(Math.PI * Math.min(1, Math.max(0, L)));
    out[t] = t === 0 ? '#000000' : t === 100 ? '#FFFFFF' : oklchToHex(L, C * chromaScale * (0.35 + 0.65 * ease), H);
  }
  return out;
}

/** WCAG 2 contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bb] = hexToRgb(hex).map(srgbToLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
