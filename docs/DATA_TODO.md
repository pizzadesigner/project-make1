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

## Map widgets (Data Quality, Transparency, Inequality) — no backing fields at all

`src/data/selectors.js#widgetMetricsForProject` always returns
`{ dataQuality: null, transparency: null, inequality: null }` — every widget on
the zoomed map renders its "no data" state for all 4 cities right now. This was
a deliberate choice (pure placeholder shells, not a derived/heuristic value) so
nothing gets shown that isn't a real, sourced figure. To wire real data:

- **Data Quality (`dataQuality`, 0–100):** needs a genuine completeness/quality
  score per project — not the same thing as `transferability_score` (that
  measures ease-of-adoption, not data completeness). No column exists yet.
- **Transparency (`transparency`, `'full'|'partial'|'opaque'`):** needs a
  real status per project. Could eventually be derived from how complete the
  sourcing is (`sourceUrl`/`sourceLabel`/`sourceAccessed` all present vs.
  partially/not present) rather than added as a brand-new column — but that
  derivation was explicitly deferred, not implemented, per the human's choice
  of "pure placeholder shells" over "derive from real fields."
- **Inequality (`inequality`, Gini coefficient):** needs a real per-city Gini
  or equivalent figure. No proxy exists in the current schema — this one has
  no realistic derivation from existing fields, a new sourced field is the
  only path.
- District-level green-space bars (the Inequality widget's expandable detail)
  are Phase 5 in `PORTING_GUIDE.md` — not built at all yet, separate from the
  three top-level widget values above.

## Paris / Helsinki — display name is narrower than the underlying project

Per decision (use rows as-is, relabel only): `paris-marne-la-vallee-ecoquartier-2022`
now displays as "Paris" and `helsinki-region-kera-2023` as "Helsinki", but the
actual project content (Cité Descartes eco-district; Kera positive-energy
district) is about Marne-la-Vallée and Espoo, not the city centre. This is an
accepted, intentional approximation, not a bug — noted here so it isn't
"fixed" by accident later.
