/** Accepts common YouTube URL forms. Returns the 11 character id, or null. */
export function parseYouTubeId(url: unknown): string | null {
  let u: URL;
  try { u = new URL(String(url).trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
    id = m ? m[1] : u.pathname === '/watch' ? u.searchParams.get('v') : null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
