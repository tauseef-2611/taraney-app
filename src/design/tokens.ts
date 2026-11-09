// Taraney design tokens: the single source of truth.
// Layer 1, primitives: seed colours expanded to tonal palettes, plus scales (space, radius, type...).
// Layer 2, roles: semantic names (primary, surface, on-surface...) mapped to primitive tones per scheme.
// Components use ONLY role and scale variables, never hex values or palette tones directly.
import { tonalPalette, type Tone } from './color';

export const SEEDS = {
  primary: '#D4AF37',   // antique gold
  secondary: '#C5A059', // brass
  tertiary: '#244038',  // deep emerald
  neutral: '#0D1517',   // charcoal
  error: '#E06C66',
} as const;

export const palettes = {
  primary: tonalPalette(SEEDS.primary),
  secondary: tonalPalette(SEEDS.secondary),
  tertiary: tonalPalette(SEEDS.tertiary, 1.6),
  neutral: tonalPalette(SEEDS.neutral, 0.9),
  neutralVariant: tonalPalette(SEEDS.secondary, 0.22),
  ivory: tonalPalette(SEEDS.secondary, 0.3),
  parchment: tonalPalette(SEEDS.secondary, 0.55),
  error: tonalPalette(SEEDS.error),
};
export type PaletteName = keyof typeof palettes;

/** A role points at a palette tone, or at an exact seed (brand fidelity for gold and emerald). */
type Ref = [PaletteName, Tone] | { seed: keyof typeof SEEDS };
const p = (name: PaletteName, tone: Tone): Ref => [name, tone];
const seed = (s: keyof typeof SEEDS): Ref => ({ seed: s });

export const ROLE_NAMES = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  // accent = the brand gold when used as TEXT or ICON on a surface (text buttons, links, chips).
  // primary = the gold when used as a FILL. In light, a readable gold text must be much darker.
  'accent',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'bg', 'on-bg',
  'surface', 'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'on-surface', 'on-surface-variant', 'on-surface-muted',
  'outline', 'outline-variant',
  'inverse-surface', 'on-inverse-surface', 'inverse-primary',
  'paper', 'paper-2', 'ink', 'ink-2', 'ink-3', 'ink-accent',
  'highlight', 'on-highlight', 'scrim',
] as const;
export type Role = (typeof ROLE_NAMES)[number];

