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
 * Sorted, deduplicated years for which any metric exists — the shared
 * timeline used across all cities on the map (matches Ripples' `P.years`,
 * without a slider — see the year-picker in mapView.js).
 * @param {import('./types.js').Metric[]} metrics
 * @returns {number[]}
 */
export function availableYears(metrics) {
  const years = new Set(metrics.map((metric) => metric.year).filter((year) => year != null));
  return [...years].sort((a, b) => a - b);
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
