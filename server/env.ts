import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  PRIVATE: R2Bucket;
  APP_ENV: string;
  ALLOWED_ORIGINS?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSPHRASE?: string;
  /** Fine-grained GitHub token with Actions: read and write, for starting ingest/publish workflows. */
  GH_TOKEN?: string;
  /** "owner/repo" */
  GH_REPO?: string;
}
export type Ctx = Context<{ Bindings: Env; Variables: { adminId: string; adminEmail: string } }>;

export const json = (v: unknown) => JSON.stringify(v ?? null);
export const parse = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(c: Ctx): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

/** Public URL for a stored audio key. Sample files ship as static assets; everything else streams from R2. */
export const audioUrl = (key?: string | null) =>
  !key ? null : key.startsWith('samples/') ? `/${key}` : `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;

export async function audit(c: Ctx, action: string, entity: string, detail?: unknown) {
  await c.env.DB.prepare('INSERT INTO audit_log (actor, action, entity, detail) VALUES (?, ?, ?, ?)')
    .bind(c.get('adminEmail') || 'public', action, entity, detail === undefined ? null : json(detail)).run();
}
