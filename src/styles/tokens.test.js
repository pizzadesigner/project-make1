// prefers-reduced-motion is a hard rule (CLAUDE.md), and for the L1→L2
// entrance it is enforced entirely by these tokens: the components carry no
// reduced-motion branch, they animate whatever duration the stylesheet hands
// them. Which means a motion token added to :root and not zeroed here is a
// silent regression — the modules keep flying in for someone who asked for no
// motion, and nothing else in the suite would notice.
//
// The travel distance is checked alongside the durations on purpose: a 0ms
// animation still applies its first frame for a moment in some engines, so
// "motionless" has to mean the offset is zero too, not just the clock.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8');

/** The declarations inside a `:root { ... }` block, as { name: value }. */
function customProperties(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

const [, baseBlock] = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
const [, reducedBlock] =
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?:root\s*\{([\s\S]*?)\n {2}\}/.exec(css);

const base = customProperties(baseBlock);
const reduced = customProperties(reducedBlock);
// The idle drift is the exception: it never ends, so there is no duration to
// zero — a 0s animation that repeats forever is not "no motion", it is a
// nonsense declaration. widgets.css switches that one off outright, which the
// last test here checks instead.
const PERPETUAL = ['--module-idle-duration', '--arrow-breathe-duration'];

const animated = Object.keys(base).filter(
  (name) =>
    /^--(module|arrow)-/.test(name) &&
    /duration|drift|stagger|-fly$|-idle$/.test(name) &&
    !PERPETUAL.includes(name),
);

describe('the L2 entrance under prefers-reduced-motion', () => {
  it('has motion tokens to answer for', () => {
    expect(animated.length).toBeGreaterThan(0);
  });

  for (const name of animated) {
    it(`${name} is zeroed`, () => {
      expect(Number.parseFloat(reduced[name])).toBe(0);
    });
  }

  // Only the motion is dropped, not the thing that moves: the modules are the
  // same size and in the same places, they simply do not travel to get there.
  it('leaves the modules themselves untouched', () => {
    expect(base['--module-box-min']).toBeTruthy();
    expect(reduced['--module-box-min']).toBeUndefined();
    expect(reduced['--module-nudge']).toBeUndefined();
  });

  it('switches the endless idle drift off rather than shortening it', () => {
    const widgets = readFileSync(resolve(here, 'components/widgets.css'), 'utf8');
    const [, block] = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}/.exec(widgets);
    expect(block).toMatch(/\.widget-detail__card[\s\S]*animation:\s*none/);
    expect(block).toMatch(/\.connector[\s\S]*animation:\s*none/);
  });
});
