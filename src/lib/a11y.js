// Small accessibility/motion helpers shared by animated components. Motion
// durations stay in tokens.css; this reads them so JS never hard-codes a
// duration, and returns 0 when the user asks for reduced motion.

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Parse a CSS duration to milliseconds. The unit has to be read rather than
 * assumed: tokens.css is written in `ms`, but the production CSS minifier
 * rewrites `480ms` to the shorter `.48s`, and taking that as a bare number
 * yields 0.48 — a sub-frame transition, so every animation became a jump cut
 * in the built app while still working in dev.
 * @param {string} raw e.g. "480ms" or ".48s"
 * @returns {number}
 */
export function durationToMs(raw) {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return String(raw).trim().endsWith('ms') ? value : value * 1000;
}

/**
 * Resolve a motion-duration token to milliseconds, or 0 under reduced motion.
 * @param {string} tokenName e.g. "--motion-base"
 * @returns {number}
 */
export function motionMs(tokenName) {
  if (prefersReducedMotion()) return 0;
  return durationToMs(getComputedStyle(document.documentElement).getPropertyValue(tokenName));
}
