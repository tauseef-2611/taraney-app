# Taraney · ترانے

Read, listen and sing along to Urdu taraney. Astro (static) + Preact islands + Cloudflare Pages Functions, D1 and R2, on the free plan.
Plan: `../taraney/docs/plan/06-production-nextjs.md` (v2, Pages only).

## Local setup

```bash
npm install
npm run setup        # local D1 migrations, import the 89 POC songs + sample, copy sample audio
npm run dev          # http://localhost:4321  (design system at /design)
npm run preview      # build + wrangler pages dev on :8788 (Functions + local D1/R2, same as prod)
npm test
```

`npm run db:reset:local` wipes the emulated D1/R2 in `.wrangler/state` and runs setup again.

## Layout

| Path | What |
|---|---|
| `src/design/tokens.ts` | **Single source of truth**: seeds → tonal palettes → roles (dark/light), gradients, type, space, radius, elevation, motion. Emitted as CSS variables by `layouts/Base.astro` |
| `src/design/color.ts` | OKLCH tonal palette generator and WCAG contrast |
| `src/design/artwork.ts` | Deterministic living-artwork composer (mood + song id) |
| `src/styles/components.css` | Component classes. Uses token variables only, no raw colours |
| `src/components/ui/` | Preact components (render to static HTML; hydrate only as islands) |
| `src/components/demo/` | Interactive islands for `/design` (player, reader, controls) |
| `src/lib/` | Ported POC logic: `fold`, slugs, sung order, mood, line timeline |
| `functions/api/[[route]].ts` | Pages Functions (Hono): `/api/health`, `/api/songs` (local only) |
| `migrations/` | D1 schema. Line-level timing only (`sync_level` 0 or 1) |
| `scripts/import-songs.ts` | Imports `../taraney/data/songs/*.json` as drafts. `--force` overwrites, `--remote` targets prod |
| `fixtures/` | Sample song with real line timings, and p026 |

## Rules
- Components use `var(--color-*)`, `var(--type-*)`, `var(--space-*)` etc. Change the look in `tokens.ts`, not in components.
- Never show empty metadata, an audio player without audio, or sync highlight without timing.

## Production (later phases)
Create resources once (`wrangler d1 create taraney-db`, `wrangler r2 bucket create taraney-media` and `taraney-private`), paste the D1 id into `wrangler.toml`, then `npm run db:migrate:prod` and `npm run db:import:prod`. Deploys and ingestion run from GitHub Actions (Phase 1 and 3).