export const schemes: Record<'dark' | 'light', Record<Role, Ref>> = {
  dark: {
    primary: seed('primary'), 'on-primary': p('primary', 15),
    'primary-container': p('primary', 30), 'on-primary-container': p('primary', 90),
    accent: seed('primary'),
    secondary: seed('secondary'), 'on-secondary': p('secondary', 15),
    'secondary-container': p('neutral', 25), 'on-secondary-container': p('secondary', 90),
    tertiary: p('tertiary', 80), 'on-tertiary': p('tertiary', 15),
    'tertiary-container': seed('tertiary'), 'on-tertiary-container': p('tertiary', 90),
    error: p('error', 80), 'on-error': p('error', 20),
    'error-container': p('error', 30), 'on-error-container': p('error', 90),
    bg: seed('neutral'), 'on-bg': p('neutral', 92),
    surface: seed('neutral'),
    'surface-container-lowest': p('neutral', 12), 'surface-container-low': p('neutral', 20),
    'surface-container': p('neutral', 22), 'surface-container-high': p('neutral', 25),
    'surface-container-highest': p('neutral', 30),
    'on-surface': p('neutral', 92), 'on-surface-variant': p('neutralVariant', 80),
    'on-surface-muted': p('neutralVariant', 70),
    outline: p('neutralVariant', 50), 'outline-variant': p('neutral', 30),
    'inverse-surface': p('neutral', 90), 'on-inverse-surface': p('neutral', 20),
    'inverse-primary': p('primary', 40),
    paper: p('ivory', 95), 'paper-2': p('ivory', 90), ink: p('neutral', 12),
    'ink-2': p('neutral', 35), 'ink-3': p('neutralVariant', 50), 'ink-accent': p('primary', 40),
    highlight: p('primary', 80), 'on-highlight': p('primary', 10), scrim: p('neutral', 0),
  } as Record<Role, Ref>,
  // Light: warm parchment page, near-white cards that lift off it, real gold fills with dark text,
  // deep emerald as the second voice. Every text pair is audited (AUDIT_PAIRS, npm run audit:contrast).
  light: {
    primary: seed('primary'), 'on-primary': p('primary', 10),
    'primary-container': p('primary', 90), 'on-primary-container': p('primary', 15),
    accent: p('primary', 35),
    secondary: seed('secondary'), 'on-secondary': p('secondary', 10),
    'secondary-container': p('parchment', 87), 'on-secondary-container': p('secondary', 15),
    tertiary: seed('tertiary'), 'on-tertiary': p('tertiary', 95),
    'tertiary-container': p('tertiary', 90), 'on-tertiary-container': p('tertiary', 15),
    error: p('error', 40), 'on-error': p('error', 100),
    'error-container': p('error', 90), 'on-error-container': p('error', 15),
    bg: p('parchment', 92), 'on-bg': p('neutral', 10),
    surface: p('parchment', 92),
    'surface-container-lowest': p('ivory', 100), 'surface-container-low': p('ivory', 98),
    'surface-container': p('ivory', 95), 'surface-container-high': p('ivory', 95),
    'surface-container-highest': p('parchment', 87),
    'on-surface': p('neutral', 10), 'on-surface-variant': p('neutralVariant', 30),
    'on-surface-muted': p('neutralVariant', 40),
    outline: p('neutralVariant', 45), 'outline-variant': p('parchment', 80),
    'inverse-surface': p('neutral', 20), 'on-inverse-surface': p('neutral', 92),
    'inverse-primary': seed('primary'),
    paper: p('ivory', 100), 'paper-2': p('ivory', 95), ink: p('neutral', 10),
    'ink-2': p('neutral', 30), 'ink-3': p('neutralVariant', 40), 'ink-accent': p('primary', 35),
    highlight: p('primary', 30), 'on-highlight': p('primary', 95), scrim: p('neutral', 0),
  } as Record<Role, Ref>,
};

export function resolve(ref: Ref): string {
  return Array.isArray(ref) ? palettes[ref[0]][ref[1]] : SEEDS[ref.seed];
}

/** Every foreground/background pair the components use: [fg, bg, minimum ratio, where]. */
export const AUDIT_PAIRS: [Role, Role, number, string][] = [
  ['on-bg', 'bg', 7, 'body text'],
  ['on-surface', 'surface-container-low', 7, 'card titles'],
  ['on-surface', 'surface-container-highest', 4.5, 'mini-player title'],
  ['on-surface-variant', 'bg', 4.5, 'secondary text'],
  ['on-surface-variant', 'surface-container-high', 4.5, 'secondary text on cards'],
  ['on-surface-muted', 'bg', 4.5, 'meta row, captions'],
  ['on-surface-muted', 'surface-container-high', 4.5, 'meta row on cards'],
  ['accent', 'bg', 4.5, 'text button, links, accent chip'],
  ['accent', 'surface-container-high', 4.5, 'accent text on cards'],
  ['on-primary', 'primary', 4.5, 'primary button, tab indicator'],
  ['on-primary-container', 'primary-container', 4.5, 'primary container'],
  ['on-secondary', 'secondary', 4.5, 'secondary icon button'],
  ['on-secondary-container', 'secondary-container', 4.5, 'secondary button, selected chip'],
  ['on-tertiary', 'tertiary', 4.5, 'FAB, tertiary icon button'],
  ['on-tertiary-container', 'tertiary-container', 4.5, 'tonal button'],
  ['tertiary', 'bg', 4.5, 'tertiary badge text'],
  ['on-error', 'error', 4.5, 'delete button'],
  ['on-inverse-surface', 'inverse-surface', 4.5, 'inverted button, selected mode'],
  ['highlight', 'bg', 4.5, 'active lyric line (player)'],
  ['ink', 'paper', 7, 'lyrics on reading surface'],
  ['ink-2', 'paper', 4.5, 'Roman on reading surface'],
  ['ink-3', 'paper', 4.5, 'labels on reading surface'],
  ['ink-accent', 'paper', 4.5, 'active line on reading surface'],
  ['outline', 'bg', 3, 'outlined button, chip borders'],
  ['accent', 'surface-container-highest', 3, 'seek bar fill'],
];

