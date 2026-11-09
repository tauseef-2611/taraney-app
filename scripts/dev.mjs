// Full local dev: Pages Functions + local D1/R2 on :8788, Astro (HMR) on :4321 proxying /api to it.
//   npm run dev:full   then open http://localhost:4321/admin
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const win = process.platform === 'win32';
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: win });

if (!existsSync('dist')) mkdirSync('dist'); // wrangler needs the folder; Astro serves pages in dev
const fn = run('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '8788', '--show-interactive-dev-session=false']);
const site = run('npx', ['astro', 'dev']);
// On Windows, kill() leaves grandchildren (workerd, astro) running and locking local D1; kill the tree.
const killTree = (p) => {
  if (!p.pid || p.exitCode !== null) return;
  if (win) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else p.kill();
};
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; killTree(fn); killTree(site); setTimeout(() => process.exit(), 500); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
fn.on('exit', stop);
site.on('exit', stop);
