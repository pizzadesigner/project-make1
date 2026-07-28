// The deepest zoom level (L2, "Analysis"): the focused city's own silhouette
// map plus its real, sourced data — city context indicators, project facts and
// the metric trend — revealed in place over the zoomed map. No URL change: this
// is reached by clicking "View project" on a focused city and closed via the
// Back button or Escape (see mapView.js). Provenance and rendering are not
// duplicated — it reuses citySilhouette, sourceChip and lineChart.
//
// render(container, { project, detailOpen, cityIndicators, metrics, locale, onClose })
// Data comes down; the only intent up is onClose().

import { t } from '../lib/i18n.js';
import { formatCurrency, formatYear, formatNumber } from '../lib/format.js';
import { SDG11_TARGETS } from '../lib/sdg11.js';
import { cityIndicatorsForCity, populationDensityForCity } from '../data/selectors.js';
import { loadCitySilhouette } from '../data/load.js';
import * as sourceChip from '../components/sourceChip.js';
import * as lineChart from '../components/lineChart.js';
import * as citySilhouette from '../components/citySilhouette.js';

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'city-detail';
  root.hidden = true;
  container.append(root);

  const children = [];
  let renderedSlug = null;
  let silhouetteToken = 0;
  let current = props;

  function clearChildren() {
    for (const child of children.splice(0)) child.destroy();
  }

  function update(next) {
    current = next;
    const open = Boolean(next.project) && Boolean(next.detailOpen);
    if (!open) {
      if (renderedSlug !== null) {
        clearChildren();
        root.replaceChildren();
        renderedSlug = null;
      }
      root.hidden = true;
      return;
    }
    root.hidden = false;
    if (next.project.citySlug === renderedSlug) return; // static once built
    clearChildren();
    root.replaceChildren();
    renderedSlug = next.project.citySlug;
    build(next);
  }

  function build(state) {
    const { project } = state;
    const panel = elWithClass('div', 'city-detail__panel');

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'city-detail__back button';
    back.textContent = `← ${t('detail.back')}`;
    back.addEventListener('click', () => current.onClose());
    panel.append(back);

    panel.append(header(project), body(project, state, children));
    root.append(panel);
    lazyLoadSilhouette(panel, project, ++silhouetteToken);
  }

  function lazyLoadSilhouette(panel, project, token) {
    const slot = panel.querySelector('[data-silhouette]');
    if (!slot) return;
    loadCitySilhouette(project.citySlug)
      .then((geojson) => {
        if (token !== silhouetteToken) return;
        slot.replaceChildren();
        children.push(citySilhouette.render(slot, { geojson, cityDisplay: project.cityDisplay }));
      })
      .catch(() => {
        if (token !== silhouetteToken) return;
        slot.replaceChildren();
        slot.classList.add('state');
        slot.textContent = t('city.silhouetteUnavailable');
      });
  }

  update(props);

  return {
    update,
    destroy() {
      clearChildren();
      root.remove();
    },
  };
}

function header(project) {
  const target = SDG11_TARGETS[project.sdg11Target];
  const node = elWithClass('header', 'city-detail__header');
  node.style.setProperty('--marker-color', `var(${target.colorVar})`);
  node.innerHTML = `
    <span class="target-badge">${target.glyph} ${escapeHtml(project.sdg11Target)} · ${escapeHtml(t(`sdg.target.${project.sdg11Target}`))}</span>
    <h2 class="city-detail__title">${escapeHtml(project.projectTitle)}</h2>
    <p class="city-detail__place">${escapeHtml(project.cityDisplay)}, ${escapeHtml(project.country)} · ${escapeHtml(t(`status.${project.status}`))}</p>
  `;
  return node;
}

function body(project, state, children) {
  const node = elWithClass('div', 'city-detail__body');
  const figure = elWithClass('figure', 'city-detail__map');
  figure.setAttribute('data-silhouette', '');
  figure.innerHTML = `<div class="skeleton skeleton--silhouette"></div>`;

  const data = elWithClass('div', 'city-detail__data');
  data.append(
    contextSection(project, state, children),
    factsSection(project, state.locale, children),
    chartSection(project, state, children),
  );
  node.append(figure, data);
  return node;
}

