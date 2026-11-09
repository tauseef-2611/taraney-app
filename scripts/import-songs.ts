// Imports the POC's song JSON files (and the sample fixture) into D1.
//   npm run db:import:local            (emulated D1 in .wrangler/state)
//   npm run db:import:prod             (remote D1; needs `wrangler login`)
// Options: --dir <path> (default ../taraney/data/songs), --force (overwrite existing rows).
// Every song arrives as an unreviewed draft. Excluded songs keep only id, pages and reason.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deriveMood } from '../src/lib/mood.ts';
import { slugify } from '../src/lib/slug.ts';
import { docErrors } from '../src/lib/song-shape.ts';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const force = args.includes('--force');
const dirArg = args.indexOf('--dir');
const dir = resolve(dirArg >= 0 ? args[dirArg + 1] : '../taraney/data/songs');

const q = (v: unknown) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => q(JSON.stringify(v));

const slugs = new Set<string>();
const uniq = (text: string) => {
  const base = slugify(text) || 'tarana';
  let s = base;
  for (let n = 2; slugs.has(s); n++) s = `${base}-${n}`;
  slugs.add(s);
  return s;
};

const verb = force ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
const sql: string[] = [];
const report = { total: 0, draft: 0, review: 0, rejected: 0, withIssues: [] as string[] };

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const s = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  report.total++;
  const excluded = s.status === 'excluded';
  const doc = excluded
    ? { sections: [], structure: [], notes: [] }
    : { sections: s.sections || [], structure: s.structure || [], notes: s.notes || [] };
  const issues = excluded ? [] : docErrors(doc);
  if (issues.length) report.withIssues.push(`${s.id}: ${issues.join('; ')}`);
  const state = excluded ? 'rejected' : s.status === 'review' ? 'review' : 'draft';
  report[state as 'draft' | 'review' | 'rejected']++;
  sql.push(`${verb} INTO songs (id, slug, publish_state, reviewed, title_ur, title_ro, genre, themes, mood, language, poet_ur, poet_ro, doc, source_pages, review_reason, issues) VALUES (${[
    q(s.id), q(uniq(s.title_ro || s.id)), q(state), 0,
    q(excluded ? null : s.title_ur), q(excluded ? null : s.title_ro),
    q(excluded ? null : s.genre), j(excluded ? [] : s.themes || []),
    q(excluded ? null : deriveMood(s.genre, s.themes || [])), q(s.language || 'ur'),
    q(s.poet?.name_ur), q(s.poet?.name_ro), j(doc), j(s.pdf_pages || []),
    q(s.review_reason), j(issues),
  ].join(', ')});`);
}

// Sample with a real recording and line timings, used by /design and the player.
const sample = JSON.parse(readFileSync('fixtures/sample-song.json', 'utf8'));
const r = sample.recording;
sql.push(`${verb} INTO songs (id, slug, publish_state, title_ur, title_ro, genre, themes, mood, doc, issues) VALUES (${[
  q(sample.id), q(uniq(sample.title_ro)), q('draft'), q(sample.title_ur), q(sample.title_ro), q(sample.genre),
  j(sample.themes), q(deriveMood(sample.genre, sample.themes)), j(sample.doc), j(docErrors(sample.doc)),
].join(', ')});`);
sql.push(`${verb} INTO recordings (id, song_id, kind, audio_key, label, duration_ms, sync_level, timing_source, lines) VALUES (${[
  q(r.id), q(sample.id), q('audio'), q('samples/hum-duniya.m4a'), q(r.label), r.duration_ms, 1, q(r.timing_source), j(r.lines),
].join(', ')});`);

mkdirSync('.wrangler', { recursive: true });
const out = resolve('.wrangler/import.sql');
writeFileSync(out, sql.join('\n') + '\n');

execFileSync('npx', ['wrangler', 'd1', 'execute', 'taraney-db', remote ? '--remote' : '--local', `--file=${out}`, '-y'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

console.log(`\nImported ${report.total} songs + 1 sample into ${remote ? 'REMOTE' : 'local'} D1:`
  + ` ${report.draft} draft, ${report.review} review, ${report.rejected} rejected (no lyrics stored).`);
if (report.withIssues.length) console.log(`Needs fixing (${report.withIssues.length}):\n  ${report.withIssues.join('\n  ')}`);
