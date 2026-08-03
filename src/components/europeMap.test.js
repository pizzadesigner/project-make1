// The L1 fit decides whether a focused city fills the stage or turns up as a
// speck, and it turned up as a speck: cityFitInfo reserved a flat 340px on each
// side for the widget columns, so a 760px-wide stage had 80px left to fit a city
// into. Cologne came out ~8% of the width, at country scale, with no way to zoom
// in — the map looked broken rather than framed.
//
// The fitted width is independent of the projection's own scale (the fit divides
// by the city's projected bounds, so it cancels), which is why this can check
// the framing across stage sizes without reproducing the whole map. Geometry is
// the committed geometry, not a fixture, so re-simplifying a city that changes
// its aspect shows up here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { geoPath } from 'd3';
import { feature } from 'topojson-client';
import { cityFitInfo } from './europeMap.js';
import { createEuropeProjection, fitToViewport } from '../lib/projection.js';
import { CITY_GEO } from '../data/cityGeo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readTopo(path) {
  const topo = JSON.parse(readFileSync(resolve(root, 'public', path), 'utf8'));
  return feature(topo, Object.values(topo.objects)[0]);
}

const countries = readTopo('geo/europe-countries.topo.json');

// A maximised desktop, a laptop, a half-screen window, and a stage narrower than
// the two widget columns put together.
const STAGES = [
  { width: 1912, height: 945 },
  { width: 1440, height: 900 },
  { width: 1100, height: 800 },
  { width: 900, height: 700 },
  { width: 760, height: 700 },
];

// The city has to be the clear subject of the stage, without running off it.
// The floor is what the bug broke; the ceiling is CITY_FILL doing its job.
const FILL_BAND = { min: 0.3, max: 0.9 };

const cities = Object.entries(CITY_GEO).map(([slug, layers]) => ({
  slug,
  districts: readTopo(layers.districts),
}));

/** The fitted city's on-screen size, as a fraction of the stage. */
function fittedFraction(stage, path, districts) {
  const [[x0, y0], [x1, y1]] = path.bounds(districts);
  const { scale } = cityFitInfo(path, stage, districts);
  return { x: ((x1 - x0) * scale) / stage.width, y: ((y1 - y0) * scale) / stage.height };
}

describe('a focused city is framed to the stage it is on', () => {
  for (const stage of STAGES) {
    // Fitting the continent is the slow part, so each stage pays for it once.
    const path = geoPath(
      fitToViewport(createEuropeProjection(), countries, stage.width, stage.height, 16),
    );
    for (const { slug, districts } of cities) {
      it(`${slug} fills its share of ${stage.width}x${stage.height}`, () => {
        const fitted = fittedFraction(stage, path, districts);
        expect(Math.max(fitted.x, fitted.y)).toBeGreaterThan(FILL_BAND.min);
        expect(fitted.x).toBeLessThan(FILL_BAND.max);
        expect(fitted.y).toBeLessThan(FILL_BAND.max);
      });
    }
  }
});