/** City-level context: the researched indicators, each with its own source. */
function contextSection(project, state, children) {
  const section = elWithClass('section', 'city-detail__section');
  section.innerHTML = `<h3 class="city-detail__section-title">${t('detail.cityContext')}</h3>`;
  const list = elWithClass('dl', 'facts');

  const indicators = cityIndicatorsForCity(state.cityIndicators, project.citySlug);
  const byKey = (key) => indicators.find((indicator) => indicator.indicatorKey === key) ?? null;

  const population = byKey('population');
  const area = byKey('area_km2');
  const greenSpace = byKey('green_space_share');
  const density = populationDensityForCity(state.cityIndicators, project.citySlug);

  appendIndicator(
    list,
    population,
    valueWithUnit(population, state.locale),
    children,
    state.locale,
  );
  // Density is derived (population / area) — it inherits its inputs' sourcing,
  // so it carries a "derived" note instead of its own source chip.
  appendDerived(
    list,
    t('detail.density'),
    density === null
      ? t('value.missing')
      : `${formatNumber(Math.round(density), state.locale)} /km²`,
    t('detail.densityDerived'),
  );
  appendIndicator(list, area, valueWithUnit(area, state.locale), children, state.locale);
  appendIndicator(
    list,
    greenSpace,
    valueWithUnit(greenSpace, state.locale),
    children,
    state.locale,
  );

  section.append(list);
  return section;
}

function valueWithUnit(indicator, locale) {
  if (!indicator || indicator.value === null) return t('value.missing');
  const value = formatNumber(indicator.value, locale);
  return indicator.unit ? `${value} ${indicator.unit}` : value;
}

function appendIndicator(list, indicator, valueText, children, locale) {
  if (!indicator) return;
  const row = elWithClass('div', 'facts__row');
  row.innerHTML = `
    <dt>${escapeHtml(indicator.indicatorLabel)}</dt>
    <dd>${escapeHtml(valueText)}<span data-chip></span></dd>
  `;
  list.append(row);
  mountChip(
    row.querySelector('[data-chip]'),
    {
      url: indicator.sourceUrl,
      label: indicator.sourceLabel,
      accessed: indicator.sourceAccessed,
      locale,
    },
    children,
  );
}

function appendDerived(list, label, valueText, note) {
  const row = elWithClass('div', 'facts__row');
  row.innerHTML = `
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(valueText)}<span class="facts__hint">${escapeHtml(note)}</span></dd>
  `;
  list.append(row);
}

/** Project-level facts, all covered by the project's own source. */
function factsSection(project, locale, children) {
  const section = elWithClass('section', 'city-detail__section');
  section.innerHTML = `<h3 class="city-detail__section-title">${t('detail.projectFacts')}</h3>`;
  const list = elWithClass('dl', 'facts');
  list.innerHTML = `
    <div class="facts__row">
      <dt>${t('city.budget')}</dt>
      <dd>${escapeHtml(budgetText(project, locale))}<span data-chip></span></dd>
    </div>
    <div class="facts__row">
      <dt>${t('city.funding')}</dt>
      <dd>${escapeHtml(project.fundingSource ?? t('value.missing'))}</dd>
    </div>
    <div class="facts__row">
      <dt>${t('city.timeframe')}</dt>
      <dd>${escapeHtml(`${formatYear(project.startYear)} – ${formatYear(project.endYear)}`)}</dd>
    </div>
    <div class="facts__row">
      <dt>${t('city.transferability')}</dt>
      <dd><strong class="score">${escapeHtml(formatNumber(project.transferabilityScore, locale))}</strong><span class="facts__hint">${t('city.transferabilityHint')}</span></dd>
    </div>
  `;
  section.append(list);
  if (project.sourceUrl) {
    mountChip(
      list.querySelector('[data-chip]'),
      {
        url: project.sourceUrl,
        label: project.sourceLabel,
        accessed: project.sourceAccessed,
        locale,
      },
      children,
    );
  }
  return section;
}

function chartSection(project, state, children) {
  const section = elWithClass('section', 'city-detail__section');
  section.innerHTML = `<h3 class="city-detail__section-title">${t('city.chartTitle')}</h3><div data-chart></div>`;
  const slot = section.querySelector('[data-chart]');
  const metrics = state.metrics.filter((metric) => metric.value !== null);
  if (metrics.length === 0) {
    slot.classList.add('state');
    slot.textContent = t('city.noMetrics');
    return section;
  }
  const series = metrics.map((metric) => ({ year: metric.year, value: metric.value }));
  children.push(lineChart.render(slot, { series, unit: metrics[0].unit, locale: state.locale }));
  const [first] = metrics;
  mountChip(
    section,
    { url: first.sourceUrl, label: first.sourceLabel, accessed: null, locale: state.locale },
    children,
  );
  return section;
}

function mountChip(slot, source, children) {
  if (!slot) return;
  children.push(sourceChip.render(slot, source));
}

function budgetText(project, locale) {
  const amount = formatCurrency(project.budgetEur, locale);
  return project.budgetYear ? `${amount} (${formatYear(project.budgetYear)})` : amount;
}

function elWithClass(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
