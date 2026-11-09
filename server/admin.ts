// Admin API: songs, lyrics, recordings, timing, submissions. All routes require a session.
import { Hono } from 'hono';
import { docErrors } from '../src/lib/song-shape';
import { deriveMood } from '../src/lib/mood';
import { docFromPaste } from '../src/lib/paste';
import { slugify } from '../src/lib/slug';
import { parseYouTubeId } from '../src/lib/youtube';
import type { SongDoc, TimedLine } from '../src/lib/types';
import { requireAdmin } from './auth';
import { audioUrl, audit, json, newId, parse, type Ctx, type Env } from './env';

type App = { Bindings: Env; Variables: { adminId: string; adminEmail: string } };
export const adminRoutes = new Hono<App>();
adminRoutes.use('*', requireAdmin);

const STATES = ['draft', 'review', 'published', 'rejected'] as const;
const AUDIO_EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
const MAX_AUDIO = 40 * 1024 * 1024;

const songRow = (r: Record<string, unknown>) => ({
  ...r,
  reviewed: !!r.reviewed,
  mood_locked: !!r.mood_locked,
  themes: parse<string[]>(r.themes, []),
  tags: parse<string[]>(r.tags, []),
  doc: parse<SongDoc>(r.doc, { sections: [], structure: [] }),
  source_pages: parse<number[]>(r.source_pages, []),
  issues: parse<string[]>(r.issues, []),
});
const recRow = (r: Record<string, unknown>) => ({
  ...r,
  is_primary: !!r.is_primary,
  lines: parse<TimedLine[]>(r.lines, []),
  structure: parse<string[] | null>(r.structure, null),
  audio_url: audioUrl(r.audio_key as string),
});

async function uniqueSlug(db: D1Database, text: string, exceptId = '') {
  const base = slugify(text) || 'tarana';
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const hit = await db.prepare('SELECT 1 FROM songs WHERE slug = ? AND id <> ?').bind(slug, exceptId).first();
    if (!hit) return slug;
  }
}

async function snapshot(c: Ctx, songId: string) {
  const row = await c.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(songId).first();
  if (row) await c.env.DB.prepare('INSERT INTO song_versions (song_id, snapshot, actor) VALUES (?, ?, ?)').bind(songId, json(row), c.get('adminEmail')).run();
}

/* ---------- Dashboard ---------- */
adminRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  const [states, subs, recs, recent] = await Promise.all([
    db.prepare('SELECT publish_state AS k, COUNT(*) AS n FROM songs GROUP BY publish_state').all<{ k: string; n: number }>(),
    db.prepare("SELECT type AS k, COUNT(*) AS n FROM submissions WHERE status = 'pending' GROUP BY type").all<{ k: string; n: number }>(),
    db.prepare('SELECT COUNT(*) AS total, SUM(sync_level = 1) AS synced FROM recordings').first<{ total: number; synced: number }>(),
    db.prepare('SELECT actor, action, entity, created_at FROM audit_log ORDER BY id DESC LIMIT 8').all(),
  ]);
  const issues = await db.prepare("SELECT COUNT(*) AS n FROM songs WHERE issues <> '[]'").first<{ n: number }>();
  return c.json({
    songs: Object.fromEntries(states.results.map((r) => [r.k, r.n])),
    pending: Object.fromEntries(subs.results.map((r) => [r.k, r.n])),
    recordings: { total: recs?.total || 0, synced: recs?.synced || 0 },
    issues: issues?.n || 0,
    activity: recent.results,
  });
});