/** Soft gradients for visual identity. Built only from role variables, so they follow the scheme. */
export const gradients = {
  shell: `radial-gradient(120% 70% at 0% 0%, color-mix(in oklab, var(--color-tertiary-container) 70%, transparent), transparent 62%),
    radial-gradient(90% 60% at 100% 0%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 60%),
    var(--color-bg)`,
  card: 'linear-gradient(160deg, var(--color-surface-container-high), var(--color-surface-container-low))',
  'card-glow': `radial-gradient(80% 90% at 100% 0%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 70%),
    linear-gradient(160deg, var(--color-surface-container-high), var(--color-surface-container-low))`,
  primary: 'linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 78%, white) 0%, var(--color-primary) 45%, color-mix(in oklab, var(--color-primary) 88%, black) 100%)',
  emerald: 'linear-gradient(160deg, color-mix(in oklab, var(--color-tertiary-container) 92%, white), var(--color-tertiary-container) 50%, color-mix(in oklab, var(--color-tertiary-container) 82%, var(--color-tertiary)))',
  paper: 'linear-gradient(180deg, var(--color-paper), var(--color-paper-2))',
  progress: 'linear-gradient(90deg, var(--color-secondary), var(--color-primary))',
  'active-line': 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 18%, transparent) 15%, color-mix(in oklab, var(--color-primary) 18%, transparent) 85%, transparent)',
  'fade-bottom': 'linear-gradient(180deg, transparent, var(--color-bg))',
} as const;

export const fonts = {
  display: "'Gulzar', 'Noto Nastaliq Urdu', Georgia, serif",
  urdu: "'Gulzar', 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
  sans: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** [family, weight, size px, line height, tracking em, style?]. Urdu styles need tall lines for Nastaliq. */
export const type = {
  'display-lg': ['display', 400, 56, '64px', -0.01],
  'display-md': ['display', 400, 44, '52px', 0],
  'headline-lg': ['display', 400, 32, '44px', 0],
  'headline-md': ['display', 400, 28, '38px', 0],
  'headline-sm': ['display', 400, 24, '34px', 0],
  'title-lg': ['sans', 600, 22, '28px', 0],
  'title-md': ['sans', 600, 16, '24px', 0.005],
  'title-sm': ['sans', 600, 14, '20px', 0.007],
  'body-lg': ['sans', 400, 16, '24px', 0],
  'body-md': ['sans', 400, 14, '20px', 0.01],
  'body-sm': ['sans', 400, 12, '16px', 0.02],
  'label-lg': ['sans', 600, 14, '20px', 0.01],
  'label-md': ['sans', 600, 12, '16px', 0.04],
  'label-sm': ['sans', 600, 11, '16px', 0.05],
  'title-ur': ['urdu', 400, 26, '2.1', 0],
  'lyric-ur': ['urdu', 400, 24, '2.3', 0],
  'lyric-ur-sm': ['urdu', 400, 19, '2.2', 0],
  'lyric-ro': ['sans', 400, 16, '1.6', 0.005],
  // Supporting Urdu line under a Roman title in list rows: small, but tall enough for Nastaliq.
  'support-ur': ['urdu', 400, 15, '1.9', 0],
} as const satisfies Record<string, readonly [keyof typeof fonts, number, number, string, number, ...('italic' | 'normal')[]]>;

export const space = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48, 11: 64, 12: 80 } as const;
export const radius = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, full: 9999 } as const;
export const elevation = {
  0: 'none',
  1: '0 1px 2px rgb(0 0 0 / .30), 0 1px 3px 1px rgb(0 0 0 / .15)',
  2: '0 2px 6px 2px rgb(0 0 0 / .18), 0 1px 2px rgb(0 0 0 / .30)',
  3: '0 8px 24px -6px rgb(0 0 0 / .45), 0 2px 6px rgb(0 0 0 / .25)',
  glow: '0 0 0 1px color-mix(in oklab, var(--color-primary) 30%, transparent), 0 8px 28px -8px color-mix(in oklab, var(--color-primary) 45%, transparent)',
} as const;
export const motion = {
  'dur-short': '120ms', 'dur-medium': '240ms', 'dur-long': '420ms', 'dur-ambient': '48s',
  'ease-standard': 'cubic-bezier(.2, 0, 0, 1)',
  'ease-emphasized': 'cubic-bezier(.3, 0, 0, 1)',
  'ease-exit': 'cubic-bezier(.3, 0, 1, 1)',
} as const;
export const state = { hover: 0.08, focus: 0.12, pressed: 0.12, dragged: 0.16, disabled: 0.38 } as const;
export const layout = {
  gutter: '16px', 'content-max': '760px', 'wide-max': '1200px',
  'tabbar-h': '72px', 'miniplayer-h': '64px', 'topbar-h': '56px',
} as const;

