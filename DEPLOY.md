# Deploy Taraney to Cloudflare (free plan)

You need about 30 minutes. Everything below runs from `D:\Playground\claude\taraney-app` in a terminal.

**What you end up with**
- `https://taraney.pages.dev`: the reader app (static pages, free and unlimited) plus `/admin` and `/api` (Pages Functions).
- D1 database `taraney-db` and R2 buckets `taraney-media` (audio) and `taraney-private` (reader uploads).
- GitHub Actions: **Publish** (rebuilds the site) and **Ingest** (YouTube to audio, lyrics and timing).

---

## 0. Before you start

- A Cloudflare account (free) and a GitHub account.
- Node 22 is installed (you have it).
- R2 must be switched on once in the Cloudflare dashboard (**R2 → Get started**). Cloudflare may ask for a card even on the free plan; the free tier is 10 GB storage with free egress.
- A Gemini API key from Google AI Studio (for lyrics and timing drafts).

## 1. Put the code on GitHub

```bash
git init
git add .
git commit -m "Taraney app"
git branch -M main
```

Create an empty repository on github.com (for example `taraney-app`). **Public** gives unlimited Actions minutes; your songs live in D1 and R2, not in the repo. Then:

```bash
git remote add origin https://github.com/<you>/taraney-app.git
git push -u origin main
```

Check that `.dev.vars` is **not** in the repo (it is git-ignored).

## 2. Log in to Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

`whoami` prints your **Account ID**. Copy it for step 7.

## 3. Create the database and buckets

```bash
npx wrangler d1 create taraney-db
npx wrangler r2 bucket create taraney-media
npx wrangler r2 bucket create taraney-private
```

`d1 create` prints a `database_id`. Paste it into **both** `database_id` lines in `wrangler.toml` (the top one and the one under `[env.production]`), then commit:

```bash
git commit -am "Set D1 id"
```

## 4. Create the tables and import your songs

```bash
npm run db:migrate:prod
npm run db:import:prod
```

This imports the 89 book songs plus the sample as **drafts**. Nothing is public yet.

The sample recording points at a file that only exists on your PC. Upload it to R2 and repoint it:

```bash
npx wrangler r2 object put taraney-media/audio/up-3be63c7c72/rec-7d18b90a1a10.m4a --file=public/samples/hum-duniya.m4a --content-type=audio/mp4 --remote
```

```bash
npx wrangler d1 execute taraney-db --remote --command="UPDATE recordings SET audio_key='audio/up-3be63c7c72/rec-7d18b90a1a10.m4a' WHERE id='rec-7d18b90a1a10'"
```

## 5. Create the Pages project and set admin secrets

```bash
npx wrangler pages project create taraney --production-branch=main
```

Set the admin login. Use a long passphrase (6 random words or more); do not reuse the local one.

```bash
npx wrangler pages secret put ADMIN_EMAIL --project-name=taraney
```

```bash
npx wrangler pages secret put ADMIN_PASSPHRASE --project-name=taraney
```

## 6. First deploy from your PC

```bash
npm run deploy
```

This exports **published** songs (none yet), builds, and uploads. Open `https://taraney.pages.dev/admin`, sign in, open a few taraney, check the lyrics, and press **Publish** on each. Then deploy again so they appear on the site:

```bash
npm run deploy
```

From now on you will use the **Publish site** button in the admin instead (step 8).

## 7. Connect GitHub Actions

**a) Cloudflare API token.** In the Cloudflare dashboard go to **My Profile → API Tokens → Create Token → Custom token**, with these account permissions:
- Cloudflare Pages: Edit
- D1: Edit
- Workers R2 Storage: Edit

**b) GitHub secrets.** In your repo go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from (a) |
| `CLOUDFLARE_ACCOUNT_ID` | from `wrangler whoami` |
| `GEMINI_API_KEY` | your Google AI Studio key |

Optional: under **Variables**, set `GEMINI_MODEL` (default `gemini-3.6-flash`).

**c) Test it.** Go to **Actions → Publish → Run workflow**. It should finish green in about 2 minutes. Every push to `main` also publishes.

## 8. Let the admin start workflows

Create a fine-grained GitHub token at **GitHub → Settings → Developer settings → Fine-grained tokens**:
- Repository access: only `taraney-app`.
- Permissions: **Actions: Read and write**.

Then give it to the site:

```bash
npx wrangler pages secret put GH_TOKEN --project-name=taraney
```

```bash
npx wrangler pages secret put GH_REPO --project-name=taraney
```

For `GH_REPO`, enter `<you>/taraney-app`. Redeploy once (`npm run deploy`) so the secrets take effect.

Now in the admin:
- **Dashboard → Publish site** rebuilds the public site.
- **A tarana → Audio & sync → add a YouTube link → Fetch audio + sync** runs the Ingest workflow. It downloads the audio, uploads it to R2, drafts lyrics (only if the song has none: from the video description, otherwise from the audio) and drafts line timings. Refresh after 2 to 5 minutes, then open **Edit sync** to correct the timings, and publish.

## 9. If YouTube blocks GitHub

YouTube sometimes refuses downloads from GitHub's servers ("Sign in to confirm you're not a bot"). The job then fails with that message. Two options:

1. **Run the same ingest from your PC** (your home connection). It writes to the live database and bucket:
   ```bash
   npm run ingest -- --recording rec-xxxxxxxxxxxx
   ```
   The recording id is shown in the admin URL when you open sync, or under **Audio & sync**.
   On your PC it uses the POC's `.venv` yt-dlp. Set `GEMINI_API_KEY` first in the same terminal (PowerShell: `$env:GEMINI_API_KEY="..."`).
2. **Upload the audio file** under **Audio & sync**. You own the content, so you can download it from YouTube Studio.

## 10. Before you announce it

- Every page has `noindex` while you test. To let search engines in, remove the `robots` meta line in `src/layouts/Base.astro`, then publish.
- Custom domain (optional): **Pages → taraney → Custom domains**.
- Backups: D1 keeps 30 days of Time Travel on the free plan. To take a copy:
  ```bash
  npx wrangler d1 export taraney-db --remote --output=backup.sql
  ```

## Day-to-day

| Task | Where |
|---|---|
| Add a tarana | Admin → New tarana (paste lyrics, add a YouTube link) |
| Get audio and timing | Admin → tarana → Audio & sync → Fetch audio + sync |
| Fix timing | Admin → tarana → Audio & sync → Edit sync |
| Review reader suggestions | Admin → Suggestions |
| Make changes live | Admin → Publish on the tarana, then Dashboard → Publish site |

## Free plan limits (for reference)

| Resource | Limit | Your use |
|---|---|---|
| Static page views | unlimited | all reading |
| Functions (`/api`, `/admin`) | 100,000 requests a day | admin, forms, audio streaming |
| D1 | 5 GB, 5 million reads a day | tiny |
| R2 | 10 GB, free egress | about 4 MB per song |
| GitHub Actions | unlimited on a public repo | about 2 to 5 minutes per job |

Audio streams through a Function (`/api/media/...`), so each play uses a few requests. If you ever get near the daily limit, add a custom domain to the `taraney-media` bucket and serve audio from it directly.