/* ---------- Songs ---------- */
adminRoutes.get('/songs', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const state = c.req.query('state') || '';
  const where: string[] = [];
  const args: unknown[] = [];
  if (STATES.includes(state as never)) { where.push('s.publish_state = ?'); args.push(state); }
  if (state === 'issues') where.push("s.issues <> '[]'");
  if (q) { where.push('(s.title_ro LIKE ? OR s.title_ur LIKE ? OR s.id LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await c.env.DB.prepare(`
    SELECT s.id, s.slug, s.publish_state, s.reviewed, s.title_ur, s.title_ro, s.genre, s.themes, s.mood, s.issues, s.updated_at,
      (SELECT COUNT(*) FROM recordings r WHERE r.song_id = s.id) AS rec_count,
      (SELECT MAX(sync_level) FROM recordings r WHERE r.song_id = s.id) AS synced
    FROM songs s ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.updated_at DESC, s.id LIMIT 500`).bind(...args).all();
  return c.json(rows.results.map((r) => ({
    ...r, themes: parse(r.themes, []), issues: parse(r.issues, []), reviewed: !!r.reviewed, synced: r.synced === 1,
  })));
});

adminRoutes.get('/songs/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const recs = await c.env.DB.prepare('SELECT * FROM recordings WHERE song_id = ? ORDER BY is_primary DESC, created_at').bind(id).all();
  return c.json({ ...songRow(row), recordings: recs.results.map(recRow) });
});

adminRoutes.post('/songs', async (c) => {
  const b = await c.req.json<{ title_ur?: string; title_ro?: string; genre?: string; lyrics_ur?: string; lyrics_ro?: string; youtube_url?: string }>();
  if (!b.title_ur?.trim() && !b.title_ro?.trim()) return c.json({ error: 'Give a title in Urdu or Roman.' }, 400);
  const id = newId('t');
  const doc = docFromPaste(b.lyrics_ur, b.lyrics_ro);
  await c.env.DB.prepare(`INSERT INTO songs (id, slug, publish_state, title_ur, title_ro, genre, mood, doc, issues)
    VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)`).bind(
    id, await uniqueSlug(c.env.DB, b.title_ro || b.title_ur || id), b.title_ur?.trim() || null, b.title_ro?.trim() || null,
    b.genre || null, deriveMood(b.genre, []), json(doc), json(doc.sections.length ? docErrors(doc) : []),
  ).run();
  const yt = parseYouTubeId(b.youtube_url);
  if (yt) await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, youtube_id, source_url, label) VALUES (?, ?, 'youtube', ?, ?, 'YouTube')").bind(newId('rec'), id, yt, b.youtube_url).run();
  await audit(c as Ctx, 'create', id);
  return c.json({ id });
});

const EDITABLE = ['title_ur', 'title_ro', 'genre', 'themes', 'mood', 'mood_locked', 'poet_ur', 'poet_ro', 'singer', 'tags', 'doc', 'reviewed', 'review_reason'] as const;

adminRoutes.put('/songs/:id', async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<Record<string, unknown>>();
  const cur = await c.env.DB.prepare('SELECT genre, themes, mood_locked FROM songs WHERE id = ?').bind(id).first<{ genre: string; themes: string; mood_locked: number }>();
  if (!cur) return c.json({ error: 'Not found' }, 404);
  await snapshot(c as Ctx, id);
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const k of EDITABLE) {
    if (!(k in b)) continue;
    let v = b[k];
    if (k === 'themes' || k === 'tags' || k === 'doc') v = json(v);
    else if (k === 'reviewed' || k === 'mood_locked') v = v ? 1 : 0;
    else if (typeof v === 'string') v = v.trim() || null;
    sets.push(`${k} = ?`);
    args.push(v ?? null);
  }
  if ('doc' in b) { sets.push('issues = ?'); args.push(json(docErrors(b.doc as SongDoc))); }
  const locked = 'mood_locked' in b ? !!b.mood_locked : !!cur.mood_locked;
  if (!locked && ('genre' in b || 'themes' in b)) {
    sets.push('mood = ?');
    args.push(deriveMood(('genre' in b ? b.genre : cur.genre) as string, ('themes' in b ? b.themes : parse(cur.themes, [])) as string[]));
  }
  if (!sets.length) return c.json({ ok: true });
  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare(`UPDATE songs SET ${sets.join(', ')} WHERE id = ?`).bind(...args, id).run();
  await audit(c as Ctx, 'edit', id, Object.keys(b));
  return c.json({ ok: true });
});

adminRoutes.post('/songs/:id/state', async (c) => {
  const id = c.req.param('id');
  const { state } = await c.req.json<{ state: string }>();
  if (!STATES.includes(state as never)) return c.json({ error: 'Unknown state' }, 400);
  await c.env.DB.prepare(`UPDATE songs SET publish_state = ?, updated_at = datetime('now')${state === 'published' ? ", published_at = datetime('now')" : ''} WHERE id = ?`).bind(state, id).run();
  await audit(c as Ctx, `state:${state}`, id);
  return c.json({ ok: true });
});

adminRoutes.delete('/songs/:id', async (c) => {
  const id = c.req.param('id');
  await snapshot(c as Ctx, id);
  const recs = await c.env.DB.prepare('SELECT audio_key FROM recordings WHERE song_id = ?').bind(id).all<{ audio_key: string | null }>();
  for (const r of recs.results) if (r.audio_key && !r.audio_key.startsWith('samples/')) await c.env.MEDIA.delete(r.audio_key);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM recordings WHERE song_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id),
  ]);
  await audit(c as Ctx, 'delete', id);
  return c.json({ ok: true });
});

/* ---------- Recordings & timing ---------- */
adminRoutes.post('/songs/:id/recordings', async (c) => {
  const songId = c.req.param('id');
  const body = await c.req.parseBody();
  const label = String(body.label || '').trim() || null;
  const recId = newId('rec');
  const hasPrimary = await c.env.DB.prepare('SELECT 1 FROM recordings WHERE song_id = ? AND is_primary = 1').bind(songId).first();
  const primary = hasPrimary ? 0 : 1;
  const file = body.file;
  if (file instanceof File) {
    const ext = AUDIO_EXT[file.type] || file.name.split('.').pop()?.toLowerCase();
    if (!ext || !Object.values(AUDIO_EXT).includes(ext)) return c.json({ error: 'Upload an audio file (mp3, m4a, ogg, opus, wav, webm).' }, 400);
    if (file.size > MAX_AUDIO) return c.json({ error: 'Audio is over 40 MB.' }, 400);
    const key = `audio/${songId}/${recId}.${ext}`;
    await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'audio/mpeg', cacheControl: 'public, max-age=31536000, immutable' } });
    const duration = Number(body.duration_ms) || null;
    await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, audio_key, label, duration_ms, is_primary) VALUES (?, ?, 'audio', ?, ?, ?, ?)")
      .bind(recId, songId, key, label || file.name, duration, primary).run();
  } else {
    const yt = parseYouTubeId(body.youtube_url);
    if (!yt) return c.json({ error: 'Add an audio file or a valid YouTube link.' }, 400);
    await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, youtube_id, source_url, label, is_primary) VALUES (?, ?, 'youtube', ?, ?, ?, ?)")
      .bind(recId, songId, yt, String(body.youtube_url), label || 'YouTube', primary).run();
  }
  await c.env.DB.prepare("UPDATE songs SET updated_at = datetime('now') WHERE id = ?").bind(songId).run();
  await audit(c as Ctx, 'add-recording', songId, recId);
  return c.json({ id: recId });
});

adminRoutes.put('/recordings/:rid/timing', async (c) => {
  const rid = c.req.param('rid');
  const b = await c.req.json<{ lines: TimedLine[]; structure?: string[] | null; duration_ms?: number }>();
  const lines = (b.lines || [])
    .filter((l) => Number.isFinite(l.start_ms) && l.start_ms >= 0 && typeof l.section === 'string')
    .map((l) => ({ occ: l.occ | 0, section: l.section, line: l.line | 0, start_ms: Math.round(l.start_ms), end_ms: Number.isFinite(l.end_ms) ? Math.round(l.end_ms as number) : null }))
    .sort((a, b2) => a.start_ms - b2.start_ms);
  await c.env.DB.prepare("UPDATE recordings SET lines = ?, structure = ?, sync_level = ?, timing_source = 'studio', duration_ms = COALESCE(?, duration_ms), updated_at = datetime('now') WHERE id = ?")
    .bind(json(lines), b.structure ? json(b.structure) : null, lines.length ? 1 : 0, b.duration_ms ? Math.round(b.duration_ms) : null, rid).run();
  await audit(c as Ctx, 'timing', rid, { lines: lines.length });
  return c.json({ ok: true, lines: lines.length });
});

adminRoutes.post('/recordings/:rid/primary', async (c) => {
  const rid = c.req.param('rid');
  const r = await c.env.DB.prepare('SELECT song_id FROM recordings WHERE id = ?').bind(rid).first<{ song_id: string }>();
  if (!r) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE recordings SET is_primary = 0 WHERE song_id = ?').bind(r.song_id),
    c.env.DB.prepare('UPDATE recordings SET is_primary = 1 WHERE id = ?').bind(rid),
  ]);
  return c.json({ ok: true });
});

adminRoutes.delete('/recordings/:rid', async (c) => {
  const rid = c.req.param('rid');
  const r = await c.env.DB.prepare('SELECT audio_key, song_id FROM recordings WHERE id = ?').bind(rid).first<{ audio_key: string | null; song_id: string }>();
  if (!r) return c.json({ error: 'Not found' }, 404);
  if (r.audio_key && !r.audio_key.startsWith('samples/')) await c.env.MEDIA.delete(r.audio_key);
  await c.env.DB.prepare('DELETE FROM recordings WHERE id = ?').bind(rid).run();
  await audit(c as Ctx, 'delete-recording', r.song_id, rid);
  return c.json({ ok: true });
});

/* ---------- GitHub Actions: ingest + publish ---------- */
async function dispatch(c: Ctx, workflow: string, inputs: Record<string, string | boolean>) {
  if (!c.env.GH_TOKEN || !c.env.GH_REPO) return { ok: false, error: 'GitHub is not connected. Set GH_TOKEN and GH_REPO secrets (see DEPLOY.md).' };
  const res = await fetch(`https://api.github.com/repos/${c.env.GH_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${c.env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'taraney-admin', 'x-github-api-version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main', inputs }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `GitHub refused (${res.status}): ${(await res.text()).slice(0, 200)}` };
}

adminRoutes.post('/recordings/:rid/ingest', async (c) => {
  const rid = c.req.param('rid');
  const rec = await c.env.DB.prepare('SELECT song_id, youtube_id FROM recordings WHERE id = ?').bind(rid).first<{ song_id: string; youtube_id: string | null }>();
  if (!rec?.youtube_id) return c.json({ error: 'Only YouTube recordings can be fetched.' }, 400);
  const { timing = true } = await c.req.json<{ timing?: boolean }>().catch(() => ({ timing: true }));
  const jobId = newId('job');
  await c.env.DB.prepare("INSERT INTO jobs (id, type, status, step, input, song_id) VALUES (?, 'ingest', 'queued', 'waiting for GitHub', ?, ?)")
    .bind(jobId, json({ recording_id: rid, timing }), rec.song_id).run();
  const r = await dispatch(c as Ctx, 'ingest.yml', { recording_id: rid, job_id: jobId, timing });
  if (!r.ok) {
    await c.env.DB.prepare("UPDATE jobs SET status = 'failed', error = ? WHERE id = ?").bind(r.error, jobId).run();
    return c.json({ error: `${r.error} Locally you can run: npm run ingest -- --recording ${rid} --job ${jobId} --local` }, 400);
  }
  await audit(c as Ctx, 'ingest', rid, { job: jobId });
  return c.json({ ok: true, job_id: jobId });
});

adminRoutes.post('/publish', async (c) => {
  const r = await dispatch(c as Ctx, 'publish.yml', {});
  if (!r.ok) return c.json({ error: `${r.error} Locally: npm run deploy` }, 400);
  await audit(c as Ctx, 'publish', 'site');
  return c.json({ ok: true });
});

adminRoutes.get('/jobs', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, type, status, step, error, input, song_id, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT 30').all();
  return c.json(rows.results.map((r) => ({ ...r, input: parse(r.input, {}) })));
});

