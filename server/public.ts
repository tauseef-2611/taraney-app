// Public API: media streaming (with Range) and reader submissions (rate limited).
import { Hono } from 'hono';
import { parseYouTubeId } from '../src/lib/youtube';
import { clientIp, json, newId, type Ctx, type Env } from './env';

export const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get('/health', async (c) => {
  const rows = await c.env.DB.prepare('SELECT publish_state AS state, COUNT(*) AS n FROM songs GROUP BY publish_state').all<{ state: string; n: number }>();
  return c.json({ ok: true, env: c.env.APP_ENV, songs: Object.fromEntries(rows.results.map((r) => [r.state, r.n])) });
});

/** Streams audio from R2. Supports Range so seeking works on every browser. */
publicRoutes.get('/media/*', async (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/api\/media\//, ''));
  if (!/^audio\/[\w.\/-]+$/.test(key) || key.includes('..')) return c.json({ error: 'Not found' }, 404);
  const obj = await c.env.MEDIA.get(key, { range: c.req.raw.headers, onlyIf: c.req.raw.headers });
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  const r = obj.range as { offset?: number; length?: number } | undefined;
  if (c.req.header('range') && r && r.length !== undefined) {
    const start = r.offset || 0;
    headers.set('content-range', `bytes ${start}-${start + r.length - 1}/${obj.size}`);
    headers.set('content-length', String(r.length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
});

const TYPES = ['lyrics_fix', 'audio', 'tarana'] as const;
const LIMIT_PER_HOUR = 10;

/** Reader suggestions. Never publish anything: they wait in the admin queue. */
publicRoutes.post('/submissions', async (c) => {
  const key = `sub:${clientIp(c as unknown as Ctx)}`;
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > datetime('now', '-1 hour')").bind(key).first<{ n: number }>();
  if ((n?.n || 0) >= LIMIT_PER_HOUR) return c.json({ error: 'Too many submissions. Try later.' }, 429);

  const ct = c.req.header('content-type') || '';
  const body: Record<string, unknown> = ct.includes('multipart') ? await c.req.parseBody() : await c.req.json();
  if (body.website) return c.json({ ok: true }); // honeypot
  const type = String(body.type);
  if (!TYPES.includes(type as never)) return c.json({ error: 'Unknown submission type' }, 400);

  const text = (k: string, max = 4000) => String(body[k] ?? '').trim().slice(0, max);
  const payload: Record<string, string> = { name: text('name', 80), note: text('note', 1000) };
  const id = newId('sub');
  if (type === 'lyrics_fix') {
    Object.assign(payload, { section: text('section', 20), line: text('line', 4), current_ur: text('current_ur', 400), current_ro: text('current_ro', 400), proposed_ur: text('proposed_ur', 400), proposed_ro: text('proposed_ro', 400) });
    if (!body.song_id || (!payload.proposed_ur && !payload.proposed_ro)) return c.json({ error: 'Say which line and what it should be.' }, 400);
  } else if (type === 'tarana') {
    Object.assign(payload, { title_ur: text('title_ur', 200), title_ro: text('title_ro', 200), lyrics_ur: text('lyrics_ur'), lyrics_ro: text('lyrics_ro'), poet: text('poet', 120), youtube_url: text('youtube_url', 300) });
    if (!payload.lyrics_ur && !payload.lyrics_ro && !parseYouTubeId(payload.youtube_url)) return c.json({ error: 'Add lyrics or a YouTube link.' }, 400);
  } else {
    payload.youtube_url = text('youtube_url', 300);
    payload.label = text('label', 120);
    const file = body.file;
    if (file instanceof File) {
      if (file.size > 30 * 1024 * 1024 || !file.type.startsWith('audio/')) return c.json({ error: 'Audio up to 30 MB only.' }, 400);
      payload.file_key = `submissions/${id}.${file.name.split('.').pop()?.toLowerCase() || 'mp3'}`;
      await c.env.PRIVATE.put(payload.file_key, file.stream(), { httpMetadata: { contentType: file.type } });
    } else if (!parseYouTubeId(payload.youtube_url)) return c.json({ error: 'Add an audio file or a YouTube link.' }, 400);
  }
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO submissions (id, type, song_id, payload) VALUES (?, ?, ?, ?)').bind(id, type, body.song_id ? String(body.song_id) : null, json(payload)),
    c.env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(key),
  ]);
  return c.json({ ok: true, id });
});
