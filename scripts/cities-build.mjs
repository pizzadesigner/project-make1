// Fetch each city's real administrative boundary from OpenStreetMap (Nominatim,
// ODbL) once at build time, simplify it, and commit the result to
// public/geo/cities/. Never fetched at runtime. Nominatim asks for <=1 req/s and
// a real User-Agent, so we throttle and identify ourselves.
//
// Run with `npm run cities:build`.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mapshaper from 'mapshaper';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/geo/cities');
const tmpDir = resolve(root, '.cache-cities');

// slug -> Nominatim query. Regions use their representative core municipality.
const CITY_QUERIES = [
  { slug: 'zilina', q: 'Žilina', country: 'Slovakia' },
  { slug: 'bern', q: 'Bern', country: 'Switzerland' },
  { slug: 'paris-marne-la-vallee', q: 'Marne-la-Vallée', country: 'France' },
  { slug: 's-hertogenbosch', q: "'s-Hertogenbosch", country: 'Netherlands' },
  { slug: 'lisboa', q: 'Lisboa', country: 'Portugal' },
  { slug: 'helsinki-region', q: 'Helsinki', country: 'Finland' },
  { slug: 'zlin', q: 'Zlín', country: 'Czechia' },
  { slug: 'huelva', q: 'Huelva', country: 'Spain' },
  { slug: 'venezia', q: 'Venezia', country: 'Italy' },
];

const USER_AGENT = 'sdg11-best-practice-dashboard/0.1 (build-time boundary fetch)';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchBoundary({ q, country }) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: `${q}, ${country}`,
    polygon_geojson: '1',
    format: 'json',
    limit: '1',
  }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Nominatim ${response.status} for ${q}`);
  const [hit] = await response.json();
  if (!hit?.geojson) throw new Error(`No polygon returned for ${q}`);
  return {
    type: 'Feature',
    properties: { name: hit.display_name.split(',')[0] },
    geometry: hit.geojson,
  };
}

async function simplify(slug, feature) {
  const rawPath = resolve(tmpDir, `${slug}.raw.geojson`);
  const outPath = resolve(outDir, `${slug}.geo.json`);
  writeFileSync(rawPath, JSON.stringify(feature));
  await mapshaper.runCommands(
    `-i "${rawPath}" -simplify 12% keep-shapes -o "${outPath}" format=geojson precision=0.00001`,
  );
}

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

for (const city of CITY_QUERIES) {
  const feature = await fetchBoundary(city);
  await simplify(city.slug, feature);
  console.log(`✓ ${city.slug} (${feature.geometry.type})`);
  await sleep(1200); // stay within Nominatim's rate limit
}

rmSync(tmpDir, { recursive: true, force: true });
console.log(`\nWrote ${CITY_QUERIES.length} silhouettes to public/geo/cities/`);
