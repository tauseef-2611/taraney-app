// Local-only demo submissions so the Suggestions inbox has something to review.
// Clearly marked "Demo" in the name; never run against production.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const q = (v: unknown) => `'${String(v).replace(/'/g, "''")}'`;
const rows = [
  ['demo-sub-1', 'lyrics_fix', 'p026', { name: 'Demo reader', note: 'The print has a typo here.', section: 'v2', line: '5', current_ur: 'بس ہمیں جزبۂ بندگی دے', current_ro: 'Bas hamein jazba-e bandagi de', proposed_ur: 'بس ہمیں جذبۂ بندگی دے', proposed_ro: '' }],
  ['demo-sub-2', 'lyrics_fix', 'up-3be63c7c72', { name: 'Demo reader', note: 'Roman spelling', section: 'v0', line: '0', current_ro: 'Sabaq phir parh sadaqat ka adalat ka shujaat ka', proposed_ro: 'Sabaq phir padh sadaqat ka, adalat ka, shujaat ka' }],
  ['demo-sub-3', 'audio', 'p026', { name: 'Demo reader', note: 'Our camp recording of this dua', label: 'Camp 2024 version (demo placeholder link)', youtube_url: 'https://youtu.be/demo0000000' }],
  ['demo-sub-4', 'tarana', null, { name: 'Demo reader', note: 'We sing this at every ijtima', title_ro: 'Ae watan ke sajeele jawano', title_ur: 'اے وطن کے سجیلے جوانو', lyrics_ur: 'اے وطن کے سجیلے جوانو\nمیرے نغمے تمہارے لیے ہیں', lyrics_ro: 'Ae watan ke sajeele jawano\nMere naghme tumhare liye hain', poet: '' }],
] as const;

const sql = rows.map(([id, type, song, payload]) =>
  `INSERT OR REPLACE INTO submissions (id, type, song_id, payload, status) VALUES (${q(id)}, ${q(type)}, ${song ? q(song) : 'NULL'}, ${q(JSON.stringify(payload))}, 'pending');`).join('\n');
writeFileSync('.wrangler/seed-demo.sql', sql);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'taraney-db', '--local', '--file=.wrangler/seed-demo.sql', '-y'], { stdio: 'ignore', shell: process.platform === 'win32' });
console.log(`Seeded ${rows.length} demo submissions into LOCAL D1.`);
