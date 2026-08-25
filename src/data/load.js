// Fetch the CSVs and hand their rows to the validator. The CSVs live at
// /data (content editors open them in Excel) and are imported as URLs so Vite
// fingerprints and serves them — never fetched from a CDN at runtime.

import { csv, json } from 'd3';
import { feature } from 'topojson-client';
import projectsUrl from '../../data/projects.csv?url';
import metricsUrl from '../../data/metrics.csv?url';
import peersUrl from '../../data/peer_cities.csv?url';
import cityIndicatorsUrl from '../../data/cities.csv?url';
import timelineUrl from '../../data/timeline.csv?url';
import { validateDataset } from './validate.js';
import { CITY_GEO } from './cityGeo.js';

// Committed geometry lives in /public and is served from the app base — never a
// CDN. Referenced by root-absolute path (Vite's rule for public assets).
const GEO_URL = `${import.meta.env.BASE_URL}geo/europe-countries.topo.json`;

// Re-exported so the app keeps importing geometry paths from one module; the
// table itself lives in cityGeo.js, which the build script can read too.
export { CITY_GEO };

const geoUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

/**
 * @returns {Promise<{ projects: import('./types.js').Project[], metrics: import('./types.js').Metric[], peers: import('./types.js').PeerCity[], cityIndicators: import('./types.js').CityIndicator[], geo: object }>}
 */
export async function loadDataset() {
  const [projectRows, metricRows, peerRows, cityRows, timelineRows, geo] = await Promise.all([
    csv(projectsUrl),
    csv(metricsUrl),
    csv(peersUrl),
    csv(cityIndicatorsUrl),
    csv(timelineUrl),
    json(GEO_URL),
  ]);
  return {
    ...validateDataset({ projectRows, metricRows, peerRows, cityRows, timelineRows }),
    geo,
  };
}

// Each city layer loads on its own so a slow or missing one never blocks the
// others. Every loader resolves to null when the city has no such file, letting
// callers simply skip that layer.

const ringArea = (ring) => {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};

// d3-geo winds polygons opposite to the GeoJSON (RFC 7946) spec — it expects
// exterior rings clockwise, holes counterclockwise. A file that follows the
// spec (as hand-exported outlines usually do) renders inverted: d3 fills the
// whole globe minus the shape. Reorient each ring to d3's convention; already
// d3-wound rings are left as-is, so this is safe to run on any GeoJSON.
const rewindRings = (rings) =>
  rings.map((ring, i) => {
    const isClockwise = ringArea(ring) < 0;
    const wantClockwise = i === 0; // exterior clockwise, holes the other way
    return isClockwise === wantClockwise ? ring : [...ring].reverse();
  });

function rewind(geometry) {
  if (!geometry) return geometry;
  switch (geometry.type) {
    case 'Polygon':
      return { ...geometry, coordinates: rewindRings(geometry.coordinates) };
    case 'MultiPolygon':
      return { ...geometry, coordinates: geometry.coordinates.map(rewindRings) };
    case 'GeometryCollection':
      return { ...geometry, geometries: geometry.geometries.map(rewind) };
    case 'Feature':
      return { ...geometry, geometry: rewind(geometry.geometry) };
    case 'FeatureCollection':
      return { ...geometry, features: geometry.features.map(rewind) };
    default:
      return geometry;
  }
}

/**
 * Fetch a city's outer boundary polygon (GeoJSON), reoriented to d3's winding.
 * Also the source for the drawn silhouette (citySilhouette.js) — one loader, so
 * a renamed file can never leave the map right and the silhouette blank again.
 * @param {string} citySlug
 * @returns {Promise<object | null>}
 */
export function loadCityOutline(citySlug) {
  const entry = CITY_GEO[citySlug];
  return entry?.outline ? json(geoUrl(entry.outline)).then(rewind) : Promise.resolve(null);
}

/**
 * Fetch a city's districts (TopoJSON) as a GeoJSON FeatureCollection.
 * @param {string} citySlug
 * @returns {Promise<import('geojson').FeatureCollection | null>}
 */
export async function loadCityDistricts(citySlug) {
  const entry = CITY_GEO[citySlug];
  if (!entry?.districts) return null;
  const topo = await json(geoUrl(entry.districts));
  // topojson-client decodes arcs but doesn't rewind, so a source wound to the
  // GeoJSON spec still inverts in d3 — normalise like the outline (see rewind).
  return rewind(feature(topo, Object.values(topo.objects)[0]));
}

/**
 * Fetch a city's infrastructure layer — cycle routes, green space (GeoJSON).
 * @param {string} citySlug
 * @returns {Promise<import('geojson').FeatureCollection | null>}
 */
export function loadCityInfrastructure(citySlug) {
  const entry = CITY_GEO[citySlug];
  return entry?.infrastructure ? json(geoUrl(entry.infrastructure)) : Promise.resolve(null);
}
