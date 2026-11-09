// Living artwork composer. Same song id => same artwork everywhere (card, hero, player, share).
// Layers: mood base gradient + light + tint + grain (CSS) + motion. A supplied image replaces the base only.
import { seeded } from '../lib/hash';
import { MOODS, type Mood } from '../lib/mood';
import { moodColors } from './tokens';

export const TINTS = ['charcoal', 'emerald', 'ivory-dusk', 'brass-glow'] as const;
export const MOTIONS = ['drift', 'breathe', 'pan'] as const;
export const TITLE_LAYOUTS = ['corner', 'center', 'mark'] as const;
export const TEXTURES = ['bands', 'arcs', 'horizon'] as const;

const TINT_LAYER: Record<(typeof TINTS)[number], string> = {
  charcoal: 'linear-gradient(200deg, #0D151700 30%, #0D1517B3 100%)',
  emerald: 'linear-gradient(200deg, #24403800 20%, #244038C0 100%)',
  'ivory-dusk': 'linear-gradient(20deg, #F3EEE533 0%, #F3EEE500 45%, #0D151799 100%)',
  'brass-glow': 'linear-gradient(160deg, #C5A05933 0%, #C5A05900 50%, #0D1517A6 100%)',
};

const a = (hex: string, alpha: number) => hex + Math.round(alpha * 255).toString(16).padStart(2, '0');

function texture(kind: (typeof TEXTURES)[number], light: string, n: number): string {
  if (kind === 'bands') return `repeating-linear-gradient(${110 + n * 7}deg, ${a(light, 0)} 0 22px, ${a(light, 0.05)} 22px 23px)`;
  if (kind === 'arcs') return `repeating-radial-gradient(circle at ${20 + n * 6}% 110%, ${a(light, 0)} 0 28px, ${a(light, 0.06)} 28px 29px)`;
  return `linear-gradient(180deg, ${a(light, 0)} 55%, ${a(light, 0.22)} 62%, ${a(light, 0)} 70%)`;
}

export interface ArtworkSpec {
  mood: Mood;
  tint: (typeof TINTS)[number];
  motion: (typeof MOTIONS)[number];
  layout: (typeof TITLE_LAYOUTS)[number];
  texture: (typeof TEXTURES)[number];
  /** CSS custom properties consumed by .artwork in components.css */
  style: Record<string, string>;
}

export function composeArtwork(id: string, moodIn?: string | null, image?: string | null): ArtworkSpec {
  const mood = (MOODS as readonly string[]).includes(moodIn || '') ? (moodIn as Mood) : 'generic';
  const pick = seeded(id);
  const [deep, mid, light] = moodColors[mood];
  const tint = TINTS[pick(TINTS.length, 'tint')];
  const motion = MOTIONS[pick(MOTIONS.length, 'motion')];
  const layout = TITLE_LAYOUTS[pick(TITLE_LAYOUTS.length, 'layout')];
  const tex = TEXTURES[pick(TEXTURES.length, 'texture')];
  const angle = 120 + pick(120, 'angle');
  const lx = 15 + pick(70, 'lx');
  const ly = 10 + pick(45, 'ly');

  const base = image
    ? `url("${image}") center / cover no-repeat`
    : `radial-gradient(70% 60% at ${100 - lx}% ${100 - ly}%, ${a(mid, 0.75)}, ${a(mid, 0)} 70%), linear-gradient(${angle}deg, ${deep} 0%, ${a(mid, 0.9)} 58%, ${light} 140%)`;

  return {
    mood, tint, motion, layout, texture: tex,
    style: {
      '--art-bg': [TINT_LAYER[tint], texture(tex, light, pick(9, 'tn')), base].join(', '),
      '--art-light': `radial-gradient(45% 40% at ${lx}% ${ly}%, ${a(light, 0.85)}, ${a(light, 0)} 70%)`,
      '--art-pos': `${pick(100, 'px')}% ${pick(100, 'py')}%`,
      '--art-grain': String(0.12 + pick(8, 'grain') / 100),
    },
  };
}
