// Exports songs from D1 into src/data/songs.generated.json for the static Astro build.
//   npm run content          local D1, includes drafts (marked "Unreviewed draft") for development
//   npm run content:prod     remote D1, published songs only (used by the publish workflow)
import { mkdirSync, writeFileSync } from 'node:fs';
import { d1Read } from './d1.ts';

const remote = process.argv.includes('--remote');
const all = process.argv.includes('--all') || (!remote && !process.argv.includes('--published'));
const states = all ? "('draft','review','published')" : "('published')";
const query = (sql: string) => d1Read(remote, sql);
const parse = (s: unknown, d: unknown) => { try { return typeof s === 'string' ? JSON.parse(s) : d; } catch { return d; } };
const audioUrl = (key: string | null) => (!key ? null : key.startsWith('samples/') ? `/${key}` : `/api/media/${key}`);

const songs = query(`SELECT id, slug, publish_state, reviewed, title_ur, title_ro, genre, themes, mood, poet_ur, poet_ro, singer, doc, created_at, updated_at, published_at
  FROM songs WHERE publish_state IN ${states} ORDER BY COALESCE(published_at, created_at) DESC, id`);
const recs = query(`SELECT r.id, r.song_id, r.kind, r.audio_key, r.youtube_id, r.label, r.duration_ms, r.is_primary, r.sync_level, r.structure, r.lines
  FROM recordings r JOIN songs s ON s.id = r.song_id WHERE s.publish_state IN ${states} ORDER BY r.is_primary DESC, r.created_at`);

const bySong = new Map<string, unknown[]>();
for (const r of recs) {
  const list = bySong.get(r.song_id as string) || [];
  list.push({
    id: r.id, kind: r.kind, audio_url: audioUrl(r.audio_key as string), youtube_id: r.youtube_id, label: r.label,
    duration_ms: r.duration_ms, is_primary: !!r.is_primary, sync_level: r.sync_level ? 1 : 0,
    structure: parse(r.structure, null), lines: parse(r.lines, []),
  });
  bySong.set(r.song_id as string, list);
}

const data = songs
  .map((s) => ({
    ...s,
    reviewed: !!s.reviewed,
    themes: parse(s.themes, []),
    doc: parse(s.doc, { sections: [], structure: [] }),
    recordings: bySong.get(s.id as string) || [],
  }))
  .filter((s) => s.doc.sections?.length);

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/songs.generated.json', JSON.stringify({ generated_at: new Date().toISOString(), songs: data }));
console.log(`Exported ${data.length} songs (${all ? 'drafts included' : 'published only'}) from ${remote ? 'remote' : 'local'} D1.`);
