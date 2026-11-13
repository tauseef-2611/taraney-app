// Reel Studio artwork templates. Each one is a complete look: background kind and palette,
// lyric colours and text layout/animation, and a frame. Grouped by mood (see src/lib/mood.ts).
import { MOODS, type Mood } from '../lib/mood';
import type { Template } from './types';

export const TEMPLATES: Template[] = [
  // sukoon: teal and dawn mist
  {
    id: 'dawn-mist', name: 'Dawn Mist', mood: 'sukoon', themes: ['tawakkul', 'tawheed'],
    bg: 'aurora', colors: ['#0B2A2E', '#1E5C60', '#8FC9C4'],
    text: '#F4FBFA', accent: '#9FD8D0', dim: 'rgba(244,251,250,0.45)',
    layout: 'focus', anim: 'fade', frame: 'none',
    suggestedVideoId: 'autumn-mist',
  },
  {
    id: 'still-water', name: 'Still Water', mood: 'sukoon', themes: ['tawheed'],
    bg: 'plain', colors: ['#06201F', '#0F3B3A', '#5FA8A0'],
    text: '#EAF6F4', accent: '#7FD1C6', dim: 'rgba(234,246,244,0.45)',
    layout: 'scroll', anim: 'rise', frame: 'bar',
  },
  {
    id: 'morning-prayer', name: 'Morning Prayer', mood: 'sukoon', themes: ['quran', 'ramzan'],
    bg: 'stars', colors: ['#041A24', '#0B3345', '#2F7A8C'],
    text: '#EAF6F8', accent: '#8ED8E6', dim: 'rgba(234,246,248,0.45)',
    layout: 'couplet', anim: 'blur', frame: 'corners',
    suggestedVideoId: 'spiritual-dusk',
  },
  {
    id: 'silver-dawn', name: 'Silver Dawn', mood: 'sukoon', themes: ['tawakkul'],
    bg: 'clouds', colors: ['#7FB8B4', '#B9DEDA', '#EAF7F5'],
    text: '#1F2A2C', accent: '#2E7D78', dim: 'rgba(31,42,44,0.45)',
    layout: 'couplet', anim: 'fade', frame: 'border',
    suggestedVideoId: 'misty-woods',
  },
  {
    id: 'khat-e-nastaliq', name: 'Khat-e-Nastaliq', mood: 'sukoon', themes: ['tawheed', 'tawakkul', 'ishq-e-rasool'],
    bg: 'plain', colors: ['#060B0A', '#0D1A16', '#1D3B32'],
    text: '#FFFDF5', accent: '#D4AF37', dim: 'rgba(255,253,245,0.40)',
    layout: 'couplet', anim: 'fade', frame: 'border',
    defaultScript: 'ur', fontStyle: 'nastaliq', defaultScale: 0.85,
    suggestedVideoId: 'sunlight-mist',
  },

  // aqeedat: amber lamplight and emerald
  {
    id: 'lamplight', name: 'Lamplight', mood: 'aqeedat', themes: ['ishq-e-rasool', 'seerat'],
    bg: 'bokeh', colors: ['#2A1606', '#6B3A0E', '#E8A848'],
    text: '#FFF6E6', accent: '#F5C46B', dim: 'rgba(255,246,230,0.45)',
    layout: 'focus', anim: 'zoom', frame: 'border',
  },
  {
    id: 'emerald-lamp', name: 'Emerald Lamp', mood: 'aqeedat', themes: ['seerat', 'quran'],
    bg: 'aurora', colors: ['#052A1E', '#0E5A40', '#4FBF8A'],
    text: '#F2FFF8', accent: '#A7F0C9', dim: 'rgba(242,255,248,0.45)',
    layout: 'scroll', anim: 'rise', frame: 'none',
  },
  {
    id: 'amber-haze', name: 'Amber Haze', mood: 'aqeedat', themes: ['ishq-e-rasool', 'ramzan'],
    bg: 'embers', colors: ['#1E0E04', '#5A2A0A', '#D9822B'],
    text: '#FFF4E4', accent: '#FFC36B', dim: 'rgba(255,244,228,0.45)',
    layout: 'couplet', anim: 'fade', frame: 'corners',
  },
  {
    id: 'mihrab', name: 'Mihrab', mood: 'aqeedat', themes: ['seerat', 'quran'],
    bg: 'pattern', colors: ['#0A2A1F', '#15503C', '#3E8E6E'],
    text: '#F7FFF9', accent: '#D4AF37', dim: 'rgba(247,255,249,0.45)',
    layout: 'stack', anim: 'wipe', frame: 'border',
  },

  // josh: navy and gold sunrise, embers
  {
    id: 'sunrise-rays', name: 'Sunrise Rays', mood: 'josh', themes: ['himmat', 'naujawan', 'bedari'],
    bg: 'rays', colors: ['#0B1A3A', '#1F3F7A', '#F2B33D'],
    text: '#FFFFFF', accent: '#F7C948', dim: 'rgba(255,255,255,0.45)',
    layout: 'focus', anim: 'rise', frame: 'bar',
  },
  {
    id: 'gold-leaf', name: 'Gold Leaf', mood: 'josh', themes: ['ittehad', 'tanzeem'],
    bg: 'pattern', colors: ['#0A1630', '#1B2F5C', '#C9A23A'],
    text: '#FFF8E1', accent: '#E8C14E', dim: 'rgba(255,248,225,0.45)',
    layout: 'couplet', anim: 'zoom', frame: 'border',
  },
  {
    id: 'ember-glow', name: 'Ember Glow', mood: 'josh', themes: ['himmat', 'bedari'],
    bg: 'embers', colors: ['#140A14', '#3D1420', '#E4572E'],
    text: '#FFF1E8', accent: '#FF9F45', dim: 'rgba(255,241,232,0.45)',
    layout: 'scroll', anim: 'rise', frame: 'corners',
  },
  {
    id: 'navy-starfield', name: 'Navy Starfield', mood: 'josh', themes: ['naujawan', 'ittehad'],
    bg: 'stars', colors: ['#050B1E', '#122459', '#3B5BBF'],
    text: '#FFFFFF', accent: '#FFD56B', dim: 'rgba(255,255,255,0.45)',
    layout: 'stack', anim: 'wipe', frame: 'none',
  },
  {
    id: 'golden-embers', name: 'Golden Embers', mood: 'josh', themes: ['himmat', 'bedari', 'ittehad'],
    bg: 'embers', colors: ['#120803', '#2B1408', '#6E3214'],
    text: '#FFF8F0', accent: '#FFB347', dim: 'rgba(255,248,240,0.40)',
    layout: 'focus', anim: 'word-rise', frame: 'corners',
    defaultScript: 'ur', fontStyle: 'nastaliq', defaultScale: 0.9,
    suggestedVideoId: 'sunlight-mist',
  },

  // fikr: deep indigo night sky, ink and old paper
  {
    id: 'night-sky', name: 'Night Sky', mood: 'fikr', themes: ['khudi', 'akhirat'],
    bg: 'stars', colors: ['#070A1F', '#1A1F4F', '#4A4FA8'],
    text: '#EEF0FF', accent: '#B8BEFF', dim: 'rgba(238,240,255,0.45)',
    layout: 'focus', anim: 'fade', frame: 'border',
    suggestedVideoId: 'dark-river',
  },
  {
    id: 'ink-wash', name: 'Ink Wash', mood: 'fikr', themes: ['tareekh', 'khudi'],
    bg: 'aurora', colors: ['#0A0A12', '#1C1C2E', '#4B4B70'],
    text: '#E9E9F2', accent: '#C7C7E0', dim: 'rgba(233,233,242,0.45)',
    layout: 'couplet', anim: 'blur', frame: 'none',
  },
  {
    id: 'old-paper', name: 'Old Paper', mood: 'fikr', themes: ['tareekh', 'khudi'],
    bg: 'paper', colors: ['#3B2A16', '#E9DFC6', '#F4EEDC'],
    text: '#2B1D0E', accent: '#8A5A24', dim: 'rgba(43,29,14,0.45)',
    layout: 'stack', anim: 'fade', frame: 'border',
  },
  {
    id: 'indigo-bokeh', name: 'Indigo Bokeh', mood: 'fikr', themes: ['akhirat'],
    bg: 'bokeh', colors: ['#0B0F2E', '#1E2466', '#7A84E0'],
    text: '#F5F6FF', accent: '#A9B2FF', dim: 'rgba(245,246,255,0.45)',
    layout: 'scroll', anim: 'zoom', frame: 'corners',
  },
  {
    id: 'nocturne-bokeh', name: 'Nocturne Bokeh', mood: 'fikr', themes: ['khudi', 'akhirat'],
    bg: 'bokeh', colors: ['#080C14', '#141E30', '#324765'],
    text: '#F4F7FC', accent: '#E5C07B', dim: 'rgba(244,247,252,0.35)',
    layout: 'focus', anim: 'word-karaoke', frame: 'none',
    defaultScript: 'ro', fontStyle: 'serif', defaultScale: 0.8,
    suggestedVideoId: 'dark-river',
  },
  {
    id: 'micro-quote', name: 'Micro Quote', mood: 'fikr', themes: ['khudi', 'tareekh', 'akhirat'],
    bg: 'plain', colors: ['#050505', '#0F0F10', '#1C1D1F'],
    text: '#FFFFFF', accent: '#A0A5AD', dim: 'rgba(255,255,255,0.30)',
    layout: 'focus', anim: 'fade', frame: 'none',
    defaultScript: 'both', fontStyle: 'sans', defaultScale: 0.55,
    suggestedVideoId: 'coastal-clouds',
  },

  // gham: olive dusk and rain on glass
  {
    id: 'cinematic-rain', name: 'Cinematic Rain', mood: 'gham', themes: ['falasteen', 'burma', 'istemar', 'khudi'],
    bg: 'rain', colors: ['#0A0F14', '#15222E', '#3D5A73'],
    text: '#F0F6FC', accent: '#58A6FF', dim: 'rgba(240,246,252,0.35)',
    layout: 'focus', anim: 'blur', frame: 'bar',
    defaultScript: 'ro', fontStyle: 'serif', defaultScale: 0.8,
    suggestedVideoId: 'rain-glass',
  },
  {
    id: 'olive-rain', name: 'Olive Rain', mood: 'gham', themes: ['falasteen', 'burma'],
    bg: 'rain', colors: ['#14170F', '#3A4128', '#7C8561'],
    text: '#EEF0E6', accent: '#B9C29A', dim: 'rgba(238,240,230,0.45)',
    layout: 'focus', anim: 'fade', frame: 'bar',
    suggestedVideoId: 'foggy-rain',
  },
  {
    id: 'rain-on-glass', name: 'Rain on Glass', mood: 'gham', themes: ['adl-o-insaf', 'istemar'],
    bg: 'rain', colors: ['#101314', '#2C3436', '#6D7B80'],
    text: '#E6ECEE', accent: '#9FB4BA', dim: 'rgba(230,236,238,0.45)',
    layout: 'couplet', anim: 'blur', frame: 'border',
    suggestedVideoId: 'rain-glass',
  },
  {
    id: 'dusk-olive', name: 'Dusk Olive', mood: 'gham', themes: ['falasteen'],
    bg: 'plain', colors: ['#0E100B', '#2B3020', '#5E6A44'],
    text: '#F3F1E8', accent: '#C9B47A', dim: 'rgba(243,241,232,0.45)',
    layout: 'scroll', anim: 'rise', frame: 'none',
  },
  {
    id: 'grey-clouds', name: 'Grey Clouds', mood: 'gham', themes: ['burma', 'istemar'],
    bg: 'clouds', colors: ['#8C9590', '#B7BFBB', '#DDE3E0'],
    text: '#1F2A2C', accent: '#4D5E5A', dim: 'rgba(31,42,44,0.45)',
    layout: 'focus', anim: 'fade', frame: 'none',
  },

  // masoom: pastel paper and soft clouds
  {
    id: 'pastel-clouds', name: 'Pastel Clouds', mood: 'masoom', themes: ['bachpan', 'walidain'],
    bg: 'clouds', colors: ['#A9CFE8', '#CFE6F5', '#F5FAFF'],
    text: '#1F2A2C', accent: '#E58FB0', dim: 'rgba(31,42,44,0.45)',
    layout: 'stack', anim: 'fade', frame: 'corners',
  },
  {
    id: 'pastel-paper', name: 'Pastel Paper', mood: 'masoom', themes: ['bachpan'],
    bg: 'paper', colors: ['#F6E7D8', '#FBEFE3', '#FFF9F3'],
    text: '#3A2E33', accent: '#E78FA7', dim: 'rgba(58,46,51,0.45)',
    layout: 'couplet', anim: 'rise', frame: 'border',
  },
  {
    id: 'mauve-bokeh', name: 'Mauve Bokeh', mood: 'masoom', themes: ['walidain'],
    bg: 'bokeh', colors: ['#2A1E38', '#5B4478', '#F4C2DA'],
    text: '#FFF5FA', accent: '#FFB8D9', dim: 'rgba(255,245,250,0.45)',
    layout: 'focus', anim: 'zoom', frame: 'none',
  },
  {
    id: 'sunny-rays', name: 'Sunny Rays', mood: 'masoom', themes: ['bachpan'],
    bg: 'rays', colors: ['#3A2A5A', '#8A6BB8', '#FFE3A3'],
    text: '#FFFFFF', accent: '#FFE08A', dim: 'rgba(255,255,255,0.45)',
    layout: 'scroll', anim: 'wipe', frame: 'bar',
  },

  // generic: charcoal, emerald velvet, minimal black
  {
    id: 'charcoal-grain', name: 'Charcoal Grain', mood: 'generic', themes: [],
    bg: 'plain', colors: ['#101112', '#1E2123', '#3A3F43'],
    text: '#F2F2F2', accent: '#C9CED2', dim: 'rgba(242,242,242,0.45)',
    layout: 'focus', anim: 'fade', frame: 'border',
  },
  {
    id: 'emerald-velvet', name: 'Emerald Velvet', mood: 'generic', themes: [],
    bg: 'aurora', colors: ['#03221A', '#0B4A36', '#1F8A63'],
    text: '#F3FFF9', accent: '#7FE3B5', dim: 'rgba(243,255,249,0.45)',
    layout: 'couplet', anim: 'zoom', frame: 'corners',
  },
  {
    id: 'minimal-black', name: 'Minimal Black', mood: 'generic', themes: [],
    bg: 'plain', colors: ['#000000', '#0A0A0A', '#1A1A1A'],
    text: '#FFFFFF', accent: '#D4AF37', dim: 'rgba(255,255,255,0.45)',
    layout: 'stack', anim: 'fade', frame: 'none',
  },
  {
    id: 'quiet-stars', name: 'Quiet Stars', mood: 'generic', themes: ['ramzan'],
    bg: 'stars', colors: ['#0A0F0D', '#14231E', '#2C4A40'],
    text: '#EAF5F0', accent: '#8ED8B8', dim: 'rgba(234,245,240,0.45)',
    layout: 'scroll', anim: 'blur', frame: 'bar',
  },
];

export const DEFAULT_TEMPLATE_ID = 'charcoal-grain';

export const TEMPLATE_BY_ID: Record<string, Template> = (() => {
  const map: Record<string, Template> = {};
  for (const t of TEMPLATES) map[t.id] = t;
  return map;
})();

/** Templates for a mood. Unknown moods fall back to the generic set. */
export function templatesForMood(mood: string): Template[] {
  const key: Mood = (MOODS as readonly string[]).includes(mood) ? (mood as Mood) : 'generic';
  return TEMPLATES.filter((t) => t.mood === key);
}

/** Mood matches first, then theme matches, then generic, then any others. De-duplicated, max 8. */
export function recommendedTemplates(mood: string, themes: string[]): Template[] {
  const out: Template[] = [];
  const seen = new Set<string>();
  const add = (t: Template) => {
    if (out.length >= 8 || seen.has(t.id)) return;
    seen.add(t.id);
    out.push(t);
  };
  templatesForMood(mood).forEach(add);
  for (const theme of themes) {
    for (const t of TEMPLATES) if (t.themes.includes(theme)) add(t);
  }
  templatesForMood('generic').forEach(add);
  TEMPLATES.forEach(add);
  return out;
}
