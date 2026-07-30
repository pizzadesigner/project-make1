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

/**
 * Headline figure for each of the three Exploration widgets (Problem Fit /
 * Impact / Adoption Requirements). TODO(data): the per-widget content is not
 * researched yet, so every field is null and each widget renders an intentional
 * placeholder shell rather than a fabricated number (Neutrality/Honesty — see
 * docs/DESIGN_RATIONALE.md, docs/DATA_TODO.md). This is the one seam to wire up
 * once real, sourced content lands (Phase 2); nothing else should need to change.
 * @returns {{ problemFit: number|null, impact: number|null, adoption: number|null }}
 */
export function widgetMetricsForProject() {
  return { problemFit: null, impact: null, adoption: null };
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

// The Impact widget's L2 sub-metrics are Modal split, Car density and Cycle
// network (per `designWidgets.png`; Lisbon's different trio is not modelled
// yet). Labels resolve via `impact.<key>` in the i18n bundles.
//
// Modal-split transport modes, in the donut's segment order (matches the
// `modal_split_<mode>` indicator keys in cities.csv). Labels: `impact.mode.<mode>`.
const MODAL_SPLIT_MODES = ['transit', 'bike', 'walk', 'car'];

/**
 * Cologne's sourced Pkw-Dichte (car density) series, oldest year first — the
 * only city with `car_density` rows in `cities.csv` so far (2021–2025, Stadt
 * Köln). Empty series and null source for any city without them.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {{ series: {year: number, value: number}[], unit: string|null, source: {url: string, label: string, accessed: string|null}|null }}
 */
export function carDensitySeriesForCity(cityIndicators, citySlug) {
  const rows = cityIndicatorsForCity(cityIndicators, citySlug)
    .filter((indicator) => indicator.indicatorKey === 'car_density')
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
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @param {string|null} [citySlug]
 * @returns {{ key: string, value: unknown, unit: string|null, source: {url: string, label: string, accessed: string|null}|null }[]}
 */
export function impactSubMetrics(cityIndicators = [], citySlug = null) {
  const modalSplit = citySlug ? modalSplitForCity(cityIndicators, citySlug) : null;
  const carDensity = citySlug
    ? carDensitySeriesForCity(cityIndicators, citySlug)
    : { series: [], unit: null, source: null };
  const cycleNetwork = citySlug ? cycleNetworkForCity(cityIndicators, citySlug) : null;
  return [
    modalSplit
      ? { key: 'modalSplit', value: modalSplit, unit: '%', source: modalSplit.source }
      : { key: 'modalSplit', value: null, unit: null, source: null },
    carDensity.series.length > 0
      ? {
          key: 'carDensity',
          value: carDensity.series,
          unit: carDensity.unit,
          source: carDensity.source,
        }
      : { key: 'carDensity', value: null, unit: null, source: null },
    cycleNetwork
      ? {
          key: 'cycleNetwork',
          value: cycleNetwork.value,
          unit: cycleNetwork.unit,
          source: cycleNetwork.source,
        }
      : { key: 'cycleNetwork', value: null, unit: null, source: null },
  ];
}
