// Fetch the three CSVs and hand their rows to the validator. The CSVs live at
// /data (content editors open them in Excel) and are imported as URLs so Vite
// fingerprints and serves them — never fetched from a CDN at runtime.

import { csv, json } from 'd3';
import projectsUrl from '../../data/projects.csv?url';
import metricsUrl from '../../data/metrics.csv?url';
import peersUrl from '../../data/peer_cities.csv?url';
import { validateDataset } from './validate.js';

// Committed geometry lives in /public and is served from the app base — never a
// CDN. Referenced by root-absolute path (Vite's rule for public assets).
const GEO_URL = `${import.meta.env.BASE_URL}geo/europe-countries.topo.json`;

/**
 * @returns {Promise<{ projects: import('./types.js').Project[], metrics: import('./types.js').Metric[], peers: import('./types.js').PeerCity[], geo: object }>}
 */
export async function loadDataset() {
  const [projectRows, metricRows, peerRows, geo] = await Promise.all([
    csv(projectsUrl),
    csv(metricsUrl),
    csv(peersUrl),
    json(GEO_URL),
  ]);
  return { ...validateDataset({ projectRows, metricRows, peerRows }), geo };
}
