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

## 6. First deploy from GitHub Actions

After adding the GitHub secrets in the next step, go to **Actions → Deploy application → Run workflow**.
This exports **published** songs (none yet), builds, and deploys the site. Open
`https://taraney.pages.dev/admin`, sign in, open a few taraney, check the lyrics,
and press **Publish** on each. Saving a published tarana automatically starts the
next GitHub Actions publish; no local build or deploy is needed.

From now on, publishing is handled only by GitHub Actions. Saving a published tarana,
publishing a draft, or changing the audio/timing of a published tarana automatically
dispatches the `Publish` workflow. The **Publish site** button in the admin also
dispatches that workflow manually; no local build or deploy is needed.

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

**c) Test it.** Go to **Actions → Publish content → Run workflow**. It should finish green in about 2 minutes. Application code pushes use **Deploy application**.

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
- **Dashboard → Job Queue** monitors queued, running, and completed ingest jobs.
- **A tarana → Audio & sync → add a YouTube link → Fetch audio + sync** places the job in the queue.
- Run the local worker on your PC to process the queue:
  ```bash
  npm run worker
  ```
  The worker inspects how many jobs are pending, asks how many parallel terminals to open (1 to 3 depending on queue depth), asks permission via a Windows popup for each job, and resolves the queue in parallel on your compute. For unattended batch mode without prompts, run `npm run worker:auto`.

## 9. Local Ingestion Worker

YouTube blocks GitHub Action datacenter IPs ("Sign in to confirm you're not a bot"). Ingestion is therefore handled by your PC's connection using Cloudflare D1 as a work queue.

1. **Process jobs with the queue worker**:
   ```bash
   npm run worker
   ```
   Credentials in `.dev.vars` or `.env` (`GEMINI_API_KEY`, Cloudflare tokens) are automatically picked up.
2. **Run a single recording directly**:
   ```bash
   npm run ingest -- --recording rec-xxxxxxxxxxxx
   ```
3. **Upload the audio file**:
   Alternatively, upload an audio file directly under **Audio & sync** in the admin.

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
| Make content changes live | Save the tarana; **Publish content** automatically exports, builds and deploys it |
| Deploy application changes | Push to `main`; **Deploy application** runs tests, migrations, build and deploy |

## Free plan limits (for reference)

| Resource | Limit | Your use |
|---|---|---|
| Static page views | unlimited | all reading |
| Functions (`/api`, `/admin`) | 100,000 requests a day | admin, forms, audio streaming |
| D1 | 5 GB, 5 million reads a day | tiny |
| R2 | 10 GB, free egress | about 4 MB per song |
| GitHub Actions | unlimited on a public repo | about 2 to 5 minutes per job |

Audio streams through a Function (`/api/media/...`), so each play uses a few requests. If you ever get near the daily limit, add a custom domain to the `taraney-media` bucket and serve audio from it directly.
