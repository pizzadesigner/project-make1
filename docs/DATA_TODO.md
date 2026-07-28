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

## Paris / Helsinki — display name is narrower than the underlying project

Per decision (use rows as-is, relabel only): `paris-marne-la-vallee-ecoquartier-2022`
now displays as "Paris" and `helsinki-region-kera-2023` as "Helsinki", but the
actual project content (Cité Descartes eco-district; Kera positive-energy
district) is about Marne-la-Vallée and Espoo, not the city centre. This is an
accepted, intentional approximation, not a bug — noted here so it isn't
"fixed" by accident later.
