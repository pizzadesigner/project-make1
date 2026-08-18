// Pure lookups over the loaded dataset. Views use these to pull the slice they
// need; nothing here touches the store or the DOM.

/**
 * @param {import('./types.js').Project[]} projects
 * @param {string} citySlug
 * @returns {import('./types.js').Project|undefined}
 */
export function projectByCitySlug(projects, citySlug) {
  return projects.find((project) => project.citySlug === citySlug);
}

/**
 * Metric rows for a project, oldest year first.
 * @param {import('./types.js').Metric[]} metrics
 * @param {string} projectId
 * @returns {import('./types.js').Metric[]}
 */
export function metricsForProject(metrics, projectId) {
  return metrics
    .filter((metric) => metric.projectId === projectId)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

/**
 * @param {import('./types.js').PeerCity[]} peers
 * @param {string} projectId
 * @returns {import('./types.js').PeerCity[]}
 */
export function peersForProject(peers, projectId) {
  return peers.filter((peer) => peer.projectId === projectId);
}

// Which Impact sub-metric a city surfaces as its L1 headline figure, by
// sub-metric key: Cologne → its cycle network, Paris → its car-ownership share.
// A city absent from this map shows an empty widget rather than a fabricated
// number. This mapping lives in the data layer, not in `widgetStack.js`, because
// "which indicator stands for this city" is a data decision — the widget renders
// whatever it is handed and knows nothing about city slugs.
const IMPACT_HEADLINE_METRIC = {
  koeln: 'cycleNetwork',
  'paris-marne-la-vallee': 'carOwnership',
};

/**
 * Headline figure for each of the three Exploration widgets (Problem Fit /
 * Impact / Adoption Requirements) — the single seam feeding the L1 widget stack.
 *
 * Each field is either null (the widget renders an empty shell — never a
 * fabricated number, see docs/DESIGN_RATIONALE.md) or `{ key, value, unit }`,
 * where `key` names the figure for the label (resolved by the view, `impact.<key>`
 * for Impact's sub-metrics) and may be null when the widget's own title says it.
 *
 * TODO(data): Problem Fit and Adoption have no researched backing field at any
 * city yet, so both are still null everywhere — see docs/research.md §5.4. Impact
 * is wired for the two cities that have a sourced sub-metric.
 * @param {import('./types.js').Project|null} project
 * @param {ReturnType<typeof impactSubMetrics>} [subMetrics] as built for the same city
 * @returns {{ problemFit: WidgetMetric, impact: WidgetMetric, adoption: WidgetMetric }}
 * @typedef {{ key: string|null, value: number, unit: string|null }|null} WidgetMetric
 */
export function widgetMetricsForProject(project = null, subMetrics = []) {
  return {
    problemFit: null,
    impact: impactHeadline(project?.citySlug ?? null, subMetrics),
    adoption: null,
  };
}

/** The figure for a city's L1 Impact widget, or null when the city has none
 * configured or the metric isn't sourced. A year series (car ownership)
 * headlines with its latest value; a single figure (cycle network) as-is. */
function impactHeadline(citySlug, subMetrics) {
  const key = IMPACT_HEADLINE_METRIC[citySlug];
  if (!key) return null;
  const metric = subMetrics.find((entry) => entry.key === key);
  if (!metric || metric.value == null) return null;
  const value = Array.isArray(metric.value)
    ? metric.value[metric.value.length - 1].value
    : metric.value;
  return { key, value, unit: metric.unit };
}

/**
 * Every researched indicator for one city (population, area, green-space share,
 * …), in file order. Keyed by citySlug so a focused city can pull its own
 * context regardless of whether its project row is real or a placeholder.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {import('./types.js').CityIndicator[]}
 */
export function cityIndicatorsForCity(cityIndicators, citySlug) {
  return cityIndicators.filter((indicator) => indicator.citySlug === citySlug);
}

/**
 * The value of a single indicator for a city, or null if it is absent.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @param {string} indicatorKey
 * @returns {number|null}
 */
export function cityIndicatorValue(cityIndicators, citySlug, indicatorKey) {
  const match = cityIndicators.find(
    (indicator) => indicator.citySlug === citySlug && indicator.indicatorKey === indicatorKey,
  );
  return match ? match.value : null;
}

/**
 * Population density (people/km²), derived from the population and area
 * indicators. The research source computes it the same way ("Population /
 * Area"), so it is not stored as its own sourced row — it inherits the
 * provenance of population and area. Returns null if either input is missing or
 * the area is zero.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {number|null}
 */
export function populationDensityForCity(cityIndicators, citySlug) {
  const population = cityIndicatorValue(cityIndicators, citySlug, 'population');
  const area = cityIndicatorValue(cityIndicators, citySlug, 'area_km2');
  if (population === null || area === null || area === 0) return null;
  return population / area;
}

/**
 * TODO(data): district-level green-space breakdown, kept for the Analysis-layer
 * drill-in (Phase 3/5). No per-district data exists in the dataset yet, so it
 * always returns null and no district bars render. See docs/DATA_TODO.md. Shape
 * once real data lands: `{ names: string[], greenSpaceHectares: number[] }`.
 * @returns {null}
 */
export function districtsForProject() {
  return null;
}

/**
 * TODO(data): the reference value an indicator should be read against — "is 373
 * cars per 1000 residents a lot or a little?" (Kennzahlen-Bewertung, review of
 * 2026-08-03). A figure with no yardstick cannot be judged, so each widget
 * figure needs its national / EU / global counterpart beside it.
 *
 * Returns null until sourced benchmark rows exist; `widgetStack.js` renders a
 * "benchmark to follow" note in that case rather than an unlabelled number.
 * Shape once real data lands, mirroring a `cities.csv` row so the same source
 * chip renders: `{ scope: 'national'|'eu'|'global', value: number, unit: string,
 * year: number|null, source: { url, label, accessed } }`.
 * @returns {null}
 */
export function benchmarkForIndicator() {
  return null;
}

/**
 * TODO(data): which SDG-11 target an indicator serves, so the dashboard can show
 * *why* a number matters and not just what it is (review of 2026-08-03,
 * "Verbindung Daten zum Ziel"). `projects.csv` carries `sdg11_target` per
 * project; `cities.csv` has no equivalent per indicator, so the link cannot be
 * derived yet.
 *
 * Returns null until an `sdg_target` column exists. Expected mapping once it
 * does: car density / modal split / cycle network → 11.2, green space → 11.7.
 * Shape: an SDG11_TARGET_CODES code (`'11.2'`).
 * @returns {null}
 */
export function sdgTargetForIndicator() {
  return null;
}

/**
 * TODO(data): the gap between a city's current value and the value its SDG-11
 * target implies — "wenn weniger Autos weniger CO2 bedeutet, wie viel muss
 * passieren?" (review of 2026-08-03). This is the seam for the Analysis layer's
 * "what would have to change" panel.
 *
 * Deliberately unimplemented: it needs a per-city target value and a stated
 * reduction pathway, both of which are decisions the team has not taken (see
 * docs/HANDOFF.md §8). Returning a computed gap against a guessed target would
 * fabricate a claim — Neutrality, docs/DESIGN_RATIONALE.md.
 * Shape once decided: `{ current: number, targetValue: number, unit: string,
 * targetYear: number, source: { url, label, accessed } }`.
 * @returns {null}
 */
export function reductionPathwayForCity() {
  return null;
}

// The Impact widget's L2 sub-metrics are Modal split, Car density and Cycle
// network (per `designWidgets.png`; Lisbon's different trio is not modelled
// yet). Labels resolve via `impact.<key>` in the i18n bundles.
//
// Modal-split transport modes, in the donut's segment order (matches the
// `modal_split_<mode>` indicator keys in cities.csv). Labels: `impact.mode.<mode>`.
// `moto` (motorized two-wheelers) only has rows for Paris so far — missing
// modes default to 0 (see `valueAt` below), so Cologne's rings are unaffected.
const MODAL_SPLIT_MODES = ['transit', 'bike', 'walk', 'car', 'moto'];

/**
 * A city's sourced year series for one indicator key, oldest year first. Used
 * for the Impact "car" slot, which is a different indicator per city — Cologne
 * has `car_density` (vehicles per 1000 residents), Paris `car_ownership`
 * (% of households with a car) — so each city's own `unit` travels with its
 * series rather than being assumed. Empty series and null source when absent.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @param {string} [indicatorKey]
 * @returns {{ series: {year: number, value: number}[], unit: string|null, source: {url: string, label: string, accessed: string|null}|null }}
 */
export function carDensitySeriesForCity(cityIndicators, citySlug, indicatorKey = 'car_density') {
  const rows = cityIndicatorsForCity(cityIndicators, citySlug)
    .filter((indicator) => indicator.indicatorKey === indicatorKey)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const [first] = rows;
  return {
    series: rows.map((row) => ({ year: row.year, value: row.value })),
    unit: first?.unit ?? null,
    source: first
      ? { url: first.sourceUrl, label: first.sourceLabel, accessed: first.sourceAccessed }
      : null,
  };
}

// The Impact "car" slot is one of two genuinely different indicators depending
// on the city: car density (vehicles per 1000 residents) or car ownership
// (% of households with a car). Each keeps its own sub-metric key so it carries
// the right, non-misleading label. First one with rows wins.
const CAR_SLOT_INDICATORS = [
  { indicatorKey: 'car_density', metric: 'carDensity' },
  { indicatorKey: 'car_ownership', metric: 'carOwnership' },
];

/** The car sub-metric for a city — density or ownership, whichever it has —
 * tagged with the metric key that names it. Null when the city has neither. */
function carSlotForCity(cityIndicators, citySlug) {
  for (const { indicatorKey, metric } of CAR_SLOT_INDICATORS) {
    const { series, unit, source } = carDensitySeriesForCity(
      cityIndicators,
      citySlug,
      indicatorKey,
    );
    if (series.length > 0) return { metric, series, unit, source };
  }
  return null;
}

/**
 * A city's modal split as concentric rings (one per year, oldest first), for the
 * donut. Pivots the long-format `modal_split_<mode>` rows into per-year values in
 * fixed mode order. Null for cities without modal-split rows.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {{ modes: string[], rings: {year: number, values: number[]}[], latestYear: number|null, source: {url: string, label: string, accessed: string|null} } | null}
 */
export function modalSplitForCity(cityIndicators, citySlug) {
  const rows = cityIndicatorsForCity(cityIndicators, citySlug).filter((indicator) =>
    indicator.indicatorKey.startsWith('modal_split_'),
  );
  if (rows.length === 0) return null;
  const years = [...new Set(rows.map((row) => row.year).filter((year) => year != null))].sort(
    (a, b) => a - b,
  );
  const valueAt = (year, mode) =>
    rows.find((row) => row.year === year && row.indicatorKey === `modal_split_${mode}`)?.value ?? 0;
  const [first] = rows;
  return {
    modes: MODAL_SPLIT_MODES,
    rings: years.map((year) => ({
      year,
      values: MODAL_SPLIT_MODES.map((mode) => valueAt(year, mode)),
    })),
    latestYear: years[years.length - 1] ?? null,
    source: { url: first.sourceUrl, label: first.sourceLabel, accessed: first.sourceAccessed },
  };
}

// A single, hand-picked lookup, not CSV-driven like the year-series
// indicators above — a strategic target is a one-off goal statement, not a
// repeated measurement. Only a city whose target has actually been opened and
// read (see docs/DATA_TODO.md) gets a row; every other city stays out rather
// than get a guessed number. This is the modal-split-specific edge of the gap
// benchmarkForIndicator / reductionPathwayForCity describe generally above —
// narrower, but sourced, so it doesn't wait on those.
//
// `segments` is the target ring's own two slices (always sums to 100 — that's
// a donut, not an extra claim). Each may carry `actualModes`: which of this
// city's real MODAL_SPLIT_MODES to sum from the latest actual ring for the
// progress line. `comparable: false` means that sum isn't measuring the same
// thing as the target (different survey/population) — widgetStack.js then
// shows a methodology caveat instead of a percentage comparison.
const MODAL_SPLIT_TARGETS = {
  koeln: {
    year: 2025,
    comparable: true,
    segments: [
      { mode: 'umweltverbund', share: 67, actualModes: ['transit', 'bike', 'walk'] },
      { mode: 'car', share: 33 },
    ],
    source: {
      url: 'https://www.stadt-koeln.de/mediaasset/content/pdf66/dritter-nahverkehrsplan-12-2017.pdf',
      label: 'Stadt Köln – 3. Nahverkehrsplan (2017), zitiert „Köln mobil 2025“',
      accessed: '2026-08-18',
    },
  },
  // Paris has no full-split target — only one absolute, city-official share
  // (bike) is ever stated; car/transit are described as relative shifts
  // ("50% less road traffic"), never as target shares, so they can't be
  // recorded without inventing a number the source doesn't give. And the
  // 13% itself is benchmarked against an all-trips survey (EGT 2020), not
  // the home-to-work-commute survey behind this city's actual donut
  // (Insee RP2022) — comparable: false so the panel says so instead of
  // implying a clean percentage-point gap.
  'paris-marne-la-vallee': {
    year: 2030,
    comparable: false,
    segments: [
      { mode: 'bike', share: 13, actualModes: ['bike'] },
      { mode: 'other', share: 87 },
    ],
    source: {
      url: 'https://cdn.paris.fr/paris/2024/03/29/partie-3-scenario-prospectif-2030-vf-7ukO.pdf',
      label: 'Ville de Paris – Plan Local de Mobilité, Scénario prospectif 2030',
      accessed: '2026-08-18',
    },
  },
};

/**
 * A city's *target* modal split — the "how it should look" companion to
 * modalSplitForCity's "how it looks now" — as a two-segment ring (see
 * MODAL_SPLIT_TARGETS above for what each city's segments mean and whether
 * they're comparable to the real data). Null for every city without a
 * sourced, city-official target; widgetStack.js renders nothing extra in
 * that case — the same graceful-null pattern as every other sub-metric here.
 *
 * To remove this feature: delete this constant + function, the
 * `modalSplitTarget` prop in mapView.js, the matching parameter threaded
 * through widgetStack.js, its `.widget-detail__modal-split-compare` block in
 * widgets.css *and* the chip bottom-alignment rule near
 * `.widget-detail__submetric-chip` further down that same file (kept apart
 * from the block above for stylelint's specificity-order rule), the
 * `--color-target-umweltverbund` / `--color-target-other` tokens, and the
 * `impact.modalSplitTarget` / `impact.modalSplitNow` /
 * `impact.modalSplitProgress.*` / `impact.mode.umweltverbund` /
 * `impact.mode.other` i18n keys. Nothing else depends on any of it.
 * @param {string|null} citySlug
 * @returns {{ year: number, comparable: boolean, segments: { mode: string, share: number, actualModes?: string[] }[], source: { url: string, label: string, accessed: string } } | null}
 */
export function modalSplitTargetForCity(citySlug) {
  return (citySlug && MODAL_SPLIT_TARGETS[citySlug]) ?? null;
}

// The Problem Fit widget's content, per city. Only structure lives here; the
// prose is translated copy in i18n keyed by slug (`problemFit.<slug>.*`), the
// same division modalSplitProgress keeps between data and text. Two pieces:
//  - `targets`: the SDG 11 codes (L1), each with a one-line explanation keyed
//    `problemFit.<slug>.target.<code>`.
//  - `body`: the L2 narrative, as ordered blocks. A `{ text }` block is a plain
//    paragraph (i18n suffix in `text`); a `{ term, text }` block is a bold
//    lead-in term + description; `goal: true` marks the closing block for its
//    divider styling. Cities differ in shape — Cologne breaks into two named
//    components + a goal, Paris is a single overview paragraph — so the block
//    list carries that shape rather than the renderer assuming one.
// Cities absent here show an empty Problem Fit widget and the L2 placeholder —
// the same graceful-null pattern as MODAL_SPLIT_TARGETS.
const PROBLEM_FIT = {
  koeln: {
    targets: ['11.2', '11.6'],
    body: [
      { text: 'intro' },
      { term: 'ringsTerm', text: 'ringsBody' },
      { term: 'routesTerm', text: 'routesBody' },
      { term: 'goalTerm', text: 'goalBody', goal: true },
    ],
  },
  'paris-marne-la-vallee': {
    targets: ['11.2', '11.6'],
    body: [{ text: 'overview' }],
  },
};

/**
 * A city's Problem Fit content: its SDG 11 target list, the L2 body blocks, and
 * the slug keying the prose in i18n (`problemFit.<slug>.*`). Null for every city
 * without researched Problem Fit content, so widgetStack.js renders its empty
 * widget and L2 placeholder unchanged.
 * @param {string|null} citySlug
 * @returns {{ slug: string, targets: string[], body: { term?: string, text: string, goal?: boolean }[] } | null}
 */
export function problemFitForCity(citySlug) {
  if (!citySlug || !PROBLEM_FIT[citySlug]) return null;
  return { slug: citySlug, ...PROBLEM_FIT[citySlug] };
}

/**
 * Whether a city has any researched widget content — a Problem Fit entry or at
 * least one sourced Impact sub-metric. Cities without it (Lisbon and Helsinki
 * carry only context rows, no project figures) get a "coming soon" overlay at L1
 * (see mapView.js). Derived, not listed: it flips to true the moment a city's
 * data lands, so the overlay clears itself with nothing to maintain.
 * @param {string|null} citySlug
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @returns {boolean}
 */
export function cityHasResearchedContent(citySlug, cityIndicators = []) {
  if (!citySlug) return false;
  if (problemFitForCity(citySlug)) return true;
  return impactSubMetrics(cityIndicators, citySlug).some((metric) => metric.value != null);
}

/**
 * A city's single cycle-network figure (km per 1000 residents), or null.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {{ value: number, unit: string|null, source: {url: string, label: string, accessed: string|null} } | null}
 */
export function cycleNetworkForCity(cityIndicators, citySlug) {
  const row = cityIndicatorsForCity(cityIndicators, citySlug).find(
    (indicator) => indicator.indicatorKey === 'cycle_network',
  );
  if (!row) return null;
  return {
    value: row.value,
    unit: row.unit,
    source: { url: row.sourceUrl, label: row.sourceLabel, accessed: row.sourceAccessed },
  };
}

/**
 * The Impact widget's three L2 sub-metrics for a city, in display order. Each
 * carries its own value shape (modal split → rings object, car density → year
 * series, cycle network → single figure) and its own source; an unsourced one
 * stays null and renders an honest placeholder — never a fabricated number.
 *
 * `benchmark` and `sdgTarget` ride along on every entry so the widget can show
 * what a figure should be read against and which SDG-11 target it serves. Both
 * are null today (see benchmarkForIndicator / sdgTargetForIndicator) and render
 * as "to follow" notes; wiring them up needs only those two stubs.
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @param {string|null} [citySlug]
 * @returns {{ key: string, value: unknown, unit: string|null, source: {url: string, label: string, accessed: string|null}|null, benchmark: null, sdgTarget: null }[]}
 */
export function impactSubMetrics(cityIndicators = [], citySlug = null) {
  const modalSplit = citySlug ? modalSplitForCity(cityIndicators, citySlug) : null;
  const car = citySlug ? carSlotForCity(cityIndicators, citySlug) : null;
  const cycleNetwork = citySlug ? cycleNetworkForCity(cityIndicators, citySlug) : null;
  return [
    modalSplit
      ? subMetric('modalSplit', modalSplit, '%', modalSplit.source)
      : subMetric('modalSplit', null, null, null),
    car
      ? subMetric(car.metric, car.series, car.unit, car.source)
      : subMetric('carDensity', null, null, null),
    cycleNetwork
      ? subMetric('cycleNetwork', cycleNetwork.value, cycleNetwork.unit, cycleNetwork.source)
      : subMetric('cycleNetwork', null, null, null),
  ];
}

/** One Impact sub-metric entry. The single place the entry shape is built, so
 * the two pending seams stay attached to every key. */
function subMetric(key, value, unit, source) {
  return {
    key,
    value,
    unit,
    source,
    benchmark: benchmarkForIndicator(),
    sdgTarget: sdgTargetForIndicator(),
  };
}
