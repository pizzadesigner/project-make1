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
 * @param {{ projectRows?: object[], metricRows?: object[], peerRows?: object[] }} raw
 * @returns {{ projects: import('./types.js').Project[], metrics: import('./types.js').Metric[], peers: import('./types.js').PeerCity[] }}
 */
export function validateDataset({ projectRows = [], metricRows = [], peerRows = [] }) {
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

  const peers = [];
  for (const row of peerRows) {
    const projectId = toText(row.project_id);
    if (!ids.has(projectId)) {
      issues.push(`Peer city references unknown project_id: "${projectId}"`);
      continue;
    }
    peers.push({
      projectId,
      peerCity: toText(row.peer_city),
      peerCountry: toText(row.peer_country),
      peerUrl: toText(row.peer_url),
      relationship: toText(row.relationship),
    });
  }

  if (issues.length > 0) {
    throw new DataError(
      `Dataset failed validation (${issues.length} issue(s)):\n- ${issues.join('\n- ')}`,
      issues,
    );
  }

  return { projects, metrics, peers };
}
