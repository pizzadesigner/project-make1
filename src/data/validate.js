// Validation and coercion. CSV gives us strings; this module turns them into
// typed domain objects and refuses to let bad data through silently.
//
// Fatal (throws DataError): duplicate ids, missing/invalid coordinates, unknown
// sdg11_target, orphan project_id. main.js decides policy — loud in dev, an
// error state in prod. Non-fatal: a metric row without a source simply does not
// render, so it is dropped rather than thrown.

import { isKnownTarget } from '../lib/sdg11.js';

export class DataError extends Error {
  /**
   * @param {string} message
   * @param {string[]} [issues]
   */
  constructor(message, issues = []) {
    super(message);
    this.name = 'DataError';
    this.issues = issues;
  }
}

/** Empty cell -> null, otherwise a finite number or NaN (which flags bad data). */
function toNumberOrNull(raw) {
  const text = toTextOrNull(raw);
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

/** Empty cell -> null; otherwise the trimmed string. */
function toTextOrNull(raw) {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

/** Empty cell -> '' for required text fields. */
function toText(raw) {
  return toTextOrNull(raw) ?? '';
}

/** @returns {import('./types.js').Project} */
function coerceProject(row) {
  return {
    id: toText(row.id),
    citySlug: toText(row.city),
    cityDisplay: toText(row.city_display),
    country: toText(row.country),
    countryIso2: toText(row.country_iso2),
    lat: toNumberOrNull(row.lat),
    lon: toNumberOrNull(row.lon),
    projectTitle: toText(row.project_title),
    sdg11Target: toText(row.sdg11_target),
    category: toText(row.category),
    summary: toText(row.summary),
    description: toText(row.description),
    budgetEur: toNumberOrNull(row.budget_eur),
    budgetYear: toNumberOrNull(row.budget_year),
    fundingSource: toTextOrNull(row.funding_source),
    startYear: toNumberOrNull(row.start_year),
    endYear: toNumberOrNull(row.end_year),
    status: toText(row.status),
    transferabilityScore: toNumberOrNull(row.transferability_score),
    sourceUrl: toText(row.source_url),
    sourceLabel: toText(row.source_label),
    sourceAccessed: toTextOrNull(row.source_accessed),
  };
}

function hasValidCoords(project) {
  return (
    project.lat !== null &&
    project.lon !== null &&
    !Number.isNaN(project.lat) &&
    !Number.isNaN(project.lon)
  );
}

/**
 * @param {{ projectRows?: object[], metricRows?: object[], cityRows?: object[], timelineRows?: object[], milestoneRows?: object[] }} raw
 * @returns {{ projects: import('./types.js').Project[], metrics: import('./types.js').Metric[], peers: import('./types.js').PeerCity[], cityIndicators: import('./types.js').CityIndicator[], timeline: import('./types.js').TimelineEvent[], milestones: import('./types.js').Milestone[] }}
 */
export function validateDataset({
  projectRows = [],
  metricRows = [],
  cityRows = [],
  timelineRows = [],
  milestoneRows = [],
}) {
  const issues = [];
  const projects = projectRows.map(coerceProject);

  const ids = new Set();
  for (const project of projects) {
    const label = project.id || '(row with no id)';
    if (!project.id) issues.push('A project row is missing its id.');
    else if (ids.has(project.id)) issues.push(`Duplicate project id: ${project.id}`);
    else ids.add(project.id);

    if (!hasValidCoords(project))
      issues.push(`Project ${label} has missing or invalid coordinates.`);
    if (!isKnownTarget(project.sdg11Target))
      issues.push(`Project ${label} has unknown sdg11_target: "${project.sdg11Target}"`);
  }

  const metrics = [];
  for (const row of metricRows) {
    const projectId = toText(row.project_id);
    if (!ids.has(projectId)) {
      issues.push(`Metric references unknown project_id: "${projectId}"`);
      continue;
    }
    const sourceUrl = toText(row.source_url);
    if (!sourceUrl) continue; // no source -> does not render
    metrics.push({
      projectId,
      year: toNumberOrNull(row.year),
      metricKey: toText(row.metric_key),
      metricLabel: toText(row.metric_label),
      value: toNumberOrNull(row.value),
      unit: toTextOrNull(row.unit),
      sourceUrl,
      sourceLabel: toText(row.source_label),
    });
  }

  // City-level indicators join on citySlug (not project id) — the figures are
  // about the city itself, so they stay valid even where the project row is a
  // placeholder (e.g. Cologne). Same rules as metrics: an unknown city is a
  // thrown issue; a row with no source simply does not render.
  const citySlugs = new Set(projects.map((project) => project.citySlug));
  const cityIndicators = [];
  for (const row of cityRows) {
    const citySlug = toText(row.city_slug);
    if (!citySlugs.has(citySlug)) {
      issues.push(`City indicator references unknown city_slug: "${citySlug}"`);
      continue;
    }
    const sourceUrl = toText(row.source_url);
    if (!sourceUrl) continue; // no source -> does not render
    cityIndicators.push({
      citySlug,
      indicatorKey: toText(row.indicator_key),
      indicatorLabel: toText(row.indicator_label),
      value: toNumberOrNull(row.value),
      unit: toTextOrNull(row.unit),
      year: toNumberOrNull(row.year),
      sourceUrl,
      sourceLabel: toText(row.source_label),
      sourceAccessed: toTextOrNull(row.source_accessed),
    });
  }

  // The project's own story, one row per event. Narrative rather than
  // measurement: these rows carry no figure, so the no-source-no-render rule
  // that guards a number does not apply — an event without a document behind it
  // is still what happened, and where the account came from is a question for
  // the card rather than for the row. An unknown city is still an issue, as
  // everywhere else.
  const timeline = [];
  for (const row of timelineRows) {
    const citySlug = toText(row.city_slug);
    if (!citySlug) continue;
    if (!citySlugs.has(citySlug)) {
      issues.push(`Timeline row references unknown city_slug: "${citySlug}"`);
      continue;
    }
    timeline.push({
      citySlug,
      phase: toText(row.phase),
      position: toNumberOrNull(row.position),
      dateLabel: toTextOrNull(row.date_label),
      status: toTextOrNull(row.status),
      title: toText(row.title),
      details: toText(row.details),
    });
  }
  timeline.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // The milestone line, one row per event. Narrative like the timeline above and
  // unsourced for the same reason — but the year is a figure the chart is drawn
  // to, so a row without a usable one is dropped rather than placed at zero,
  // where it would put a mark on the line in a year nothing happened.
  const milestones = [];
  for (const row of milestoneRows) {
    const citySlug = toText(row.city_slug);
    if (!citySlug) continue;
    if (!citySlugs.has(citySlug)) {
      issues.push(`Milestone row references unknown city_slug: "${citySlug}"`);
      continue;
    }
    const year = toNumberOrNull(row.year);
    if (year == null || !Number.isInteger(year)) {
      issues.push(`Milestone row for "${citySlug}" has no usable year: "${row.year}"`);
      continue;
    }
    milestones.push({ citySlug, year, event: toText(row.event) });
  }
  milestones.sort((a, b) => a.year - b.year);

  if (issues.length > 0) {
    throw new DataError(
      `Dataset failed validation (${issues.length} issue(s)):\n- ${issues.join('\n- ')}`,
      issues,
    );
  }

  return { projects, metrics, cityIndicators, timeline, milestones };
}
