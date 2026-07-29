// The map draws one marker per project at the row's `lat`/`lon`, while L1 frames
// the city's committed districts (europeMap.js#cityFitInfo). Those two have to
// describe the same place, or the dot lands beside the silhouette instead of on
// it — which is exactly what happened once Helsinki and Paris carried the
// project's own site (Kera in Espoo; Cité Descartes in Marne-la-Vallée) while
// their silhouette stayed the core city.
//
// So `lat`/`lon` is the city's coordinate — where its dot belongs — and the
// suburb the project actually occupies is carried by the prose, funding_source
// and source_url, not by the marker. This guards that contract against the next
// city added to projects.csv.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { csvParse } from 'd3';
import { CITY_GEO } from './load.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

// How near the middle of its silhouette a dot has to land. Wide enough for a
// lopsided outline (Helsinki reaches far east, its centre does not), tight
// enough to catch a marker sitting in a different municipality.
const CENTRE_BAND = { min: 0.15, max: 0.85 };

const projects = csvParse(read('data/projects.csv'));
const placed = projects.filter((row) => CITY_GEO[row.city]?.districts);

/** Where the marker falls inside the districts' bbox, as a 0–1 fraction per axis. */
function markerPosition(row, [west, south, east, north]) {
  return {
    x: (Number(row.lon) - west) / (east - west),
    y: (Number(row.lat) - south) / (north - south),
  };
}

describe('project markers sit on their own city', () => {
  it('checks every city that has committed geometry', () => {
    expect(placed.map((row) => row.city).sort()).toEqual(Object.keys(CITY_GEO).sort());
  });

  for (const row of placed) {
    it(`${row.city_display} is centred on its silhouette`, () => {
      const { bbox } = JSON.parse(read(`public/${CITY_GEO[row.city].districts}`));
      const { x, y } = markerPosition(row, bbox);
      expect(x).toBeGreaterThanOrEqual(CENTRE_BAND.min);
      expect(x).toBeLessThanOrEqual(CENTRE_BAND.max);
      expect(y).toBeGreaterThanOrEqual(CENTRE_BAND.min);
      expect(y).toBeLessThanOrEqual(CENTRE_BAND.max);
    });
  }
});
