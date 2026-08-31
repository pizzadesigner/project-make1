# SDG 11 Best-Practice Dashboard

An interactive dashboard that evaluates SDG 11 best-practice projects across four
European PIONEER cities — **Cologne, Paris, Lisbon, Helsinki** — and surfaces the
ones local governments can adopt. The whole dashboard is **one screen**: a Europe
map that is zoomed into in place, layer by layer, with no page change and no
route change. Its value is **traceable numbers** — every figure links to its
source.

## How the interface works

Four layers, each entered by clicking the thing you want to see more of:

| Layer              | What is on screen                                                                                                                                                                          | Entered by          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| **L0** Orientation | Europe with a marker per project, and a project-overview panel in the left column (dropped below 860px, where the map re-centres)                                                          | initial view        |
| **L1** City focus  | The city zoomed in with its districts, outline and — where a file exists — its cycle network drawn, plus three Exploration widgets: **Problem Fit**, **Impact**, **Adoption Requirements** | click a city marker |
| **L2** Modules     | The clicked widget unpacks into a glass panel floating over the map — Problem Fit 4 cards, Impact 6, Adoption 5. The other two widgets dim in place                                        | click a widget      |
| **L3** Focus       | One module opens into a focus slot; the other cards step aside into a rail down the same edge                                                                                              | click a module card |

**Back** and **Escape** step back one layer at a time. **Reset view** re-frames
the map. Markers are keyboard-reachable (`Tab`, then arrow keys between them),
and `prefers-reduced-motion` disables the tweens.

The floating controls sit top-right at every layer: **EN/DE**, a **light/dark
theme** toggle, and **Reset view**.

A city with no researched widget content yet shows a "Coming soon" overlay at L1
rather than three empty widgets. That is derived from the data, not a list —
it clears itself the moment the city's rows land.

## Data status

Cologne is the researched case — the **Kölner Ringe / #RingFrei** cycle project:
22 sourced city indicators, dated milestones, a project timeline, cycle-network
geometry, and the full Adoption Requirements set. Paris carries ten indicators.
Lisbon and Helsinki have only context rows (population, area, green space), so
they still show "Coming soon".

The project rows themselves are the other way round: Paris, Lisbon and Helsinki
have _placeholder-but-realistic_ rows in `projects.csv`, and Cologne's
(`koeln-todo-2026`) is an explicit structural placeholder — real coordinates, no
budget, funding, status or source. Replace the figures and sources with
researched values before treating any number as authoritative.

## Quick start

```bash
npm install
npm run infra:build   # one-off: see below
npm run dev           # vite dev server, http://localhost:5173
```

`public/geo/infrastructure/optimized/` is generated, not committed:
`npm run infra:build` simplifies the cycle-network GeoJSON into it. Without that
step Cologne's cycle layers 404 in dev and five `geoAssets` unit tests fail.
`npm run build` runs it for you; a fresh clone that only runs `npm run check`
does not.

## Scripts

```bash
npm run dev          # dev server
npm run build        # infra:build + production build -> dist/
npm run preview      # serve the production build
npm run check        # eslint + stylelint + prettier --check + vitest run  (the gate)
npm run test         # vitest watch
npm run test:run     # vitest once
npm run test:e2e     # playwright (tests/e2e)
npm run lint:js      # eslint
npm run lint:css     # stylelint
npm run format       # prettier --write
npm run data:dump    # parse + validate the CSVs and print the domain objects
npm run geo:build    # rebuild public/geo/europe-countries.topo.json from world-atlas
npm run cities:build # rebuild city outlines from geoJSONFiles/
npm run infra:build  # simplify the infrastructure GeoJSON into geo/infrastructure/optimized/
```

`npm run check` (209 unit tests, lint, stylelint, format) must pass before every
commit — enforced by a `simple-git-hooks` pre-commit hook. The Playwright specs
in `tests/e2e/` cover the layer transitions (`module-fit`, `focus-slot`,
`l2-no-scrollbar`, `map-*`, `milestones`, `hints`, `smoke`) and are run by hand,
not by the gate.

## Deploying

The same build publishes to two Pages hosts:

- **GitHub Pages** — `.github/workflows/deploy.yml` builds and deploys on every
  push to `main`, passing the sub-path as `BASE_PATH`.
- **GitLab Pages** — `.gitlab-ci.yml` runs the `check` job, then the `pages` job
  builds and publishes on the default branch; Vite reads `CI_PAGES_URL`.

`vite.config.js` derives `base` from whichever variable is set, and `/` outside
CI (dev server, Playwright). There is nothing to configure server-side: the app
is a single page with no router, and the only URL state is the two optional
query parameters below.

## Editing the data

The five files in `data/` are the source of truth. Content editors work in a
spreadsheet:

1. Open the file (e.g. `data/cities.csv`) in Excel or LibreOffice.
2. Edit rows. Keep the header row unchanged.
3. **Save as CSV UTF-8** (Excel: _File → Save As → CSV UTF-8_). This preserves
   diacritics like `Köln`, `Žilina`, `'s-Hertogenbosch`.
