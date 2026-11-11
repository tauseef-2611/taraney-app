// Local PC worker for taraney ingest jobs.
//
// ORCHESTRATOR mode (npm run worker):
//   - Checks the queue depth in D1 (remote)
//   - Suggests how many parallel workers to run based on job count:
//       1-2 pending  → suggests 1 worker
//       3-5 pending  → suggests 2 workers
//       6+ pending   → suggests 3 workers
//   - Asks for your approval and how many workers to open
//   - Opens that many new terminal windows (Windows: conhost/cmd; macOS: Terminal), each running
//     this same script in --process mode
//   - Stays alive watching their status and plays a sound when all done
//
// PROCESS mode (run internally, one per terminal):
//   - Loops: atomically claims next queued job → runs ingest → repeats until queue empty
//   - If interactive (default), asks per-job before running
//   - If --auto, runs every job without asking
//
// Usage:
//   npm run worker           interactive orchestrator — asks permission and opens windows
//   npm run worker:auto      orchestrator in auto mode — no per-job prompts
//   (internal) node --no-warnings --experimental-strip-types scripts/worker.ts --process [--auto] [--worker-id N]
//
import { spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { d1Read, d1Write, q } from './d1.ts';

// ─── env setup ───────────────────────────────────────────────────────────────
// Auto-load .dev.vars (KEY=VALUE lines, bash-style) so the worker inherits
// GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, etc. without manual export.
function loadDevVars() {
  const paths = [resolve('.dev.vars'), resolve('.env')];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }
}
loadDevVars();

// ─── argument parsing ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const IS_PROCESS = argv.includes('--process');
const IS_AUTO    = argv.includes('--auto');
const WORKER_ID  = Number(argv[argv.indexOf('--worker-id') + 1] ?? 1);
const IS_WIN     = process.platform === 'win32';

// ─── helpers ─────────────────────────────────────────────────────────────────
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BELL   = '\x07';

function banner(msg: string, color = CYAN) { console.log(`\n${BOLD}${color}${msg}${RESET}`); }
function info(msg: string)  { console.log(`${DIM}  ${msg}${RESET}`); }
function ok(msg: string)    { console.log(`${GREEN}  ✓ ${msg}${RESET}`); }
function warn(msg: string)  { console.log(`${YELLOW}  ⚠ ${msg}${RESET}`); }
function err(msg: string)   { console.log(`${RED}  ✗ ${msg}${RESET}`); }
function sep()              { console.log(`${DIM}${'─'.repeat(60)}${RESET}`); }

