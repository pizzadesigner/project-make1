# SDG 11 Best-Practice Dashboard

An interactive dashboard that evaluates SDG 11 projects across nine European
cities and surfaces best-practice projects local governments can adopt. Two
screens: a Europe map (start) and a city/project detail view. Its value is
**traceable numbers** — every figure links to its source.

> **Data status:** the CSVs currently hold _placeholder-but-realistic_ data for
> all nine cities so the pipeline works end to end. Replace the figures and
> sources with researched values before treating any number as authoritative.

## Quick start

```bash
npm install
npm run dev        # vite dev server, http://localhost:5173
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build -> dist/
npm run preview    # serve the production build
npm run check      # eslint + stylelint + prettier --check + vitest  (the gate)
npm run test       # vitest watch
npm run test:e2e   # playwright
npm run geo:build  # rebuild public/geo from world-atlas (simplify + quantize)
npm run data:dump  # parse + validate the CSVs and print the domain objects
```

`npm run check` must pass before every commit (enforced by a `simple-git-hooks`
pre-commit hook).

## Editing the data (no coding required)

The three files in `data/` are the source of truth. Content editors work in a
spreadsheet:

1. Open `data/projects.csv` (or `metrics.csv` / `peer_cities.csv`) in Excel or
   LibreOffice.
2. Edit rows. Keep the header row unchanged.
3. **Save as CSV UTF-8** (Excel: _File → Save As → CSV UTF-8_). This preserves
   diacritics like `Žilina`, `Zlín`, `'s-Hertogenbosch`.
4. Commit the file.

Rules the data must follow:

- `id` is a stable slug used in URLs — never rename or regenerate it.
- `metrics.csv` is **long format**: one row per observation. Never widen it.
- Every numeric claim carries its own `source_url`. **A row with no source does
  not render.**
- An empty cell means "unknown" and renders as `—`, never `0`.

Run `npm run data:dump` to see exactly how a change parses before committing.

## Architecture

Vanilla JS (ES modules) + Vite + d3 v7. No framework, no state library. See
`CLAUDE.md` for the full layout and conventions. In short: `store.js` holds
state, `router.js` maps the hash to a route, `main.js` wires them to views, and
components expose `render(container, props) -> { update, destroy }`.

## Transferability

`transferability_score` (0–100) is a first-class field: a project a Cologne
planner can copy cheaply is more useful than a spectacular one that needed a
canal. The scoring rubric is documented in [`docs/RUBRIC.md`](docs/RUBRIC.md).

## Internationalisation

English is the primary UI locale with German as the fallback bundle. All
user-facing strings live in `src/i18n/strings.{en,de}.json` and are looked up
through `t()`; numbers and currency are formatted with `Intl.NumberFormat`.

## Geodata and licences

Two geodata sources, both fetched once at build time and committed simplified —
never fetched from a CDN at runtime:

- **Country outlines** (`public/geo/europe-countries.topo.json`) from
  [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 1:50m),
  **public domain**. Rebuild with `npm run geo:build`.
- **City silhouettes** (`public/geo/cities/*.geo.json`) from
  **OpenStreetMap** via Nominatim, licensed **ODbL**. Rebuild with
  `npm run cities:build`.

> Map data © OpenStreetMap contributors, available under the Open Database
> License (ODbL). See <https://www.openstreetmap.org/copyright>.
