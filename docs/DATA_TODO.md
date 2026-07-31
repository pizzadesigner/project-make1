# Data TODO

Running list of data gaps opened by the Ripples design/interaction port (see
`PORTING_GUIDE.md`, not committed). Each entry should name the field, which
widget needs it, and what source/shape would satisfy it. Remove an entry once
the real field lands in `data/*.csv` and the widget is wired to it.

## `koeln-todo-2026` (Cologne) — placeholder project row

Added to `data/projects.csv` so Cologne can be plotted on the 4-city map
(Cologne, Paris, Lisbon, Helsinki — see `PORTING_GUIDE.md` §3.8). Coordinates
(50.9375, 6.9603) are real. Everything else is a structural placeholder and
needs real, sourced research before it's authoritative:

- `project_title`, `sdg11_target` (currently `11.2`/transport as a stand-in),
  `category`, `summary`, `description`
- `budget_eur`, `budget_year`, `funding_source`, `start_year`, `end_year`,
  `status` (currently `planned`), `transferability_score`
- `source_url`, `source_label`, `source_accessed`
- No rows in `metrics.csv` or `peer_cities.csv` reference this project yet —
  add them once there's a real project to report on.
- The `id` may need to change once real content replaces this placeholder
  (normally ids are never renamed — an exception because this one was never
  real to begin with).

## Exploration widgets (Problem Fit, Impact, Adoption Requirements) — no backing content yet

The three Exploration-layer widgets shown around a focused city were re-concepted
from the old Data Quality / Transparency / Inequality set (Phase 1). They now
render **intentional placeholder shells** — a label, a "Placeholder" chip and a
dashed stub — because none of their headline content is researched yet.
`src/data/selectors.js#widgetMetricsForProject` returns
`{ problemFit: null, impact: null, adoption: null }`; the nulls keep any
fabricated figure from rendering (Neutrality/Honesty — see `DESIGN_RATIONALE.md`).

To wire real content (Phase 2), decide per city what each widget's headline
figure is and where it is sourced:

- **Problem Fit:** the researched indicator(s) establishing that the project
  addresses a real local need (e.g. population density → pressure on space). No
  committed field maps to this yet.
- **Impact:** the single most important outcome figure (e.g. green-space GA %,
  CO₂ avoided). Each figure needs its own `source_url`.
- **Adoption Requirements:** what another city needs to replicate it. The closest
  existing field is `transferability_score`, but confirm it fits before reusing.
- District-level green-space bars (the Analysis-layer / Phase 5 drill-in detail)
  are not built yet — separate from the three top-level widget headlines above.

## `data/cities.csv` — researched indicators, provenance to confirm

New city-level indicator table (population, area, green-space share) keyed by
`city_slug`, added for the real-data layer. The figures were **transcribed from
the "City Research" screenshots** in `newGuidelinesPic/`, so before treating any
number as authoritative:

- **Verify the values against the underlying research spreadsheet** — they were
  read off images (population, area in km², green-space GA %).
- **`source_url` is the general research-source page**, not a per-city permalink
  (`worldpopulationreview.com/cities`, `citypopulation.de/en/`). Tighten to the
  exact per-city page where possible. Green-space uses per-city IS-Global-Ranking
  URLs already.
- **`source_accessed` is blank** for every row — the access date wasn't captured
  in the research tables. Fill in the real dates (Honesty non-negotiable wants
  them shown).
- **Density is intentionally NOT a row** — it is derived (`population / area`) in
  `selectors.js#populationDensityForCity`, matching how the source computes it.
  Don't add a `density` row; add its inputs.
- The `paris-marne-la-vallee` / `helsinki-region` rows carry **core-city**
  figures (Paris, Helsinki), consistent with the `city_display` relabeling below
  — not figures for the Marne-la-Vallée / Espoo suburbs the project rows describe.
- Cologne (`koeln`) has real city indicators even though `koeln-todo-2026` is a
  placeholder project — city data joins on `city_slug`, independent of the project.

## `car_density` (Cologne, Paris) — sourced and wired, partial history only

