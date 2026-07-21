// Every user-facing string flows through t(). English is the primary UI locale;
// German is the fallback bundle. Both are imported at build time so there is no
// async flash of untranslated keys.

import en from '../i18n/strings.en.json';
import de from '../i18n/strings.de.json';

/** @type {Record<'en'|'de', Record<string, string>>} */
const bundles = { en, de };

let activeLocale = 'en';

/** @param {'en'|'de'} locale */
export function setLocale(locale) {
  if (!bundles[locale]) throw new Error(`Unknown locale: ${locale}`);
  activeLocale = locale;
}

export function getLocale() {
  return activeLocale;
}

/**
 * Look up a string by key, falling back to English, then to the raw key so a
 * missing translation is visible rather than silently blank.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return bundles[activeLocale][key] ?? bundles.en[key] ?? key;
}
