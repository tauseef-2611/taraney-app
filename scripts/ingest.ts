// Ingest one YouTube recording: download audio, normalise, upload to R2, then use Gemini to
// (a) fill lyrics if the song has none (from the video description, else from the audio) and
// (b) draft line timings. Runs locally via the worker (scripts/worker.ts) or standalone:
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
import { deriveMood } from '../src/lib/mood.ts';
import { slugify } from '../src/lib/slug.ts';

// Auto-load .dev.vars / .env so standalone `npm run ingest` picks up keys without manual export.
function loadDevVars() {
  for (const p of [resolve('.dev.vars'), resolve('.env')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
}
loadDevVars();

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
  let ytInfo = { description: '', ytTitle: '', channel: '', tags: [] as string[] };

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
    const res = await fromYouTube(url, rec, out);
    durationMs = res.durationMs;
    ytInfo = res;
  }
  await aiSteps(rec, out, durationMs, ytInfo);
}

const probeMs = (file: string) => {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(spawnSync(ffmpeg as unknown as string, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr || '');
  return m ? Math.round((+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000) : null;
};

async function fromYouTube(url: string, rec: Record<string, unknown>, out: string) {
  // 1. Download audio + metadata (description). Owner content; no cookies or bot-check workarounds.
  job('running', 'download');
  log(`downloading ${url}`);
  // Discover the best available Python/yt-dlp on this machine.
  // Order: env PYTHON > local venv > py launcher (Windows) > python > python3 > yt-dlp standalone.
  const py = (() => {
    if (process.env.PYTHON) return { cmd: process.env.PYTHON, args: ['-m', 'yt_dlp'] };
    const venv = existsSync('../taraney/.venv/Scripts/python.exe')
      ? '../taraney/.venv/Scripts/python.exe'
      : existsSync('.venv/Scripts/python.exe') ? '.venv/Scripts/python.exe' : null;
    if (venv) return { cmd: venv, args: ['-m', 'yt_dlp'] };
    // Windows: `py -3` hits the Python Launcher; faster than hunting PATH
    if (process.platform === 'win32') {
      const pyLauncher = spawnSync('py', ['-3', '--version'], { encoding: 'utf8', shell: false });
      if (pyLauncher.status === 0) return { cmd: 'py', args: ['-3', '-m', 'yt_dlp'] };
      // Standalone yt-dlp.exe on Windows
      const ytDlpExe = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8', shell: false });
      if (ytDlpExe.status === 0) return { cmd: 'yt-dlp', args: [] };
      // Standard python.exe on Windows
      const pyExe = spawnSync('python', ['--version'], { encoding: 'utf8', shell: false });
      if (pyExe.status === 0) return { cmd: 'python', args: ['-m', 'yt_dlp'] };
    }
    return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
  })();
  const ytArgs = [
    ...py.args,
    '--ignore-config', '--no-playlist', '--no-progress', '-x', '--audio-format', 'm4a',
    '--ffmpeg-location', ffmpeg as unknown as string, '--write-info-json',
    '-o', join(WORK, 'source.%(ext)s'), '--', url,
  ];
  const dl = spawnSync(py.cmd, ytArgs, { encoding: 'utf8', shell: false });
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
  return {
    durationMs,
    description: String(info.description || ''),
    ytTitle: String(info.title || ''),
    channel: String(info.channel || info.uploader || ''),
    tags: Array.isArray(info.tags) ? (info.tags as string[]) : [],
  };
}

async function aiSteps(
  rec: Record<string, unknown>,
  out: string,
  durationMs: number | null,
  ytInfo: { description: string; ytTitle?: string; channel?: string; tags?: string[] }
) {
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
    const existingSongRows = read(`SELECT id, slug, title_ro, title_ur, genre, themes, mood, singer, poet_ro, poet_ur, doc FROM songs WHERE id = ${q(rec.song_id)}`);
    const song = existingSongRows[0] || {};
    let doc = JSON.parse((song.doc as string) || (rec.doc as string) || '{"sections":[],"structure":[]}');
    const hasLyrics = !!doc.sections?.length;

    const description = (ytInfo.description || '').slice(0, 8000) || '(no description available; transcribe from audio)';
    const ytTitle = ytInfo.ytTitle || '';
    const channel = ytInfo.channel || '';

    // 4. AI Transcription & Complete Metadata Extraction
    job('running', hasLyrics ? 'metadata' : 'lyrics & metadata');
    log(hasLyrics ? 'analyzing song & extracting metadata with Gemini' : 'drafting lyrics and metadata with Gemini');

    const promptText = hasLyrics
      ? `You are an expert Urdu taraney/nasheeds cataloguer. Below is the audio and video info for an existing tarana that already has lyrics.
Analyze the song audio, video title, channel, description, and existing lyrics to extract complete and accurate metadata.

YOUTUBE TITLE: ${ytTitle || '(none)'}
CHANNEL / ARTIST: ${channel || '(none)'}
EXISTING TITLE: ${song.title_ro || song.title_ur || '(none)'}
DESCRIPTION:
<<<
${description}
>>>

Tasks:
1. title_ur: Clean, authentic poetic title in Urdu script. Strip clickbait or technical tags.
2. title_ro: Natural Roman Urdu title.
3. singer: Vocalist / munshid name from description, channel, or audio.
4. poet_ur: Poet/lyricist name in Urdu script if credited or identifiable, else null.
5. poet_ro: Poet name in Roman Urdu, else null.
6. genre: One of: hamd, naat, dua, tarana, nazm, ghazal, manqabat, bachon-ki-nazm.
7. themes: JSON array of 2 to 5 themes. Prioritize matching keys from:
   ["tawheed", "seerat", "quran", "ramzan", "akhirat", "bedari", "naujawan", "himmat", "tawakkul", "ittehad", "adl-o-insaf", "dawat", "tanzeem", "shakhsiyat", "islah-e-muashra", "istemar", "falasteen", "burma", "bharat", "walidain", "bachpan", "tareekh", "ishq-e-rasool", "khudi", "ijtima"]
   plus concise custom themes if relevant (e.g. "shahadat", "kashmir", "watan").
8. mood: One of: sukoon, aqeedat, josh, fikr, gham, masoom, generic.`
      : `You transcribe Urdu taraney (songs/nasheeds) and extract complete metadata for a public archive.
Audio is provided. Below is the video title, channel, and description.

YOUTUBE TITLE: ${ytTitle || '(none)'}
CHANNEL / ARTIST: ${channel || '(none)'}
DESCRIPTION:
<<<
${description}
>>>

Instructions:
1. ur: Urdu script lines in the order they are SUNG in the audio. Separate stanzas with ONE blank line. Identical lines for repeated refrains.
2. ro: Roman Urdu lines matching ur line for line.
3. title_ur: Clean, authentic poetic title in Urdu script (e.g. "وہ سحر ضرور آئے گی"). Remove clickbait/channel tags like "Official Video", "HD 1080p", "4K", "New Kalam".
4. title_ro: Natural Roman Urdu title (e.g. "Woh Sehar Zaroor Aaye Gi").
5. singer: Name of the singer/vocalist/munshid/qari if identifiable, else null.
6. poet_ur: Poet/lyricist name in Urdu script if credited or known, else null.
7. poet_ro: Poet name in Roman Urdu, else null.
8. genre: One of: hamd, naat, dua, tarana, nazm, ghazal, manqabat, bachon-ki-nazm.
9. themes: Array of 2 to 5 relevant themes (e.g. ["tawheed", "seerat", "quran", "ramzan", "akhirat", "bedari", "naujawan", "himmat", "tawakkul", "ittehad", "adl-o-insaf", "dawat", "tanzeem", "shakhsiyat", "islah-e-muashra", "istemar", "falasteen", "burma", "bharat", "walidain", "bachpan", "tareekh", "ishq-e-rasool", "khudi", "ijtima", "shahadat"]).
10. mood: One of: sukoon, aqeedat, josh, fikr, gham, masoom, generic.`;

    const schemaProperties: Record<string, { type: typeof Type.STRING | typeof Type.ARRAY; items?: { type: typeof Type.STRING } }> = {
      title_ur: { type: Type.STRING },
      title_ro: { type: Type.STRING },
      singer: { type: Type.STRING },
      poet_ur: { type: Type.STRING },
      poet_ro: { type: Type.STRING },
      genre: { type: Type.STRING },
      themes: { type: Type.ARRAY, items: { type: Type.STRING } },
      mood: { type: Type.STRING },
    };

    if (!hasLyrics) {
      schemaProperties.ur = { type: Type.STRING };
      schemaProperties.ro = { type: Type.STRING };
    }

    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [audioPart, { text: promptText }] }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: hasLyrics ? ['title_ro'] : ['ur', 'ro'],
          properties: schemaProperties,
        },
      },
    });

    const r = JSON.parse(res.text || '{}') as {
      ur?: string; ro?: string; title_ro?: string; title_ur?: string;
      singer?: string; poet_ur?: string; poet_ro?: string; genre?: string;
      themes?: string[]; mood?: string;
    };

    if (!hasLyrics && r.ur && r.ro) {
      doc = docFromPaste(r.ur, r.ro);
    }

    // Determine titles, handling placeholder titles gracefully
    const currentTitleRo = String(song.title_ro || '');
    const isPlaceholderTitle = !currentTitleRo || currentTitleRo.startsWith('New Tarana') || currentTitleRo.startsWith('Draft Tarana') || currentTitleRo.startsWith('rec-');
    const finalTitleRo = isPlaceholderTitle ? (r.title_ro || currentTitleRo) : currentTitleRo;
    const finalTitleUr = song.title_ur || r.title_ur || null;

    const existingThemes = (() => { try { return JSON.parse(song.themes as string || '[]'); } catch { return []; } })();
    const mergedThemes = Array.from(new Set([...existingThemes, ...(r.themes || [])])).slice(0, 8);
    const finalMood = r.mood || deriveMood(r.genre || song.genre as string, mergedThemes);

    const updates = [
      `title_ro = ${q(finalTitleRo || null)}`,
      `title_ur = ${q(finalTitleUr || null)}`,
      `singer = COALESCE(singer, ${q(r.singer || null)})`,
      `poet_ur = COALESCE(poet_ur, ${q(r.poet_ur || null)})`,
      `poet_ro = COALESCE(poet_ro, ${q(r.poet_ro || null)})`,
      `genre = COALESCE(genre, ${q(r.genre || null)})`,
      `themes = ${q(JSON.stringify(mergedThemes))}`,
      `mood = COALESCE(mood, ${q(finalMood)})`,
      `updated_at = datetime('now')`,
    ];

    if (!hasLyrics && doc.sections?.length) {
      updates.push(`doc = ${q(JSON.stringify(doc))}`);
      updates.push(`issues = ${q(JSON.stringify(docErrors(doc)))}`);
      updates.push(`review_reason = 'Lyrics & metadata drafted by AI from YouTube'`);
    }

    const currentSlug = String(song.slug || '');
    if ((currentSlug.startsWith('new-tarana') || currentSlug.startsWith('draft-tarana') || currentSlug.startsWith('tarana-')) && finalTitleRo) {
      const newSlug = slugify(finalTitleRo);
      if (newSlug) updates.push(`slug = ${q(newSlug)}`);
    }

    sql(`UPDATE songs SET ${updates.join(', ')} WHERE id = ${q(rec.song_id)};`);
    log(`metadata and lyrics updated: title "${finalTitleRo}", mood "${finalMood}", ${doc.sections?.length || 0} stanzas`);

    // 5. Draft line timings for the sung order.
    if (!NO_TIMING && doc.sections?.length) {
      job('running', 'timing');
      const lines = expandSung(doc).flatMap((b) => b.lines.map((l) => ({
        key: `${b.occ}:${l.line}`,
        occ: b.occ,
        section: b.section,
        line: l.line,
        text: l.ur || l.ro,
      })));
      log(`drafting timings for ${lines.length} lines`);
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [audioPart, { text:
`You are aligning an existing lyric sheet to this audio. The lyric sheet may be in the
wrong order, so do NOT assume candidate order is singing order and do NOT rewrite,
correct, merge, or invent lyrics.

For every candidate line that is clearly sung, return its exact key and the timestamp
where that line begins. Use the supplied lyric text only to recognize the line. A repeated
refrain has a different key for each occurrence and must be matched separately. If a
candidate is not sung or cannot be identified confidently, omit it. Return results in
chronological audio order, not candidate order. Measure timestamps from the audio; never
space them evenly. Use the exact keys supplied below:
${lines.map((l) => `${l.key} | ${l.text || '(empty lyric line)'}`).join('\n')}` }] }],
        config: { temperature: 0, responseMimeType: 'application/json', responseSchema: {
          type: Type.ARRAY, items: { type: Type.OBJECT, required: ['key', 'start_ms'], properties: { key: { type: Type.STRING }, start_ms: { type: Type.INTEGER } } } } },
      });
      const candidates = new Map(lines.map((l) => [l.key, l]));
      const seen = new Set<string>();
      const matches = JSON.parse(res.text || '[]') as { key: string; start_ms: number }[];
      const timed = matches
        .filter((m) => {
          if (!candidates.has(m.key) || seen.has(m.key) || !Number.isFinite(m.start_ms)) return false;
          if (m.start_ms < 0 || (durationMs != null && m.start_ms >= durationMs)) return false;
          seen.add(m.key);
          return true;
        })
        .sort((a, b) => a.start_ms - b.start_ms)
        .map((m) => {
          const l = candidates.get(m.key)!;
          return { occ: l.occ, section: l.section, line: l.line, start_ms: Math.round(m.start_ms), end_ms: null };
        });
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