/* ---------- Submissions (from readers) ---------- */
adminRoutes.get('/submissions', async (c) => {
  const type = c.req.query('type') || '';
  const status = c.req.query('status') || 'pending';
  const rows = await c.env.DB.prepare(`
    SELECT x.*, s.title_ur, s.title_ro, s.doc FROM submissions x LEFT JOIN songs s ON s.id = x.song_id
    WHERE x.status = ? ${type ? 'AND x.type = ?' : ''} ORDER BY x.created_at DESC LIMIT 200`)
    .bind(...(type ? [status, type] : [status])).all();
  return c.json(rows.results.map((r) => ({ ...r, payload: parse(r.payload, {}), doc: parse(r.doc, null) })));
});

adminRoutes.post('/submissions/:sid', async (c) => {
  const sid = c.req.param('sid');
  const { action, edit } = await c.req.json<{ action: 'approve' | 'reject'; edit?: Record<string, string> }>();
  const sub = await c.env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(sid).first<{ id: string; type: string; song_id: string | null; payload: string; status: string }>();
  if (!sub || sub.status !== 'pending') return c.json({ error: 'Not pending' }, 400);
  const p = { ...parse<Record<string, string>>(sub.payload, {}), ...(edit || {}) };
  let result: Record<string, unknown> = {};

  if (action === 'approve') {
    if (sub.type === 'lyrics_fix') {
      const row = await c.env.DB.prepare('SELECT doc FROM songs WHERE id = ?').bind(sub.song_id).first<{ doc: string }>();
      if (!row) return c.json({ error: 'Song no longer exists' }, 400);
      const doc = parse<SongDoc>(row.doc, { sections: [], structure: [] });
      const line = doc.sections.find((s) => s.id === p.section)?.lines[Number(p.line)];
      if (!line) return c.json({ error: 'That line no longer exists' }, 400);
      if (p.proposed_ur !== undefined && p.proposed_ur !== '') line.ur = p.proposed_ur;
      if (p.proposed_ro !== undefined && p.proposed_ro !== '') line.ro = p.proposed_ro;
      await snapshot(c as Ctx, sub.song_id!);
      await c.env.DB.prepare("UPDATE songs SET doc = ?, issues = ?, updated_at = datetime('now') WHERE id = ?").bind(json(doc), json(docErrors(doc)), sub.song_id).run();
      result = { song_id: sub.song_id };
    } else if (sub.type === 'tarana') {
      const id = newId('t');
      const doc = docFromPaste(p.lyrics_ur, p.lyrics_ro);
      await c.env.DB.prepare("INSERT INTO songs (id, slug, publish_state, title_ur, title_ro, poet_ro, doc, issues, mood) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, 'generic')")
        .bind(id, await uniqueSlug(c.env.DB, p.title_ro || p.title_ur || id), p.title_ur || null, p.title_ro || null, p.poet || null, json(doc), json(docErrors(doc))).run();
      const yt = parseYouTubeId(p.youtube_url);
      if (yt) await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, youtube_id, source_url, label) VALUES (?, ?, 'youtube', ?, ?, 'YouTube (submitted)')").bind(newId('rec'), id, yt, p.youtube_url).run();
      result = { song_id: id };
    } else if (sub.type === 'audio') {
      if (!sub.song_id) return c.json({ error: 'Attach this audio to a song first' }, 400);
      const recId = newId('rec');
      if (p.file_key) {
        const obj = await c.env.PRIVATE.get(p.file_key);
        if (!obj) return c.json({ error: 'Uploaded file is missing' }, 400);
        const key = `audio/${sub.song_id}/${recId}.${p.file_key.split('.').pop()}`;
        await c.env.MEDIA.put(key, obj.body, { httpMetadata: obj.httpMetadata });
        await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, audio_key, label, is_primary) VALUES (?, ?, 'audio', ?, ?, 0)").bind(recId, sub.song_id, key, p.label || 'Submitted audio').run();
      } else {
        const yt = parseYouTubeId(p.youtube_url);
        if (!yt) return c.json({ error: 'No usable audio in this submission' }, 400);
        await c.env.DB.prepare("INSERT INTO recordings (id, song_id, kind, youtube_id, source_url, label, is_primary) VALUES (?, ?, 'youtube', ?, ?, ?, 0)").bind(recId, sub.song_id, yt, p.youtube_url, p.label || 'YouTube (submitted)').run();
      }
      result = { song_id: sub.song_id, recording_id: recId };
    }
  }
  await c.env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ?').bind(action === 'approve' ? 'approved' : 'rejected', sid).run();
  await audit(c as Ctx, `submission:${action}`, sid, result);
  return c.json({ ok: true, ...result });
});