/** Artwork colour stops per mood: [deep, mid, light]. Used by the artwork composer only. */
export const moodColors = {
  sukoon: ['#16323A', '#6F9C99', '#E6E0CC'],
  aqeedat: ['#2E1D0E', '#BF8536', '#F1D7A0'],
  josh: ['#14233A', '#D4AF37', '#F4DFA8'],
  fikr: ['#0E1626', '#3B4C6E', '#C8C1B2'],
  gham: ['#22261C', '#666C52', '#B6A68C'],
  masoom: ['#5E7A78', '#CFE0DA', '#F4EADB'],
  generic: ['#0D1517', '#244038', '#C5A059'],
} as const;

/** Everything above as CSS custom properties. Dark is the identity; light is opt-in. */
export function tokensCss(): string {
  const lines: string[] = [];
  const root: string[] = [];
  for (const [name, pal] of Object.entries(palettes)) {
    for (const [tone, hex] of Object.entries(pal)) root.push(`--p-${name}-${tone}:${hex}`);
  }
  for (const [k, v] of Object.entries(fonts)) root.push(`--font-${k}:${v}`);
  for (const [k, spec] of Object.entries(type)) {
    const [fam, w, size, lh, tr] = spec;
    const style = (spec as readonly unknown[])[5] === 'italic' ? 'italic ' : '';
    root.push(`--type-${k}:${style}${w} ${size}px/${lh} var(--font-${fam})`, `--track-${k}:${tr}em`);
  }
  for (const [k, v] of Object.entries(space)) root.push(`--space-${k}:${v}px`);
  for (const [k, v] of Object.entries(radius)) root.push(`--radius-${k}:${v}px`);
  for (const [k, v] of Object.entries(elevation)) root.push(`--elevation-${k}:${v}`);
  for (const [k, v] of Object.entries(motion)) root.push(`--${k}:${v}`);
  for (const [k, v] of Object.entries(state)) root.push(`--state-${k}:${v * 100}%`);
  for (const [k, v] of Object.entries(layout)) root.push(`--${k}:${v}`);
  for (const [k, v] of Object.entries(gradients)) root.push(`--gradient-${k}:${v.replace(/\s+/g, ' ')}`);

  const scheme = (s: 'dark' | 'light') =>
    ROLE_NAMES.map((r) => `--color-${r}:${resolve(schemes[s][r])}`).join(';') + `;color-scheme:${s}`;

  lines.push(`:root{${root.join(';')};${scheme('dark')}}`);
  lines.push(`[data-theme="light"]{${scheme('light')}}`);
  lines.push(`[data-theme="dark"]{${scheme('dark')}}`);
  return lines.join('\n');
}
