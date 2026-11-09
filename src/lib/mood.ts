// Mood decides the artwork pool. Derived from genre and themes; an admin may lock an override.
export const MOODS = ['sukoon', 'aqeedat', 'josh', 'fikr', 'gham', 'masoom', 'generic'] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, { ur: string; ro: string; feel: string }> = {
  sukoon: { ur: 'سکون', ro: 'Sukoon', feel: 'Serene · dawn mist, still water' },
  aqeedat: { ur: 'عقیدت', ro: 'Aqeedat', feel: 'Devotion · warm lamplight, amber haze' },
  josh: { ur: 'جوش', ro: 'Josh', feel: 'Rousing · horizon sunrise, light rays' },
  fikr: { ur: 'فکر', ro: 'Fikr', feel: 'Reflective · ink wash, night sky' },
  gham: { ur: 'غم', ro: 'Gham', feel: 'Lament · olive dusk, rain on glass' },
  masoom: { ur: 'معصوم', ro: 'Masoom', feel: 'Innocence · pastel paper, soft clouds' },
  generic: { ur: 'عام', ro: 'Generic', feel: 'Charcoal grain, emerald velvet' },
};

const THEME_MOOD: Record<string, Mood> = {
  falasteen: 'gham', burma: 'gham', 'adl-o-insaf': 'gham', istemar: 'gham',
  bachpan: 'masoom', walidain: 'masoom',
  'ishq-e-rasool': 'aqeedat', seerat: 'aqeedat',
  tawakkul: 'sukoon', tawheed: 'sukoon',
  khudi: 'fikr', akhirat: 'fikr', tareekh: 'fikr',
  himmat: 'josh', bedari: 'josh', naujawan: 'josh', ittehad: 'josh', tanzeem: 'josh',
};
const GENRE_MOOD: Record<string, Mood> = {
  dua: 'sukoon', hamd: 'sukoon', naat: 'aqeedat', manqabat: 'aqeedat',
  tarana: 'josh', nazm: 'fikr', ghazal: 'fikr', 'bachon-ki-nazm': 'masoom',
};
/** Themes that override the genre mood because they change the feeling strongly. */
const STRONG = new Set(['falasteen', 'burma', 'bachpan', 'walidain']);

export function deriveMood(genre?: string | null, themes: string[] = []): Mood {
  const strong = themes.find((t) => STRONG.has(t));
  if (strong) return THEME_MOOD[strong];
  if (genre && GENRE_MOOD[genre]) return GENRE_MOOD[genre];
  for (const t of themes) if (THEME_MOOD[t]) return THEME_MOOD[t];
  return 'generic';
}
