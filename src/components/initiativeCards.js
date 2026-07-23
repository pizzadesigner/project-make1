// Initiative card(s) for the focused city, shown only once a criterion widget
// is active too (matches Ripples: fc && ac). Our data model is one project per
// city, so this is always a 0-or-1-card list rather than Ripples' multi-
// initiative array — the structure is kept list-shaped so a future city with
// more than one tracked initiative needs no rework here.
//
// TODO(phase-3): Ripples also gates each card on startYear <= selectedYear <=
// endYear, driven by the time slider. That slider doesn't exist yet, so this
// filter is intentionally not applied — a card shows whenever its city is
// focused and a criterion is active, regardless of year. Wire it once the
// time slider lands.
//
// render(container, { project, activeCriterion }) and the component never
// reads the store or emits anything — it's a pure display, no callbacks up.

import { t } from '../lib/i18n.js';
import { widgetMetricsForProject } from '../data/selectors.js';

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'initiative-cards';
  root.hidden = true;
  container.append(root);

  function update(next) {
    const showInits = Boolean(next.project) && Boolean(next.activeCriterion);
    root.hidden = !showInits;
    root.innerHTML = showInits ? cardHtml(next.project) : '';
  }

  update(props);

  return {
    update,
    destroy() {
      root.remove();
    },
  };
}

function cardHtml(project) {
  const dq = widgetMetricsForProject(project).dataQuality;
  return `
    <div class="initiative-card">
      <div class="initiative-card__header">
        <span class="initiative-card__name">${escapeHtml(project.projectTitle)}</span>
        <span class="initiative-card__status initiative-card__status--${project.status}">${t(`status.${project.status}`)}</span>
      </div>
      <div class="initiative-card__sdg">SDG ${escapeHtml(project.sdg11Target)}</div>
      <div class="initiative-card__row">
        <span class="initiative-card__field-label">${t('initiative.goal')}</span>
        <span class="initiative-card__field-value">${escapeHtml(project.summary)}</span>
      </div>
      <div class="initiative-card__row">
        <span class="initiative-card__field-label initiative-card__field-label--impact">${t('initiative.impact')}</span>
        <span class="initiative-card__field-value">${escapeHtml(project.description)}</span>
      </div>
      <div class="initiative-card__source">${escapeHtml(project.sourceLabel)}${dq != null ? ` · DQ ${dq}${t('widget.outOf100')}` : ''}</div>
    </div>`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
