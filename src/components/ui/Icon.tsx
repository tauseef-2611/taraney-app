// Inline icon set: 24px grid, 1.75 stroke, currentColor. Trusted static markup only.
const S = (d: string) => `<path d="${d}"/>`;

export const ICONS = {
  home: S('M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z'),
  explore: '<circle cx="12" cy="12" r="8.5"/>' + S('m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9z'),
  library: S('M5 4.5h3v15H5zM10.5 4.5h3v15h-3zM15.6 5.2l2.8-.7 3.3 14.4-2.8.7z'),
  search: '<circle cx="11" cy="11" r="6.5"/>' + S('m20 20-4.2-4.2'),
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/>',
  'prev-line': S('M18 6v12l-8.5-6zM6.5 6v12'),
  'next-line': S('M6 6v12l8.5-6zM17.5 6v12'),
  back10: S('M4 12a8 8 0 1 0 2.6-5.9M4 4.5V9h4.5') + '<text x="12.5" y="15.3" font-size="7" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">10</text>',
  fwd10: S('M20 12a8 8 0 1 1-2.6-5.9M20 4.5V9h-4.5') + '<text x="11.5" y="15.3" font-size="7" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">10</text>',
  heart: S('M12 19.5s-7-4.3-8.6-8.3C2.2 8 4.1 5 7.2 5c1.9 0 3.2 1 4.8 2.8C13.6 6 14.9 5 16.8 5c3.1 0 5 3 3.8 6.2C19 15.2 12 19.5 12 19.5z'),
  share: S('M12 3.5v11M8 7.5l4-4 4 4M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5'),
  download: S('M12 3.5v11M8 10.5l4 4 4-4M5 19.5h14'),
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  edit: S('M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3'),
  tag: S('M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z') + '<circle cx="8" cy="8" r="1.5"/>',
  trash: S('M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5.5M14 11v5.5'),
  sparkles: S('M11 3.5l1.6 4.4 4.4 1.6-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z'),
  shapes: S('M8 3.5l4 7H4z') + '<circle cx="7.5" cy="17" r="3.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  close: S('M6 6l12 12M18 6 6 18'),
  check: S('m5 12.5 4.5 4.5L19 7.5'),
  music: S('M9 17.5V5.5l10.5-2v12') + '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17" cy="15.5" r="2.5"/>',
  lyrics: S('M4.5 6.5h15M4.5 12h10M4.5 17.5h13'),
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3"/>' + '<path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="4"/>' + S('M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4'),
  moon: S('M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z'),
  repeat: S('M4.5 11V9.5a3 3 0 0 1 3-3H19M16 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3H5M8 20.5l-3-3 3-3'),
  'chevron-down': S('m6 9 6 6 6-6'),
  'arrow-left': S('M19 12H5M11 6l-6 6 6 6'),
  info: '<circle cx="12" cy="12" r="8.5"/>' + S('M12 11v5.5M12 7.6v.4'),
  offline: S('M3.5 3.5l17 17M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14 10.4a10 10 0 0 1 5 2.6M2 9.5a15 15 0 0 1 5.3-3.1M12 18.5h.01'),
  image: S('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z') + '<circle cx="9" cy="9.5" r="1.6"/>' + S('M4.5 17 9 12.5l3.5 3.5 2.5-2.5 4.5 4.5'),
  type: S('M5 6V4.5h14V6M12 4.5v15M9 19.5h6'),
  layers: S('M12 3.5 21 8l-9 4.5L3 8z') + S('M3 12.5l9 4.5 9-4.5') + S('M3 16.5l9 4.5 9-4.5'),
  ratio: '<rect x="7" y="3.5" width="10" height="17" rx="2.5"/>',
  reset: S('M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5V9h4.5'),
  upload: S('M12 15.5v-11M8 8.5l4-4 4 4M5 19.5h14'),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, label, class: cls }: { name: IconName; label?: string; class?: string }) {
  return (
    <svg
      class={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
