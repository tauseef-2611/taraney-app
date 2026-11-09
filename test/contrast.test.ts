// Contrast audit: every fg/bg pair the components use (AUDIT_PAIRS), in both schemes.
// `npm run audit:contrast` prints the full table.
import { describe, expect, it } from 'vitest';
import { contrast } from '../src/design/color';
import { AUDIT_PAIRS, resolve, schemes } from '../src/design/tokens';

describe.each(['dark', 'light'] as const)('%s scheme contrast', (s) => {
  it.each(AUDIT_PAIRS)('%s on %s ≥ %d (%s)', (fg, bg, min) => {
    const ratio = contrast(resolve(schemes[s][fg]), resolve(schemes[s][bg]));
    if (process.env.AUDIT) console.log(`${s.padEnd(5)} ${ratio.toFixed(2).padStart(5)} ≥ ${min}  ${fg} on ${bg}`);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});