4. Commit the file.

| File             | One row is                                                               | Keyed by                 |
| ---------------- | ------------------------------------------------------------------------ | ------------------------ |
| `projects.csv`   | a best-practice project — title, SDG 11 target, budget, transferability  | `id`                     |
| `cities.csv`     | one sourced city indicator observation (population, modal split, air, …) | `city_slug`              |
| `metrics.csv`    | one project metric observation over time                                 | `project_id`             |
| `milestones.csv` | one dated step of the project's story, for the milestone line            | `city_slug` + `key`      |
| `timeline.csv`   | one phase event of the project's story, for the Adoption timeline        | `city_slug` + `position` |

Rules the data must follow:

- `id` and `city_slug` are stable slugs — never rename or regenerate them.
- `cities.csv` and `metrics.csv` are **long format**: one row per observation.
  Never widen them. Density is **derived** (`population / area`), never stored.
- Every numeric claim carries its own `source_url`. **A row with no source does
  not render.**
- An empty cell means "unknown" and renders as `—`, never `0`.
- `milestones.csv` carries a **`key`**, not text: the label lives in
  `src/i18n/strings.{en,de}.json` under `milestone.<key>`, so milestones
  translate like everything else. Keys must be present and unique — `validate.js`
  rejects the file otherwise. (`timeline.csv` still carries its text inline, in
  German.)

Run `npm run data:dump` to see exactly how a change parses before committing.

## Architecture

Vanilla JS (ES modules) + Vite + d3 v7. No framework, no state library, no
router.

```
src/
  main.js          entry: URL params, theme, locale, store subscription
  store.js         one state object + subscribe(); the layer chain lives here
                   (focusedCity → activeCriterion → activeModule), not in the URL
  views/mapView.js the single page: stage, floating controls, layer states
  components/      europeMap, widgetStack, detailContent, lineChart,
                   modalSplitChart, timelineChart, milestoneChart, sourceChip,
                   tooltip, hintLayer
  data/            load.js, validate.js, types.js, cityGeo.js, selectors.js
  lib/             projection, format, i18n, a11y, units, sdg11
  styles/          tokens.css, base.css, components/*.css
```

`selectors.js` is the translation layer: it turns CSV rows into the card lists
each criterion opens into (`problemFitModules`, `impactModules`,
`adoptionModules`), returning an empty shell — never an invented figure — for a
topic a city has no sourced rows for. Components expose
`render(container, props) -> { update, destroy }`, never read the store, and
never touch DOM outside their container: data down, events up via callbacks.

## Design objectives

The interface is built and reviewed against five graphical design objectives —
**comprehensibility** (WCAG-AA contrast, low cognitive load), **neutrality**,
**credibility** (sources on every number), **engagement/curiosity**, and
**cohesion**. The rationale, the code map, and a pre-merge checklist are in
[`docs/DESIGN_RATIONALE.md`](docs/DESIGN_RATIONALE.md).

## Transferability

`transferability_score` (0–100) is a first-class field: a project a Cologne
planner can copy cheaply is more useful than a spectacular one that needed a
canal. The scoring rubric is documented in [`docs/RUBRIC.md`](docs/RUBRIC.md).

## Internationalisation and theming

English is the primary UI locale with German as the fallback bundle. All
user-facing strings live in `src/i18n/strings.{en,de}.json` and are looked up
through `t()`; a missing key falls back to English, then to the key itself, so a
gap is visible rather than blank. Numbers and currency are formatted with
`Intl.NumberFormat`.

Both settings can be preset from the URL and are also toggled in the top-right
controls:

- `?lang=de` — locale (`en` by default).
- `?theme=light` / `?theme=dark` — theme. Without the parameter the last choice
  from `localStorage` wins, then the system `prefers-color-scheme`.

## Geodata and licences

All geodata is committed simplified and served from `public/` — never fetched
from a CDN at runtime.

- **Country outlines** (`public/geo/europe-countries.topo.json`) from
  [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 1:50m),
  **public domain**. Rebuild with `npm run geo:build`.
- **City boundaries** (`public/geo/cities/` and `public/geo/districts/`) are
  simplified from the official administrative boundaries the team maintains in
  `geoJSONFiles/` — Cologne's Stadtbezirke, Lisbon's freguesias, Paris's
  communes, and Helsinki's kaupunginosat from the City of Helsinki
  (Kaupunkimittauspalvelut). Those precise files are the source of truth, not a
  generic OSM silhouette. Rebuild with `npm run cities:build`.
- **Cycle infrastructure** (`public/geo/infrastructure/`) is Cologne's network —
  the separated ("gelbes Netz"), mixed ("grünes Netz") and off-street routes,
  plus the two Ringe highlight layers drawn while Problem Fit is open — and a
  Paris layer. `npm run infra:build` simplifies each one into
  `optimized/`, which is what the app loads.

The paths the app reads are listed once, in `CITY_GEO` (`src/data/cityGeo.js`);
the build scripts derive their outputs from the same map so a rename cannot
silently write to a path nothing reads.
