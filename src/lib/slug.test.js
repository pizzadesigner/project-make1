import { describe, it, expect } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  // Diacritics surviving parse -> slug -> URL -> sort is the project's most
  // likely silent bug, so these fixtures are load-bearing, not edge cases.
  it('folds diacritics to ASCII', () => {
    expect(slugify('Žilina')).toBe('zilina');
    expect(slugify('Zlín')).toBe('zlin');
    expect(slugify('Lisboa')).toBe('lisboa');
  });

  it("drops the leading apostrophe in 's-Hertogenbosch", () => {
    expect(slugify("'s-Hertogenbosch")).toBe('s-hertogenbosch');
    expect(slugify('’s-Hertogenbosch')).toBe('s-hertogenbosch');
  });

  it('collapses punctuation and whitespace runs to single hyphens', () => {
    expect(slugify('Paris — Marne-la-Vallée')).toBe('paris-marne-la-vallee');
    expect(slugify('  Den   Bosch  ')).toBe('den-bosch');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('—Venezia—')).toBe('venezia');
  });

  it('is idempotent on an already-slugged string', () => {
    expect(slugify('s-hertogenbosch')).toBe('s-hertogenbosch');
  });
});
