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
 * A researched, city-level indicator (population, area, green-space share, …),
 * keyed by the same citySlug as Project so a focused city can look up its own
 * context. One row per observation, long format like Metric — never widened.
 * Density is not stored here: it is derived (population / area) in selectors.js.
 * @typedef {Object} CityIndicator
 * @property {string} citySlug          Joins to Project.citySlug.
 * @property {string} indicatorKey      Stable key, e.g. 'population', 'area_km2'.
 * @property {string} indicatorLabel    Human label for the indicator.
 * @property {number|null} value        Empty cell -> null, renders as em dash.
 * @property {string|null} unit
 * @property {number|null} year         The observation year, or null if undated.
 * @property {string} sourceUrl         A row without a source does not render.
 * @property {string} sourceLabel
 * @property {string|null} sourceAccessed  ISO date the source was checked.
 */

export {};

/**
 * One event on a project's timeline (`data/timeline.csv`). Narrative rather than
 * measurement, so it carries no figure and no source of its own.
 * A dated step in the project's public story, for the Problem Fit card's
 * milestone line. Narrative like TimelineEvent, but a point in time rather than
 * a stretch of one: the year is a number because the line is drawn to scale.
 * @typedef {Object} Milestone
 * @property {string} citySlug
 * @property {number} year
 * @property {string} event
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} citySlug
 * @property {string} phase        Which stretch of the story it belongs to.
 * @property {number|null} position  Its place in the order; the track is evenly
 *   spaced, because "Ab 2018" and "Mai–Aug. 2022" are not points in time.
 * @property {string|null} dateLabel  As the source writes it, or null for an
 *   entry that has a status instead.
 * @property {string|null} status  "In Planung" — set where there is no date.
 * @property {string} title
 * @property {string} details
 */
