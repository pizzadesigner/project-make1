import { describe, it, expect } from 'vitest';
import { durationToMs } from './a11y.js';

describe('durationToMs', () => {
  it('reads the millisecond form the source stylesheet is written in', () => {
    expect(durationToMs('120ms')).toBe(120);
    expect(durationToMs('240ms')).toBe(240);
    expect(durationToMs('480ms')).toBe(480);
  });

  // The production CSS minifier rewrites `480ms` to the shorter `.48s`. Read as
  // a bare number that is 0.48, which silently turned every transition into a
  // sub-frame no-op — animations worked in dev and not on Pages.
  it('reads the second form the production minifier emits', () => {
    expect(durationToMs('.48s')).toBe(480);
    expect(durationToMs('.12s')).toBe(120);
    expect(durationToMs('0.24s')).toBe(240);
    expect(durationToMs('1s')).toBe(1000);
  });

  it('tolerates the whitespace getPropertyValue returns', () => {
    expect(durationToMs(' 480ms ')).toBe(480);
    expect(durationToMs(' .48s ')).toBe(480);
  });

  it('treats zero the same in either unit', () => {
    expect(durationToMs('0ms')).toBe(0);
    expect(durationToMs('0s')).toBe(0);
  });

  it('falls back to no motion for a missing or unparseable token', () => {
    expect(durationToMs('')).toBe(0);
    expect(durationToMs('inherit')).toBe(0);
  });
});
