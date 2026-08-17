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
