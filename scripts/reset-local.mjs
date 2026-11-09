// Deletes the emulated local D1/R2 state. `npm run db:reset:local` then re-runs setup.
import { rmSync } from 'node:fs';

rmSync('.wrangler/state', { recursive: true, force: true });
console.log('Local D1/R2 state removed.');