function ask(prompt: string, choices: string[]): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${BOLD}${YELLOW}${prompt}${RESET} [${choices.join('/')}] `, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });
}

// Windows native popup via PowerShell (non-blocking, returns immediately with the button clicked)
function winPopup(title: string, msg: string): 'yes' | 'no' {
  if (!IS_WIN) return 'yes';
  try {
    const r = spawnSync('powershell', [
      '-NoProfile', '-Command',
      `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show(${JSON.stringify(msg)}, ${JSON.stringify(title)}, 'YesNo', 'Question')`,
    ], { encoding: 'utf8', timeout: 60_000 });
    return (r.stdout || '').trim() === 'Yes' ? 'yes' : 'no';
  } catch { return 'yes'; } // fallback: allow
}

// ─── D1 helpers ──────────────────────────────────────────────────────────────
interface QueuedJob {
  id: string;
  status: string;
  input: string;
  song_id: string | null;
  title_ro: string | null;
  title_ur: string | null;
  created_at: string;
}

function countQueued(): number {
  try {
    const rows = d1Read(true, "SELECT COUNT(*) AS n FROM jobs WHERE status = 'queued'");
    return Number((rows[0] as { n: number })?.n ?? 0);
  } catch { return 0; }
}

function peekQueued(): QueuedJob[] {
  try {
    return d1Read(true, `
      SELECT j.id, j.status, j.input, j.song_id, s.title_ro, s.title_ur, j.created_at
      FROM jobs j LEFT JOIN songs s ON s.id = j.song_id
      WHERE j.status = 'queued'
      ORDER BY j.created_at ASC LIMIT 20
    `) as QueuedJob[];
  } catch { return []; }
}

/** Another worker took the job first: try again straight away. */
const LOST = 'lost' as const;

/** Atomically claim the next queued job. Returns the job, null when the queue is empty, or LOST. */
function claimNext(): (QueuedJob & { input_parsed: { recording_id: string; timing?: boolean } }) | null | typeof LOST {
  const rows = d1Read(true, `
    SELECT j.id, j.status, j.input, j.song_id, s.title_ro, s.title_ur, j.created_at
    FROM jobs j LEFT JOIN songs s ON s.id = j.song_id
    WHERE j.status = 'queued'
    ORDER BY j.created_at ASC LIMIT 1
  `) as QueuedJob[];
  if (!rows.length) return null;
  const job = rows[0];
  // Atomic conditional update: only one worker's UPDATE can match while the job is still 'queued'.
  // Each worker writes its own unique token, so the check below tells us whether WE won the race.
  const token = `claimed by local worker W${WORKER_ID}-${Math.random().toString(36).slice(2, 8)}`;
  d1Write(true, `UPDATE jobs SET status = 'running', step = ${q(token)}, updated_at = datetime('now') WHERE id = ${q(job.id)} AND status = 'queued';`);
  const check = d1Read(true, `SELECT status, step FROM jobs WHERE id = ${q(job.id)}`) as { status: string; step: string }[];
  if (!check.length || check[0].status !== 'running' || check[0].step !== token) return LOST;
  let input_parsed = { recording_id: '', timing: true };
  try { input_parsed = JSON.parse(job.input || '{}'); } catch {}
  return { ...job, input_parsed };
}

function markFailed(jobId: string, message: string) {
  try {
    d1Write(true, `UPDATE jobs SET status = 'failed', step = 'failed', error = ${q(message.slice(0, 500))}, updated_at = datetime('now') WHERE id = ${q(jobId)};`);
  } catch {}
}

// ─── optimal worker count ────────────────────────────────────────────────────
const MAX_WORKERS = 4;
function suggestWorkers(queued: number): number {
  if (queued <= 2) return 1;
  if (queued <= 5) return 2;
  if (queued <= 9) return 3;
  return MAX_WORKERS;
}

// ─── run ingest for one job ───────────────────────────────────────────────────
function runIngest(jobId: string, recId: string, timing: boolean): boolean {
  const node = process.execPath;
  const script = resolve('scripts/ingest.ts');
  const args = ['--no-warnings', '--experimental-strip-types', script,
    '--recording', recId, '--job', jobId,
    ...(timing ? [] : ['--no-timing']),
  ];
  // Env inherits from this process (which already loaded .dev.vars)
  const result = spawnSync(node, args, { stdio: 'inherit', env: process.env });
  return result.status === 0;
}

// ─── PROCESS MODE — one worker loop ──────────────────────────────────────────
async function runAsWorker() {
  const prefix = `[W${WORKER_ID}]`;
  banner(`${prefix} Taraney local ingest worker`, CYAN);
  if (!process.env.GEMINI_API_KEY) warn('GEMINI_API_KEY not set — AI steps will be skipped');
  sep();

  let processed = 0;
  let consecutive_empty = 0;

  while (true) {
    const job = claimNext();
    if (job === LOST) { await new Promise((r) => setTimeout(r, 300 + Math.random() * 700)); continue; }

    if (!job) {
      consecutive_empty++;
      if (consecutive_empty === 1) {
        info(`${prefix} No queued jobs found.`);
      } else if (consecutive_empty > 3) {
        ok(`${prefix} Queue is empty — done! Processed ${processed} job(s).`);
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    consecutive_empty = 0;
    const { id: jobId, input_parsed, title_ro, title_ur, song_id } = job;
    const songLabel = title_ro || title_ur || song_id || jobId;
    const recId = input_parsed.recording_id;

    banner(`${prefix} Job ready: ${songLabel}`, YELLOW);
    info(`Job ID:      ${jobId}`);
    info(`Recording:   ${recId}`);
    info(`Timing:      ${input_parsed.timing !== false ? 'yes' : 'no'}`);
    sep();

    if (!IS_AUTO) {
      // Per-job approval prompt (also fires a Windows popup for visibility)
      process.stdout.write(BELL); // terminal bell
      if (IS_WIN) {
        const popup = winPopup(
          `Taraney Worker ${WORKER_ID}: Run job?`,
          `Job: ${songLabel}\nRecording: ${recId}\n\nProcess this ingest job now?`
        );
        if (popup === 'no') {
          warn(`${prefix} Skipped (popup: No) — re-queueing job`);
          d1Write(true, `UPDATE jobs SET status = 'queued', step = 'queued – waiting for local worker', updated_at = datetime('now') WHERE id = ${q(jobId)};`);
          continue;
        }
      } else {
        const ans = await ask(`Run this job? (y=yes, s=skip, q=quit)`, ['Y', 's', 'q']);
        if (ans === 'q') { info(`${prefix} Exiting.`); process.exit(0); }
        if (ans === 's') {
          warn(`${prefix} Skipped — re-queueing job`);
          d1Write(true, `UPDATE jobs SET status = 'queued', step = 'queued – waiting for local worker', updated_at = datetime('now') WHERE id = ${q(jobId)};`);
          continue;
        }
      }
    }

    console.log(`\n${BOLD}${CYAN}${prefix} Starting ingest…${RESET}\n`);
    const success = runIngest(jobId, recId, input_parsed.timing !== false);
    processed++;

    if (success) {
      ok(`${prefix} Finished: ${songLabel}`);
    } else {
      err(`${prefix} Failed: ${songLabel}`);
      // ingest.ts already updates the job status to 'failed'; nothing extra needed
    }
    sep();
  }
}

// ─── ORCHESTRATOR MODE — smart launcher ──────────────────────────────────────
async function runAsOrchestrator() {
  banner('Taraney Local Ingest Worker', CYAN);
  info('Checking job queue (remote D1)…');

  const pending = peekQueued();
  const count = pending.length;

  if (count === 0) {
    ok('No jobs in the queue right now. Queue jobs from the Admin → Job Queue page, then re-run this.');
    process.exit(0);
  }

  const suggested = suggestWorkers(count);
  sep();
  console.log(`${BOLD}${YELLOW}  ${count} job(s) queued:${RESET}`);
  for (const j of pending.slice(0, 8)) {
    const label = j.title_ro || j.title_ur || j.song_id || j.id;
    info(`  · ${label}`);
  }
  if (count > 8) info(`  … and ${count - 8} more`);
  sep();
  console.log(`${BOLD}  Suggested parallel workers: ${suggested}${RESET}`);
  console.log(`${DIM}  (1–2 jobs → 1 worker, 3–5 → 2, 6–9 → 3, 10+ → 4)${RESET}`);
  sep();

  // Ask how many workers to open (or accept suggestion). Never more workers than jobs.
  let workerCount = suggested;
  if (!IS_AUTO) {
    const ans = await ask(
      `Open how many parallel workers? (Enter = ${suggested}, or 1-${MAX_WORKERS}, q = quit)`,
      [`${suggested}`, '1', '2', '3', '4', 'q']
    );
    if (ans === 'q' || ans === 'n') { info('Cancelled.'); process.exit(0); }
    const parsed = parseInt(ans, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_WORKERS) workerCount = parsed;
  }
  workerCount = Math.min(workerCount, count);

  if (workerCount === 0) { info('Nothing to do.'); process.exit(0); }

  sep();
  console.log(`${BOLD}${GREEN}  Opening ${workerCount} worker terminal(s)…${RESET}`);
  const script = resolve('scripts/worker.ts');
  const node   = process.execPath;

  for (let i = 1; i <= workerCount; i++) {
    const args = [
      '--no-warnings', '--experimental-strip-types', script,
      '--process', `--worker-id`, `${i}`,
      ...(IS_AUTO ? ['--auto'] : []),
    ];

    if (IS_WIN) {
      // A one-line `start … cmd /k ""node" "…""` is fragile: cmd's nested-quote rules misparse it and
      // only some windows open. Instead write a small launcher .cmd per worker and start that file.
      mkdirSync(resolve('.wrangler'), { recursive: true });
      const launcher = resolve('.wrangler', `worker-${i}.cmd`);
      writeFileSync(launcher, [
        '@echo off',
        `title Taraney Worker ${i}`,
        `cd /d "${process.cwd()}"`,
        `"${node}" ${args.map((a) => `"${a}"`).join(' ')}`,
        'echo.',
        `echo Worker ${i} has stopped. Press any key to close this window.`,
        'pause >nul',
        '',
      ].join('\r\n'));
      // `start "" file` opens a new console window and returns immediately.
      const r = spawnSync('cmd.exe', ['/d', '/c', 'start', `Taraney Worker ${i}`, launcher], { stdio: 'ignore' });
      if (r.status !== 0) err(`  Could not open window for worker ${i} (exit ${r.status}). Run it by hand: ${launcher}`);
    } else if (process.platform === 'darwin') {
      // macOS Terminal.app
      const cmd = `"${node}" ${args.map((a) => `'${a}'`).join(' ')}`;
      spawnSync('osascript', ['-e', `tell application "Terminal" to do script "${cmd.replace(/"/g, '\\"')}"`], { detached: true });
    } else {
      // Linux: try common terminal emulators
      const term = ['gnome-terminal', 'xterm', 'konsole'].find((t) => spawnSync('which', [t]).status === 0);
      if (term) {
        spawn(term, ['--', node, ...args], { detached: true, stdio: 'ignore' }).unref();
      } else {
        // Fallback: run in background in current process (no separate window)
        spawn(node, args, { detached: true, stdio: 'inherit' }).unref();
      }
    }

    info(`  Worker ${i} launched`);
    // Small stagger so they don't all try to claim the same job simultaneously
    if (i < workerCount) await new Promise((r) => setTimeout(r, 800));
  }

  sep();
  ok(`${workerCount} worker(s) started. Watch the new terminal window(s) for progress.`);
  info('You can also monitor the queue live in Admin → Job Queue.');
  process.exit(0);
}

// ─── entry point ─────────────────────────────────────────────────────────────
if (IS_PROCESS) {
  runAsWorker().catch((e) => { err(String(e)); process.exit(1); });
} else {
  runAsOrchestrator().catch((e) => { err(String(e)); process.exit(1); });
}

