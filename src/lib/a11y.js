// Small accessibility/motion helpers shared by animated components. Motion
// durations stay in tokens.css; this reads them so JS never hard-codes a
// duration, and returns 0 when the user asks for reduced motion.

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Resolve a motion-duration token to milliseconds, or 0 under reduced motion.
 * @param {string} tokenName e.g. "--motion-base"
 * @returns {number}
 */
export function motionMs(tokenName) {
  if (prefersReducedMotion()) return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(tokenName);
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : 0;
}
