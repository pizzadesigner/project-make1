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
 * TODO(data): takes a project because callers have one, but none of these
 * fields exist in the dataset yet (no dq, transparency or gini column
 * anywhere), so it always returns nulls — every map widget renders its "no
 * data" state. See docs/DATA_TODO.md. This is the one seam to wire up once
 * real fields land; nothing else should need to change.
 * @returns {{ dataQuality: number|null, transparency: 'full'|'partial'|'opaque'|null, inequality: number|null }}
 */
export function widgetMetricsForProject() {
  return { dataQuality: null, transparency: null, inequality: null };
}

/**
 * TODO(data): the Inequality widget's district-level green-space breakdown.
 * No per-district data exists in the dataset at all — always returns null, so
 * the district-bar section never renders (it's additionally gated behind
 * widgetMetricsForProject().inequality being non-null, which it also never
 * is). See docs/DATA_TODO.md. Shape once real data lands:
 * `{ names: string[], greenSpaceHectares: number[] }`.
 * @returns {null}
 */
export function districtsForProject() {
  return null;
}
