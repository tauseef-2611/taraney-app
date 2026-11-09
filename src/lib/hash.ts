/** FNV-1a 32-bit. Stable across runtimes, so a song's artwork never changes. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic picks from one seed: pick(n, salt) is in [0, n). */
export function seeded(seed: string) {
  return (n: number, salt = '') => hash32(`${seed}:${salt}`) % n;
}
