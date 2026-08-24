import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatYear,
  formatDate,
  formatHostname,
} from './format.js';

// Currency/number output embeds locale-specific spaces (NBSP, narrow NBSP), so
// compare on normalised whitespace rather than exact bytes.
const normalize = (value) => value.replace(/\s/g, ' ');

describe('formatCurrency', () => {
  it('groups German currency as "10.000 €"', () => {
    expect(normalize(formatCurrency(10000, 'de'))).toBe('10.000 €');
  });

  it('formats English currency with a leading symbol', () => {
    expect(normalize(formatCurrency(10000, 'en'))).toBe('€10,000');
  });

  it('renders null as an em dash, never 0', () => {
    expect(formatCurrency(null, 'de')).toBe('—');
    expect(formatCurrency(null, 'en')).toBe('—');
  });
});

describe('formatCurrencyCompact', () => {
  it('abbreviates millions in each locale\u2019s own words', () => {
    expect(normalize(formatCurrencyCompact(2900000, 'en'))).toBe('€2.9M');
    expect(normalize(formatCurrencyCompact(2900000, 'de'))).toBe('2,9 Mio. €');
  });

  // German short notation has no abbreviation below a million, so it falls back
  // to the full figure — and must not trail a ",0" on the way.
  it('leaves a figure it cannot abbreviate whole', () => {
    expect(normalize(formatCurrencyCompact(322000, 'de'))).toBe('322.000 €');
  });

  it('renders null as an em dash, never 0', () => {
    expect(formatCurrencyCompact(null, 'en')).toBe('—');
  });
});

describe('formatNumber', () => {
  it('appends a unit when given one', () => {
    expect(normalize(formatNumber(1500, 'de', 'km'))).toBe('1.500 km');
  });

  it('renders null as an em dash', () => {
    expect(formatNumber(null, 'en', 'km')).toBe('—');
  });
});

describe('formatYear', () => {
  it('renders a year as a plain string', () => {
    expect(formatYear(2023)).toBe('2023');
  });

  it('renders null (e.g. an ongoing project) as an em dash', () => {
    expect(formatYear(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('renders null and invalid dates as an em dash', () => {
    expect(formatDate(null, 'en')).toBe('—');
    expect(formatDate('not-a-date', 'en')).toBe('—');
  });

  it('formats a valid ISO date', () => {
    expect(formatDate('2026-05-14', 'en')).not.toBe('—');
  });
});

// A link whose visible text is a name ("Connecting Europe Facility") says
// nothing about where it goes, so the hover hint shows the host instead.
describe('formatHostname', () => {
  it('drops the scheme, the path and a www prefix', () => {
    expect(formatHostname('https://www.ec.europa.eu/inea/en/connecting-europe')).toBe(
      'ec.europa.eu',
    );
    expect(formatHostname('https://stadt-koeln.de/leben-in-koeln/verkehr')).toBe('stadt-koeln.de');
  });

  it('keeps a subdomain that is not www', () => {
    expect(formatHostname('https://opendata.stadt-koeln.de/dataset')).toBe(
      'opendata.stadt-koeln.de',
    );
  });

  it('degrades rather than throwing on a URL it cannot parse', () => {
    expect(formatHostname('not a url')).toBe('—');
    expect(formatHostname('')).toBe('—');
    expect(formatHostname(null)).toBe('—');
  });
});
