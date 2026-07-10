// Locale-aware formatting. Numbers and currency always go through
// Intl.NumberFormat so German renders "10.000 EUR" and English "EUR 10,000"
// with the correct grouping and symbol placement — never a hand-rolled string.
// null (an empty CSV cell) renders as an em dash, never 0.

const MISSING = '—';

/** UI locale -> BCP-47 tag. Both use the euro; only grouping/placement differ. */
const LOCALE_TAG = { en: 'en-IE', de: 'de-DE' };

/** @param {'en'|'de'} locale */
function tagFor(locale) {
  return LOCALE_TAG[locale] ?? LOCALE_TAG.en;
}

/**
 * @param {number|null} value
 * @param {'en'|'de'} locale
 * @param {string} [currency]
 * @returns {string}
 */
export function formatCurrency(value, locale, currency = 'EUR') {
  if (value === null || value === undefined) return MISSING;
  return new Intl.NumberFormat(tagFor(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * @param {number|null} value
 * @param {'en'|'de'} locale
 * @param {string} [unit]  Optional unit suffix, e.g. "km".
 * @returns {string}
 */
export function formatNumber(value, locale, unit) {
  if (value === null || value === undefined) return MISSING;
  const formatted = new Intl.NumberFormat(tagFor(locale)).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * @param {number|null} year
 * @returns {string}
 */
export function formatYear(year) {
  return year === null || year === undefined ? MISSING : String(year);
}

/**
 * Format an ISO date (source_accessed) in the given locale.
 * @param {string|null} isoDate
 * @param {'en'|'de'} locale
 * @returns {string}
 */
export function formatDate(isoDate, locale) {
  if (!isoDate) return MISSING;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return MISSING;
  return new Intl.DateTimeFormat(tagFor(locale), { dateStyle: 'medium' }).format(date);
}