Added 5 rows for `koeln` (2021–2025, "per 1000 residents"), citing Stadt Köln's
["Kraftfahrzeuge in Köln im Überblick"](https://www.stadt-koeln.de/artikel/73904/index.html)
— unlike the rows above, `source_accessed` is filled in and `source_url` is the
exact per-city page, not a generic research-source link. Feeds
`selectors.js#carDensitySeriesForCity` → `impactSubMetrics()`'s `carDensity`
slot, which `widgetStack.js` now renders as a real sparkline + source chip for
Cologne (the first of the three Impact sub-metrics — modal split, car density,
cycle network — to move past its placeholder stub; see `TRACKER_30_07.md`).

Added 3 rows for `paris-marne-la-vallee` (2012/2017/2023), citing Insee's
["Comparateur de territoire — Département de Paris"](https://www.insee.fr/en/statistiques/6457611?geo=DEP-75#chiffre-cle-2),
table LOG T12 "Household automotive equipment" (also saved as a screenshot,
`pkwDichteParis`, at the repo root). **This is a different metric from
Cologne's**, not a like-for-like number: Insee reports the **share of
households owning at least one car** (`% of households`), not registered
vehicles per 1000 residents — that per-capita motorisation figure isn't in
this Insee table. Kept as its own honestly-labelled `unit` rather than forced
into "per 1000 residents" (Neutrality/Comparability — see `CLAUDE.MD`);
`carDensitySeriesForCity` already carries `unit` per series, so this needed no
code change, only new CSV rows.

- **Only 2021–2025 are sourced** for Cologne. A candidate longer series
  (2010/2015/2020, 355/356/374) was proposed alongside this one but isn't
  backed by the cited page's "last 5 years" table — dropped rather than
  attached to a citation that doesn't actually support it. If a source for the
  earlier years turns up, those years can be added the same way.
- **Lisbon, Helsinki have no `car_density` rows yet** — same partial-coverage
  pattern as the infrastructure (cycle-route) layer below.
- `impactSubMetrics()`'s `modalSplit` key is still `null` for Paris (only
  Cologne has `modal_split_*` rows), and `cycleNetwork` is still `null` for
  every city except Cologne and Paris (see next entry).

## `cycle_network` (Cologne, Paris) — sourced and wired, single figure each

Cologne: `1.75 km per 1000 residents`, citing Stadt Köln's
["Radverkehrshauptnetz für alle Stadtbezirke"](https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/radverkehrshauptnetz-fuer-alle-stadtbezirke).

Paris: `0.48 km per 1000 residents` (2021), **calculated** as 1000 km of
`aménagements cyclables` ÷ the `paris-marne-la-vallee` population row
(2,074,370) × 1000 — the same per-1000-residents method as Cologne's figure.
Cited to Ville de Paris,
["Comment se sont déplacés les Parisien·ne·s en 2025"](https://www.paris.fr/pages/comment-se-sont-deplaces-les-parisiens-en-2025-35425)
(given as the source for the "1000 km (2021)" figure).

- **Verify before treating as final.** As accessed 2026-07-31, that page's
  visible text reports **1,607 km in 2025** (+2% vs. 2024) rather than the
  cited 1000 km/2021 figure — plausible as the same series a few years on
  (Paris's post-2020 "coronapistes" build-out is well documented), but the
  1000 km/2021 number itself wasn't found in the page's fetched text, only
  supplied as given. Confirm against the page's own chart/graphic (likely
  image-rendered, like the `pkwDichteParis` car-density table) or find a more
  specific citation before calling this settled — same spirit as the dropped
  Cologne 2010/2015/2020 series above.
- Lisbon, Helsinki have no `cycle_network` row yet.

## Paris / Helsinki — display name is narrower than the underlying project

Per decision (use rows as-is, relabel only): `paris-marne-la-vallee-ecoquartier-2022`
now displays as "Paris" and `helsinki-region-kera-2023` as "Helsinki", but the
actual project content (Cité Descartes eco-district; Kera positive-energy
district) is about Marne-la-Vallée and Espoo, not the city centre. This is an
accepted, intentional approximation, not a bug — noted here so it isn't
"fixed" by accident later.

**`lat`/`lon` follows the display name, not the project site** (decision
2026-07-29). Those two rows used to carry the project's own coordinates, which
put their marker outside the silhouette the map draws for them — Helsinki's dot
landed just west of the city, Paris's ~380px off the viewport at L1. `lat`/`lon`
is the **city's** coordinate, the same way Cologne and Lisbon always used it, so
the dot sits on the city it labels. Where the project really is stays in
`summary`, `description`, `funding_source` and `source_url` (Espoo,
Marne-la-Vallée). `src/data/markerPlacement.test.js` holds this contract for any
city added later. Revisit if the map ever needs to pin the true project site —
that wants its own columns, not these.
