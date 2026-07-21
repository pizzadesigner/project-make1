// Build the committed Europe geometry from world-atlas (Natural Earth, public
// domain). We clip the world countries to a European frame, simplify and
// quantize hard for a small payload, and emit TopoJSON to public/geo/. The
// source stays in node_modules; only this simplified output is committed.
//
// Run with `npm run geo:build`.

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mapshaper from 'mapshaper';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'node_modules/world-atlas/countries-50m.json');
const outDir = resolve(root, 'public/geo');
const output = resolve(outDir, 'europe-countries.topo.json');

mkdirSync(outDir, { recursive: true });

// A frame around Europe; countries clipped at the edges read as muted context.
const EUROPE_BBOX = '-25,33,45,73';

const commands = [
  `-i "${input}"`,
  '-target countries',
  `-clip bbox=${EUROPE_BBOX}`,
  '-simplify 5% keep-shapes',
  '-filter-fields name',
  `-o "${output}" format=topojson quantization=10000 id-field=name`,
].join(' ');

await mapshaper.runCommands(commands);
console.log(`✓ Wrote ${output}`);
