// Every geometry path in CITY_GEO must point at a file that is actually
// committed under public/. This is the guard for a rename: the `.geo.json` →
// `.geojson` rename left loadCitySilhouette() fetching a path nothing served, so
// the map drew a city fine while its silhouette silently fell back to "City
// outline unavailable" in both the detail overlay and the deep-linked city view.
//
// The fetch answered 200 (the dev/preview server hands back index.html for an
// unknown path), so nothing looked wrong in the network tab either — only the
// JSON parse failed, straight into the catch. Hence a file-existence check
// rather than a status check.

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CITY_GEO } from './load.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const entries = Object.entries(CITY_GEO).flatMap(([slug, layers]) =>
  Object.entries(layers).map(([layer, path]) => ({ slug, layer, path })),
);

describe('committed city geometry', () => {
  it('describes at least one layer', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const { slug, layer, path } of entries) {
    it(`${slug} · ${layer} → ${path} exists`, () => {
      expect(existsSync(resolve(root, 'public', path))).toBe(true);
    });
  }
});
