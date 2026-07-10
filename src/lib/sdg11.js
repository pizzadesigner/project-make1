// The eleven SDG 11 targets are the spine of the dashboard, not a free-text
// string. Titles are looked up through t() ("sdg.target.11.2"); this table
// holds the stable, non-translatable facts: the ordered code list, a colour
// (as a CSS custom-property name — no hex in JS), and a glyph for the badge.

/** Ordered so filters and legends render 11.1 … 11.7, 11.a … 11.c. */
export const SDG11_TARGET_CODES = [
  '11.1',
  '11.2',
  '11.3',
  '11.4',
  '11.5',
  '11.6',
  '11.7',
  '11.a',
  '11.b',
  '11.c',
];

/**
 * @typedef {Object} Sdg11Target
 * @property {string} code
 * @property {string} colorVar  CSS custom property defined in tokens.css.
 * @property {string} glyph     Short emoji glyph for the target badge.
 */

/** @type {Record<string, Sdg11Target>} */
export const SDG11_TARGETS = {
  11.1: { code: '11.1', colorVar: '--sdg-housing', glyph: '🏠' },
  11.2: { code: '11.2', colorVar: '--sdg-transport', glyph: '🚌' },
  11.3: { code: '11.3', colorVar: '--sdg-urbanization', glyph: '🏙️' },
  11.4: { code: '11.4', colorVar: '--sdg-heritage', glyph: '🏛️' },
  11.5: { code: '11.5', colorVar: '--sdg-resilience', glyph: '🌊' },
  11.6: { code: '11.6', colorVar: '--sdg-environment', glyph: '🌫️' },
  11.7: { code: '11.7', colorVar: '--sdg-greenspace', glyph: '🌳' },
  '11.a': { code: '11.a', colorVar: '--sdg-regional', glyph: '🔗' },
  '11.b': { code: '11.b', colorVar: '--sdg-policy', glyph: '📋' },
  '11.c': { code: '11.c', colorVar: '--sdg-support', glyph: '🤝' },
};

/** @param {string} code @returns {boolean} */
export function isKnownTarget(code) {
  return Object.prototype.hasOwnProperty.call(SDG11_TARGETS, code);
}
