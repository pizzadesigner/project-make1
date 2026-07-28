// Parse and validate the CSVs the same way the app does, then print a summary.
// Run with `node scripts/dump-data.mjs` to eyeball the domain objects before any
// UI is built on top of them.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { csvParse } from 'd3';
import { validateDataset } from '../src/data/validate.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => csvParse(readFileSync(resolve(root, 'data', name), 'utf8'));

const { projects, metrics, peers, cityIndicators } = validateDataset({
  projectRows: read('projects.csv'),
  metricRows: read('metrics.csv'),
  peerRows: read('peer_cities.csv'),
  cityRows: read('cities.csv'),
});

console.log(
  `\n✓ Validated ${projects.length} projects, ${metrics.length} metrics, ${peers.length} peers, ${cityIndicators.length} city indicators.\n`,
);

console.table(
  projects.map((project) => ({
    id: project.id,
    citySlug: project.citySlug,
    cityDisplay: project.cityDisplay,
    target: project.sdg11Target,
    budgetEur: project.budgetEur,
    endYear: project.endYear, // null for ongoing projects — renders as em dash
    transferability: project.transferabilityScore,
  })),
);

const sample = projects.find((project) => project.citySlug === 'lisboa');
console.log(`\nSample project (${sample.cityDisplay}), fully coerced:\n`);
console.log(sample);
console.log('\nIts metric series:\n');
console.table(metrics.filter((metric) => metric.projectId === sample.id));

console.log('\nCity indicators (density is derived from population / area, not stored):\n');
console.table(
  cityIndicators.map((indicator) => ({
    citySlug: indicator.citySlug,
    key: indicator.indicatorKey,
    value: indicator.value,
    unit: indicator.unit,
    year: indicator.year, // null for undated indicators — renders as em dash
  })),
);
