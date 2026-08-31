import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mapshaper from 'mapshaper';
import { CITY_GEO } from '../src/data/cityGeo.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');

const SIMPLIFY = '20%';

// Alle Infrastructure‑Pfade aus CITY_GEO sammeln
function collectPaths() {
  const paths = [];
  for (const slug of Object.keys(CITY_GEO)) {
    const entry = CITY_GEO[slug];
    if (!entry.infrastructure) continue;
    if (Array.isArray(entry.infrastructure)) {
      for (const layer of entry.infrastructure) {
        if (layer.path) paths.push(layer.path);
      }
    } else {
      paths.push(entry.infrastructure);
    }
  }
  return [...new Set(paths)]; // Duplikate entfernen
}

async function simplifyFile(relativePath) {
  // Entferne "optimized/" aus dem Pfad, um die Originaldatei zu finden
  const srcRelative = relativePath.replace('/optimized/', '/');
  const srcPath = resolve(publicDir, srcRelative);
  if (!existsSync(srcPath)) {
    console.warn(`Quelldatei nicht gefunden: ${srcRelative} – übersprungen`);
    return;
  }

  // Ziel: gleicher Dateiname im "optimized"-Unterordner des Quellverzeichnisses
  const srcDir = dirname(srcRelative);
  const base = srcRelative.split('/').pop();
  const outDir = resolve(publicDir, srcDir, 'optimized');
  const outPath = resolve(outDir, base);

  mkdirSync(outDir, { recursive: true });

  console.log(`Vereinfache ${srcRelative} → ${outPath}`);
  await mapshaper.runCommands(
    `-i "${srcPath}" -simplify ${SIMPLIFY} keep-shapes -o "${outPath}" format=geojson precision=0.00001`,
  );
  console.log(`✅ ${base} vereinfacht (${SIMPLIFY})`);
}

async function build() {
  const paths = collectPaths();
  if (paths.length === 0) {
    console.log('Keine Infrastructure‑Dateien gefunden.');
    return;
  }
  console.log(`Vereinfache ${paths.length} Datei(en) …`);
  for (const p of paths) {
    await simplifyFile(p);
  }
  console.log('Alle Infrastructure‑Dateien vereinfacht.');
}

build().catch((err) => {
  console.error('❌ Fehler beim Vereinfachen:', err);
  process.exit(1);
});
