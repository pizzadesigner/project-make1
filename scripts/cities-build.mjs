// Build each city's precise district boundaries from the original,
// high-precision GeoJSON the team maintains in geoJSONFiles/ (WGS84 admin
// boundaries), simplify them once at build time, and commit the result to
// public/geo/cities/. These local files are the source of truth — more precise
// than a generic OSM silhouette — and are never fetched at runtime.
//
// Each source file names its districts and stores area differently, so we
// normalise every feature to a uniform { name, area_km2 } before simplifying.
//
// Run with `npm run cities:build`.

import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mapshaper from 'mapshaper';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'geoJSONFiles');
const outDir = resolve(root, 'public/geo/cities');
const tmpDir = resolve(root, '.cache-cities');

const round2 = (value) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : null);

// slug -> where each source file keeps a district's name and area (in km²).
const CITY_SOURCES = [
  {
    slug: 'koeln',
    file: 'koeln_stadtbezirke_50m_exakt.geojson',
    name: (p) => p.name,
    areaKm2: (p) => round2(p.flaeche / 1e6), // flaeche is in m²
  },
  {
    slug: 'lisboa',
    file: 'lisbon_freguesias.geojson',
    name: (p) => p.freguesia,
    areaKm2: (p) => round2(p.area_ha / 100), // hectares -> km²
  },
  {
    slug: 'helsinki-region',
    file: 'helsinki_districts.geojson',
    name: (p) => p.district_fi,
    areaKm2: (p) => round2(p.area_km2),
  },
  {
    slug: 'paris-marne-la-vallee',
    file: 'paris.geojson', // GeoJSON despite the extension
    name: (p) => p.nom,
    areaKm2: () => null, // not in the source — left unknown, never fabricated
  },
];

/** Reduce a source FeatureCollection to districts with a uniform shape. */
function normalize(source) {
  const raw = JSON.parse(readFileSync(resolve(srcDir, source.file), 'utf8'));
  const features = raw.features.map((feature) => ({
    type: 'Feature',
    properties: {
      name: source.name(feature.properties) ?? '',
      area_km2: source.areaKm2(feature.properties),
    },
    geometry: feature.geometry,
  }));
  return { type: 'FeatureCollection', features };
}

async function simplify(slug, collection) {
  const rawPath = resolve(tmpDir, `${slug}.raw.geojson`);
  const outPath = resolve(outDir, `${slug}.geo.json`);
  writeFileSync(rawPath, JSON.stringify(collection));
  // keep-shapes so no small district is dropped; topology (default) keeps the
  // shared borders between districts coincident after simplification.
  await mapshaper.runCommands(
    `-i "${rawPath}" -simplify 15% keep-shapes -o "${outPath}" format=geojson precision=0.00001`,
  );
}

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

for (const source of CITY_SOURCES) {
  const collection = normalize(source);
  await simplify(source.slug, collection);
  console.log(`✓ ${source.slug} — ${collection.features.length} districts`);
}

rmSync(tmpDir, { recursive: true, force: true });
console.log(`\nWrote ${CITY_SOURCES.length} district maps to public/geo/cities/`);
