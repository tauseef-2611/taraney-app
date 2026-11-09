// D1 access for scripts (export, ingest, import). Calls wrangler's JS directly with node, so
// arguments reach it intact on every OS (no shell quoting).
// Reads use --command: remote `--file` runs as an import and returns only a summary, never rows.
// Writes use --file: no size limit and no results needed.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WRANGLER = resolve('node_modules/wrangler/bin/wrangler.js');

export function wrangler(args: string[], opts: { quiet?: boolean } = {}): string {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', opts.quiet ? 'pipe' : 'inherit'],
  });
}

const target = (remote: boolean) => (remote ? '--remote' : '--local');

/** Runs one SELECT and returns its rows. */
export function d1Read(remote: boolean, query: string): Record<string, unknown>[] {
  const out = wrangler(['d1', 'execute', 'taraney-db', target(remote), '--json', `--command=${query.replace(/\s+/g, ' ').trim()}`]);
  const json = JSON.parse(out.slice(out.indexOf('[')));
  return json[0]?.results || [];
}

/** Runs one or more write statements. */
export function d1Write(remote: boolean, statements: string): void {
  mkdirSync('.wrangler', { recursive: true });
  const file = resolve('.wrangler/write.sql');
  writeFileSync(file, statements);
  wrangler(['d1', 'execute', 'taraney-db', target(remote), `--file=${file}`, '-y'], { quiet: true });
}

export const q = (v: unknown) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
