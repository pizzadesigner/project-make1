import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatYear, formatDate } from './format.js';

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
