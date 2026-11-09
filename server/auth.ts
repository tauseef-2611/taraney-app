// Single-owner admin login. Passphrase lives in a secret (ADMIN_PASSPHRASE); sessions in D1.
// Cheap on CPU (one SHA-256), so it fits the free plan. Rate limited per IP.
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { clientIp, sha256Hex, type Ctx, type Env } from './env';

const COOKIE = 'tsid';
const SESSION_DAYS = 7;
const MAX_FAILS = 5;

function constantEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Blocks cross-site writes. SameSite=Strict already does most of this. */
export const sameOrigin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    const allowed = new Set([new URL(c.req.url).origin, ...(c.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)]);
    if (origin && !allowed.has(origin)) return c.json({ error: 'Cross-site request blocked' }, 403);
  }
  await next();
};

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: 'Not signed in' }, 401);
  const row = await (c as Ctx).env.DB.prepare(
    "SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > datetime('now')",
  ).bind(await sha256Hex(token)).first<{ id: string; email: string }>();
  if (!row) return c.json({ error: 'Session expired' }, 401);
  c.set('adminId', row.id);
  c.set('adminEmail', row.email);
  await next();
};

export const authRoutes = new Hono<{ Bindings: Env; Variables: { adminId: string; adminEmail: string } }>();

authRoutes.post('/login', async (c) => {
  const db = c.env.DB;
  const key = `login:${clientIp(c as Ctx)}`;
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at > datetime('now', '-15 minutes')").bind(key).first<{ n: number }>();
  if ((fails?.n || 0) >= MAX_FAILS) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);

  const { email, passphrase } = await c.req.json<{ email?: string; passphrase?: string }>().catch(() => ({} as never));
  const cfgEmail = (c.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const cfgPass = c.env.ADMIN_PASSPHRASE || '';
  if (!cfgEmail || cfgPass.length < 12) return c.json({ error: 'Admin is not configured. Set ADMIN_EMAIL and ADMIN_PASSPHRASE.' }, 500);

  const ok = String(email || '').trim().toLowerCase() === cfgEmail
    && constantEq(await sha256Hex(String(passphrase || '')), await sha256Hex(cfgPass));
  if (!ok) {
    await db.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(key).run();
    return c.json({ error: 'Email or passphrase is wrong.' }, 401);
  }

  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
  await db.prepare("INSERT INTO admins (id, email, secret_hash, role) VALUES ('owner', ?, 'env', 'owner') ON CONFLICT(id) DO UPDATE SET email = excluded.email").bind(cfgEmail).run();
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await db.prepare(`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, 'owner', datetime('now', '+${SESSION_DAYS} days'))`)
    .bind(await sha256Hex(token)).run();
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  setCookie(c, COOKIE, token, {
    httpOnly: true, sameSite: 'Strict', path: '/', maxAge: SESSION_DAYS * 86400,
    secure: new URL(c.req.url).protocol === 'https:',
  });
  return c.json({ ok: true, email: cfgEmail });
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAdmin, (c) => c.json({ email: c.get('adminEmail') }));
