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
 * Money at the magnitude rather than to the euro: "€2.9M" / "2,9 Mio. €".
 * For a figure that has to sit inside a card next to its own label, where the
 * exact number is one click away in the source anyway. Still Intl, so German
 * gets its own abbreviation and symbol placement rather than a cut-down string.
 * @param {number|null} value
 * @param {'en'|'de'} locale
 * @param {string} [currency]
 * @returns {string}
 */
export function formatCurrencyCompact(value, locale, currency = 'EUR') {
  if (value === null || value === undefined) return MISSING;
  return new Intl.NumberFormat(tagFor(locale), {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
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

/**
 * The host a URL points at, for showing next to a link whose visible text is a
 * name rather than an address ("Connecting Europe Facility" → ec.europa.eu).
 * `www.` is dropped: it is on some hosts and not others, and it never tells the
 * reader anything about where they are being sent.
 *
 * Returns MISSING for anything unparseable rather than throwing — a bad URL in
 * a CSV should cost a hint, not a render (CLAUDE.md: degrade, do not throw).
 * @param {string|null} url
 * @returns {string}
 */
export function formatHostname(url) {
  if (!url) return MISSING;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return MISSING;
  }
}
