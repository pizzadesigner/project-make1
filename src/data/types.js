// Domain typedefs shared across the data layer, views and components. These are
// the validated, coerced shapes — numbers are numbers, empty cells are null.
// Import them with `@param {Project}` etc.

/**
 * @typedef {Object} Project
 * @property {string} id            Stable slug, appears in nothing that regenerates it.
 * @property {string} citySlug      City slug used in the URL (#/city/:slug).
 * @property {string} cityDisplay   Human label, diacritics intact ("Žilina").
 * @property {string} country
 * @property {string} countryIso2
 * @property {number} lat
 * @property {number} lon
 * @property {string} projectTitle
 * @property {string} sdg11Target   One of the eleven SDG 11 target codes.
 * @property {string} category
 * @property {string} summary
 * @property {string} description
 * @property {number|null} budgetEur
 * @property {number|null} budgetYear
 * @property {string|null} fundingSource
 * @property {number|null} startYear
 * @property {number|null} endYear
 * @property {string} status
 * @property {number|null} transferabilityScore  0–100; see docs/RUBRIC.md.
 * @property {string} sourceUrl
 * @property {string} sourceLabel
 * @property {string|null} sourceAccessed        ISO date the source was checked.
 */

/**
 * @typedef {Object} Metric
 * @property {string} projectId
 * @property {number|null} year
 * @property {string} metricKey
 * @property {string} metricLabel
 * @property {number|null} value
 * @property {string|null} unit
 * @property {string} sourceUrl     A metric row without a source does not render.
 * @property {string} sourceLabel
 */

/**
 * @typedef {Object} PeerCity
 * @property {string} projectId
 * @property {string} peerCity
 * @property {string} peerCountry
 * @property {string} peerUrl
 * @property {string} relationship
 */

export {};
