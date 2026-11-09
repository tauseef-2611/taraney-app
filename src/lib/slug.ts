/** ASCII slug from the first 6 whitespace-separated words. Returns '' if nothing ASCII remains. */
export function slugify(text: unknown): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’‘ʼʻ`´]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** slugify(text), suffixed -2, -3... until `taken` says it is free. */
export function uniqueSlug(text: unknown, taken: (slug: string) => boolean): string {
  const base = slugify(text) || 'tarana';
  let slug = base;
  for (let n = 2; taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}
