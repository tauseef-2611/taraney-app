// Pages Functions entry for /api/*. Kept light (free-plan CPU): D1/R2 reads and writes only.
// Heavy work (yt-dlp, ffmpeg, Gemini) runs in GitHub Actions, never here.
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { adminRoutes } from '../../server/admin';
import { authRoutes, sameOrigin } from '../../server/auth';
import type { Env } from '../../server/env';
import { publicRoutes } from '../../server/public';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', sameOrigin);
app.route('/auth', authRoutes);
app.route('/admin', adminRoutes);
app.route('/', publicRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong on the server.' }, 500);
});
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export const onRequest = handle(app);
