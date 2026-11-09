// Ingest one YouTube recording: download audio, normalise, upload to R2, then use Gemini to
// (a) fill lyrics if the song has none (from the video description, else from the audio) and
// (b) draft line timings. Runs in GitHub Actions (ingest.yml) or locally:
//   npm run ingest -- --recording rec-xxxx [--job job-xxxx] [--local] [--no-timing]
// Needs: python -m yt_dlp, GEMINI_API_KEY (unless --no-ai), and wrangler auth for --remote.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { d1Read, d1Write, q, wrangler } from './d1.ts';
import { join, resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { GoogleGenAI, Type, createPartFromUri } from '@google/genai';
import { docFromPaste } from '../src/lib/paste.ts';
import { docErrors, expandSung } from '../src/lib/song-shape.ts';

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const LOCAL = args.includes('--local');
const NO_TIMING = args.includes('--no-timing');
const NO_AI = args.includes('--no-ai');
const recId = arg('recording');
const jobId = arg('job');
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const WORK = resolve('.ingest', recId || 'x');
const shell = process.platform === 'win32';
if (!recId) { console.error('Usage: npm run ingest -- --recording <id> [--job <id>] [--local]'); process.exit(2); }

// Reads return rows (--command); writes go through a file (remote --file returns no rows).
const read = (statement: string) => d1Read(!LOCAL, statement);
const sql = (statement: string) => d1Write(!LOCAL, statement);
const job = (status: string, step: string, extra = '') => {
  if (!jobId) return;
  sql(`UPDATE jobs SET status = ${q(status)}, step = ${q(step)}${extra}, updated_at = datetime('now') WHERE id = ${q(jobId)};`);
};
const log = (s: string) => console.log(`[ingest] ${s}`);

async function main() {
  const rec = read(`SELECT r.id, r.song_id, r.kind, r.audio_key, r.youtube_id, r.source_url, s.doc FROM recordings r JOIN songs s ON s.id = r.song_id WHERE r.id = ${q(recId)}`)[0];
  if (!rec) throw new Error(`Recording ${recId} not found`);
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  const out = join(WORK, 'out.m4a');
  let durationMs: number | null = null;
  let description = '';

  if (rec.audio_key) {
    // Audio already hosted (uploaded in the admin, or ingested before): no YouTube download, AI steps only.
    job('running', 'fetch audio');
    const key = rec.audio_key as string;
    if (key.startsWith('samples/')) copyFileSync(join('public', key), out);
    else {
      log(`fetching ${key} from R2`);
      wrangler(['r2', 'object', 'get', `taraney-media/${key}`, `--file=${out}`, LOCAL ? '--local' : '--remote']);
    }
    durationMs = probeMs(out);
  } else {
    const url = (rec.source_url as string) || (rec.youtube_id ? `https://www.youtube.com/watch?v=${rec.youtube_id}` : '');
    if (!url) throw new Error('Recording has neither audio nor a YouTube link');
    ({ durationMs, description } = await fromYouTube(url, rec, out));
  }
  await aiSteps(rec, out, durationMs, description);
}

const probeMs = (file: string) => {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(spawnSync(ffmpeg as unknown as string, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr || '');
  return m ? Math.round((+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000) : null;
};

async function fromYouTube(url: string, rec: Record<string, unknown>, out: string) {
  // 1. Download audio + metadata (description). Owner content; no cookies or bot-check workarounds.
  job('running', 'download');
  log(`downloading ${url}`);
  const py = process.env.PYTHON || (existsSync('../taraney/.venv/Scripts/python.exe') ? '../taraney/.venv/Scripts/python.exe' : 'python3');
  const dl = spawnSync(py, ['-m', 'yt_dlp', '--ignore-config', '--no-playlist', '--no-progress', '-x', '--audio-format', 'm4a',
    '--ffmpeg-location', ffmpeg as unknown as string, '--write-info-json', '-o', join(WORK, 'source.%(ext)s'), '--', url], { encoding: 'utf8' });
  const src = readdirSync(WORK).find((f) => f.startsWith('source.') && f.endsWith('.m4a'));
  if (dl.status !== 0 || !src) {
    const detail = (dl.stderr || '').trim().split('\n').slice(-2).join(' ');
    throw new Error(`YouTube download failed. Upload the audio file in the admin instead. ${detail}`);
  }
  const info = JSON.parse(readFileSync(join(WORK, 'source.info.json'), 'utf8'));

  // 2. Normalise loudness, AAC 96k, faststart (seekable).
  job('running', 'normalise');
  const ff = spawnSync(ffmpeg as unknown as string, ['-y', '-hide_banner', '-i', join(WORK, src), '-vn', '-map_metadata', '-1',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (ff.status !== 0) throw new Error(`ffmpeg failed: ${(ff.stderr || '').split('\n').slice(-2).join(' ')}`);
  const durationMs = probeMs(out);

  // 3. Upload to R2.
  job('running', 'upload');
  const key = `audio/${rec.song_id}/${recId}.m4a`;
  log(`uploading to R2 ${key}`);
  wrangler(['r2', 'object', 'put', `taraney-media/${key}`, `--file=${out}`, '--content-type=audio/mp4',
    '--cache-control=public, max-age=31536000, immutable', LOCAL ? '--local' : '--remote']);
  sql(`UPDATE recordings SET kind = 'audio', audio_key = ${q(key)}, duration_ms = ${durationMs ?? 'NULL'}, updated_at = datetime('now') WHERE id = ${q(recId)};
       UPDATE songs SET updated_at = datetime('now') WHERE id = ${q(rec.song_id)};`);
  return { durationMs, description: String(info.description || '') };
}

async function aiSteps(rec: Record<string, unknown>, out: string, durationMs: number | null, descriptionIn: string) {
  if (NO_AI || !process.env.GEMINI_API_KEY) {
    log(NO_AI ? 'AI steps skipped (--no-ai)' : 'GEMINI_API_KEY not set: audio ready, no lyrics/timing drafted');
    job('done', 'audio ready');
    return;
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const uploaded = await ai.files.upload({ file: out, config: { mimeType: 'audio/mp4' } });
  let file = uploaded;
  for (let i = 0; file.state === 'PROCESSING' && i < 60; i++) { await new Promise((r) => setTimeout(r, 3000)); file = await ai.files.get({ name: file.name! }); }
  const audioPart = createPartFromUri(file.uri!, file.mimeType!);

  try {
    // 4. Lyrics, only when the song has none: description first, otherwise transcribe the audio.
    let doc = JSON.parse((rec.doc as string) || '{"sections":[],"structure":[]}');
    if (!doc.sections?.length) {
      job('running', 'lyrics');
      const description = descriptionIn.slice(0, 8000) || '(no description available; transcribe from the audio)';
      log('drafting lyrics with Gemini');
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [audioPart, { text:
`You transcribe Urdu taraney (songs) for a lyrics archive. Below is the video description; it may contain the lyrics among credits, links and hashtags.
Return the song lyrics in the order they are SUNG in the audio, including repeated refrains each time they are sung.
- ur: Urdu script lines; ro: Roman Urdu lines (plain ASCII, natural Pakistani/Indian reading). Same number of lines, line for line.
- Separate stanzas with ONE blank line. A repeated refrain must be written identically every time.
- Prefer the description's wording when it matches what is sung; otherwise transcribe what you hear. Never invent lines.
DESCRIPTION:
<<<
${description}
>>>` }] }],
        config: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: {
          type: Type.OBJECT, required: ['ur', 'ro'], properties: { ur: { type: Type.STRING }, ro: { type: Type.STRING }, title_ro: { type: Type.STRING }, title_ur: { type: Type.STRING } } } },
      });
      const r = JSON.parse(res.text || '{}');
      doc = docFromPaste(r.ur, r.ro);
      if (doc.sections.length) {
        sql(`UPDATE songs SET doc = ${q(JSON.stringify(doc))}, issues = ${q(JSON.stringify(docErrors(doc)))},
             title_ur = COALESCE(title_ur, ${q(r.title_ur || null)}), title_ro = COALESCE(title_ro, ${q(r.title_ro || null)}),
             review_reason = 'Lyrics drafted by AI from YouTube; check before publishing', updated_at = datetime('now') WHERE id = ${q(rec.song_id)};`);
        log(`lyrics drafted: ${doc.sections.length} stanzas`);
      }
    }

    // 5. Draft line timings for the sung order.
    if (!NO_TIMING && doc.sections?.length) {
      job('running', 'timing');
      const lines = expandSung(doc).flatMap((b) => b.lines.map((l) => ({ occ: b.occ, section: b.section, line: l.line, text: l.ur || l.ro })));
      log(`drafting timings for ${lines.length} lines`);
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [audioPart, { text:
`Here are the lines of this song in the order they are sung, numbered. For each line give start_ms: the millisecond in the audio where the singer begins that line.
Measure from the audio; never space lines evenly. If a numbered line is not sung, give -1. Return every number once, in order.
${lines.map((l, i) => `${i}: ${l.text}`).join('\n')}` }] }],
        config: { temperature: 0, responseMimeType: 'application/json', responseSchema: {
          type: Type.ARRAY, items: { type: Type.OBJECT, required: ['i', 'start_ms'], properties: { i: { type: Type.INTEGER }, start_ms: { type: Type.INTEGER } } } } },
      });
      const times = new Map((JSON.parse(res.text || '[]') as { i: number; start_ms: number }[]).map((x) => [x.i, x.start_ms]));
      const timed = lines.map((l, i) => ({ occ: l.occ, section: l.section, line: l.line, start_ms: times.get(i) ?? -1, end_ms: null }))
        .filter((l) => l.start_ms >= 0 && (!durationMs || l.start_ms < durationMs))
        .sort((a, b) => a.start_ms - b.start_ms);
      sql(`UPDATE recordings SET lines = ${q(JSON.stringify(timed))}, structure = ${q(JSON.stringify(doc.structure))}, sync_level = ${timed.length ? 1 : 0},
           timing_source = 'gemini', updated_at = datetime('now') WHERE id = ${q(recId)};`);
      log(`timed ${timed.length}/${lines.length} lines (draft: refine in Sync Studio)`);
    }
    job('done', 'audio, lyrics and timing drafted');
  } finally {
    await ai.files.delete({ name: file.name! }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(`[ingest] FAILED: ${e.message}`);
  try { job('failed', 'error', `, error = ${q(String(e.message).slice(0, 500))}`); } catch { /* ignore */ }
  process.exit(1);
});
