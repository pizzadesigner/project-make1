// Slugs in the data are authored and stable — we never regenerate them from
// titles. slugify() exists only to map user input (search, aliases) onto those
// stable slugs, so it must fold diacritics the same way every time: this is the
// single most likely silent bug in the project (Žilina, Zlín, 's-Hertogenbosch).

const COMBINING_MARKS = /[̀-ͯ]/g;
const APOSTROPHES = /['’]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Fold a display string to an ASCII kebab-case slug.
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  return input
    .normalize('NFD') // split base letters from their combining accents
    .replace(COMBINING_MARKS, '') // drop the accents
    .replace(APOSTROPHES, '') // 's-Hertogenbosch -> s-hertogenbosch
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '-')
    .replace(EDGE_HYPHENS, '');
}
