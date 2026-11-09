// Static output: every public page is plain HTML on Cloudflare Pages.
// Server code lives only in /functions (Pages Functions, Hono). In dev, /api is proxied to
// `wrangler pages dev` on :8788 (see scripts/dev.mjs) so Functions + local D1/R2 work with HMR.
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'static',
  integrations: [preact()],
  build: { format: 'directory' },
  server: { port: 4321 },
  vite: {
    server: {
      proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: false } },
    },
  },
});
