// Fetch the three CSVs and hand their rows to the validator. The CSVs live at
// /data (content editors open them in Excel) and are imported as URLs so Vite
// fingerprints and serves them — never fetched from a CDN at runtime.

import { csv, json } from 'd3';
import { feature } from 'topojson-client';
import projectsUrl from '../../data/projects.csv?url';
import metricsUrl from '../../data/metrics.csv?url';
import peersUrl from '../../data/peer_cities.csv?url';
import cityIndicatorsUrl from '../../data/cities.csv?url';
import { validateDataset } from './validate.js';

// Committed geometry lives in /public and is served from the app base — never a
// CDN. Referenced by root-absolute path (Vite's rule for public assets).
const GEO_URL = `${import.meta.env.BASE_URL}geo/europe-countries.topo.json`;

// Per-city geometry for the L1 district overview, by city slug. Only cities with
// committed files appear here; the file basenames need not match the slug (e.g.
// koeln's files are named "cologne"). Cities absent here draw no district layer.
const CITY_GEO = {
  koeln: {
    outline: 'geo/cities/cities_cologne.geo.json',
    districts: 'geo/districts/districts_cologne.json',
    infrastructure: 'geo/infrastructure/infrastructure_cologne.geo.json',
  },
};

const geoUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

/**
 * @returns {Promise<{ projects: import('./types.js').Project[], metrics: import('./types.js').Metric[], peers: import('./types.js').PeerCity[], cityIndicators: import('./types.js').CityIndicator[], geo: object }>}
 */
export async function loadDataset() {
  const [projectRows, metricRows, peerRows, cityRows, geo] = await Promise.all([
    csv(projectsUrl),
    csv(metricsUrl),
    csv(peersUrl),
    csv(cityIndicatorsUrl),
    json(GEO_URL),
  ]);
  return { ...validateDataset({ projectRows, metricRows, peerRows, cityRows }), geo };
}

/**
 * Fetch one city's committed boundary silhouette (GeoJSON). Loaded on demand by
 * the city view, not on boot.
 * @param {string} citySlug
 * @returns {Promise<import('geojson').Feature>}
 */
export function loadCitySilhouette(citySlug) {
  return json(`${import.meta.env.BASE_URL}geo/cities/${citySlug}.geo.json`);
}

// Each city layer loads on its own so a slow or missing one never blocks the
// others. Every loader resolves to null when the city has no such file, letting
// callers simply skip that layer.

/**
 * Fetch a city's outer boundary polygon (GeoJSON).
 * @param {string} citySlug
 * @returns {Promise<object | null>}
 */
export function loadCityOutline(citySlug) {
  const entry = CITY_GEO[citySlug];
  return entry?.outline ? json(geoUrl(entry.outline)) : Promise.resolve(null);
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
  return feature(topo, Object.values(topo.objects)[0]);
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
