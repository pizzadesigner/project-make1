// Single source of truth. No external state library — a plain object plus a
// subscribe() fan-out is all this app needs. Views read state through props
// passed by main.js; components never import this module.

/**
 * @typedef {Object} AppState
 * @property {'idle'|'loading'|'ready'|'error'} status
 * @property {{ name: string, params: Record<string, string> }} route
 * @property {import('./data/types.js').Project[]} projects
 * @property {import('./data/types.js').Metric[]} metrics
 * @property {import('./data/types.js').PeerCity[]} peers
 * @property {import('./data/types.js').CityIndicator[]} cityIndicators  City-level researched context, keyed by citySlug.
 * @property {object|null} geo  Committed Europe TopoJSON, or null until loaded.
 * @property {string|null} focusedCity   citySlug zoomed into on the map (L1), or null. Kept in
 *   the store, not the URL: the in-place zoom is a single-page interaction, so #/city/:slug is
 *   reserved for cold links.
 * @property {'problemFit'|'impact'|'adoption'|null} activeCriterion  Which
 *   Exploration widget (Problem Fit / Impact / Adoption Requirements) is expanded.
 * @property {'en'|'de'} locale
 * @property {Error|null} error
 */

/** @type {AppState} */
const state = {
  status: 'idle',
  route: { name: 'map', params: {} },
  projects: [],
  metrics: [],
  peers: [],
  cityIndicators: [],
  geo: null,
  focusedCity: null,
  activeCriterion: null,
  locale: 'en',
  error: null,
};

/** @type {Set<(state: AppState) => void>} */
const listeners = new Set();

export function getState() {
  return state;
}

/** Shallow-merge a patch and notify every subscriber. */
export function setState(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state);
}

/** @returns {() => void} unsubscribe handle */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
