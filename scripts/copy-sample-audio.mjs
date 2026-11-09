// Copies the POC's sample recording into public/samples (git-ignored) for the /design player.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const src = '../taraney/data/local/media/job-3d0baa02f7fa.m4a';
const dest = 'public/samples/hum-duniya.m4a';
mkdirSync('public/samples', { recursive: true });
if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log(`Copied sample audio to ${dest}`);
} else {
  console.log(`Sample audio not found at ${src}. The player demo falls back to a silent clock.`);
}
