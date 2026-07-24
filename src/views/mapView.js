// Start screen. Owns the page shell (title, SDG 11 panel, target filter) and the
// lifecycle of the europeMap component, plus the loading/error/empty states so
// the stage never shows a half-drawn map.

import { t } from '../lib/i18n.js';
import { SDG11_TARGET_CODES, SDG11_TARGETS } from '../lib/sdg11.js';
import { widgetMetricsForProject, districtsForProject, availableYears } from '../data/selectors.js';
import * as europeMap from '../components/europeMap.js';
import * as widgetStack from '../components/widgetStack.js';
import * as initiativeCards from '../components/initiativeCards.js';

const CRITERIA = ['dq', 'tr', 'ineq'];

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const refs = buildShell(container, props);
  let mapHandle = null;
  let widgetsHandle = null;
  let initiativesHandle = null;
  let filterButtons = null;
  let criteriaButtons = null;
  let yearButtons = null;
  let legendNode = null;
  let focusedCity = null;

  function handleKeydown(event) {
    if (event.key === 'Escape' && focusedCity) props.setFocusedCity(null);
  }
  document.addEventListener('keydown', handleKeydown);

  function update(next) {
    focusedCity = next.focusedCity ?? null;
    refs.tagline.hidden = Boolean(focusedCity);
    if (next.status === 'error') {
      teardownMap();
      return showState(refs.stage, 'state--error', t('state.error'));
    }
    if (next.status !== 'ready' || !next.geo) {
      return showSkeleton(refs.stage);
    }
    if (next.projects.length === 0) {
      teardownMap();
      return showState(refs.stage, 'state--empty', t('state.empty'));
    }

    if (!filterButtons) filterButtons = buildFilterBar(refs.filterBar, next, props.setFilterTarget);
    syncFilterBar(filterButtons, next.filterTarget);
    if (!criteriaButtons)
      criteriaButtons = buildCriteriaBar(refs.criteriaBar, props.setActiveCriterion);
    syncCriteriaBar(criteriaButtons, next.activeCriterion);
    if (!yearButtons)
      yearButtons = buildYearBar(refs.yearBar, availableYears(next.metrics), props.setSelectedYear);
    syncYearBar(yearButtons, next.selectedYear);
    mountOrUpdateMap(next);
    return undefined;
  }

  function mountOrUpdateMap(next) {
    const focusedProject = next.projects.find((p) => p.citySlug === next.focusedCity) ?? null;
    const widgetsProps = {
      project: focusedProject,
      activeCriterion: next.activeCriterion,
      metrics: widgetMetricsForProject(focusedProject),
      districts: districtsForProject(focusedProject),
    };
    const initiativesProps = {
      project: focusedProject,
      activeCriterion: next.activeCriterion,
      selectedYear: next.selectedYear,
    };
    if (mapHandle) {
      mapHandle.update({ filterTarget: next.filterTarget, focusedCity: next.focusedCity });
      widgetsHandle.update(widgetsProps);
      initiativesHandle.update(initiativesProps);
      return;
    }
    refs.stage.replaceChildren();
    mapHandle = europeMap.render(refs.stage, {
      projects: next.projects,
      geo: next.geo,
      filterTarget: next.filterTarget,
      focusedCity: next.focusedCity,
      locale: next.locale,
      onSelect: (slug) => props.setFocusedCity(slug),
    });
    widgetsHandle = widgetStack.render(refs.stage, {
      ...widgetsProps,
      onSelectCriterion: (criterion) => props.setActiveCriterion(criterion),
    });
    initiativesHandle = initiativeCards.render(refs.stage, initiativesProps);
    legendNode = buildLegend();
    refs.stage.append(legendNode);
  }

  function teardownMap() {
    if (!mapHandle) return;
    mapHandle.destroy();
    mapHandle = null;
    widgetsHandle.destroy();
    widgetsHandle = null;
    initiativesHandle.destroy();
    initiativesHandle = null;
    legendNode = null;
  }

  update(props);

  return {
    update,
    destroy() {
      document.removeEventListener('keydown', handleKeydown);
      teardownMap();
      refs.root.remove();
    },
  };
}

function buildShell(container, props) {
  const root = document.createElement('section');
  root.className = 'view view--map';
  root.innerHTML = `
    <header class="view__header">
      <div class="view__header-row">
        <h1 class="view__title">${t('map.heading')}</h1>
        <button type="button" class="button view__lang-toggle" data-lang-toggle>${props.locale === 'en' ? 'DE' : 'EN'}</button>
      </div>
      <p class="view__tagline">${t('app.tagline')}</p>
      <nav class="view__nav">
        <a class="button" href="#/list">${t('nav.list')}</a>
      </nav>
    </header>
    <details class="panel" open>
      <summary class="panel__summary">${t('sdg11.panelTitle')}</summary>
      <p class="panel__body">${t('sdg11.panelBody')}</p>
    </details>
    <div class="filter-bar" role="group" aria-label="${t('filter.legend')}" data-filter></div>
    <div class="filter-bar" role="group" aria-label="${t('criteria.legend')}" data-criteria></div>
    <div class="year-bar" role="group" aria-label="${t('year.legend')}" data-year></div>
    <div class="map-stage" data-stage></div>
  `;
  container.append(root);
  root.querySelector('[data-lang-toggle]').addEventListener('click', props.toggleLocale);
  return {
    root,
    tagline: root.querySelector('.view__tagline'),
    stage: root.querySelector('[data-stage]'),
    filterBar: root.querySelector('[data-filter]'),
    criteriaBar: root.querySelector('[data-criteria]'),
    yearBar: root.querySelector('[data-year]'),
  };
}

/** Ripples' actual/target/above/below/missing swatch legend — always
 * visible, not gated on focus (unlike the tagline; see legend.css). */
function buildLegend() {
  const legend = document.createElement('ul');
  legend.className = 'legend';
  legend.setAttribute('aria-label', t('legend.ariaLabel'));
  const items = [
    ['actual', t('legend.actual')],
    ['target', t('legend.target')],
    ['above', t('legend.aboveTarget')],
    ['below', t('legend.belowTarget')],
    ['missing', t('legend.missing')],
  ];
  for (const [modifier, label] of items) {
    const item = document.createElement('li');
    item.className = 'legend__item';
    const swatch = document.createElement('span');
    swatch.className = `legend__swatch legend__swatch--${modifier}`;
    const text = document.createElement('span');
    text.textContent = label;
    item.append(swatch, text);
    legend.append(item);
  }
  return legend;
}

function presentTargets(projects) {
  return SDG11_TARGET_CODES.filter((code) =>
    projects.some((project) => project.sdg11Target === code),
  );
}

function buildFilterBar(container, state, setFilterTarget) {
  const buttons = [{ target: null, node: filterButton(t('filter.all'), null) }];
  for (const code of presentTargets(state.projects)) {
    buttons.push({
      target: code,
      node: filterButton(`${SDG11_TARGETS[code].glyph} ${code}`, code),
    });
  }
  for (const { target, node } of buttons) {
    node.addEventListener('click', () => setFilterTarget(target));
    container.append(node);
  }
  return buttons;
}

function filterButton(label, code) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-bar__chip';
  button.textContent = label;
  if (code) {
    button.style.setProperty('--marker-color', `var(${SDG11_TARGETS[code].colorVar})`);
    button.title = t(`sdg.target.${code}`);
  }
  return button;
}

function syncFilterBar(buttons, filterTarget) {
  for (const { target, node } of buttons) {
    node.setAttribute('aria-pressed', String(target === (filterTarget ?? null)));
  }
}

function criterionLabel(criterion) {
  if (criterion === 'dq') return t('criteria.dataQuality');
  if (criterion === 'tr') return t('criteria.transparency');
  return t('criteria.inequality');
}

function buildCriteriaBar(container, setActiveCriterion) {
  const buttons = [{ criterion: null, node: criterionButton(t('criteria.all')) }];
  for (const criterion of CRITERIA) {
    buttons.push({ criterion, node: criterionButton(criterionLabel(criterion)) });
  }
  for (const { criterion, node } of buttons) {
    node.addEventListener('click', () => setActiveCriterion(criterion));
    container.append(node);
  }
  return buttons;
}

function criterionButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-bar__chip filter-bar__chip--plain';
  button.textContent = label;
  return button;
}

function syncCriteriaBar(buttons, activeCriterion) {
  for (const { criterion, node } of buttons) {
    node.setAttribute('aria-pressed', String(criterion === (activeCriterion ?? null)));
  }
}

/** No slider (see PORTING_GUIDE.md) — a row of clickable years instead. */
function buildYearBar(container, years, setSelectedYear) {
  const buttons = years.map((year) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'year-bar__year';
    button.textContent = String(year);
    button.addEventListener('click', () => setSelectedYear(year));
    container.append(button);
    return { year, node: button };
  });
  return buttons;
}

function syncYearBar(buttons, selectedYear) {
  for (const { year, node } of buttons) {
    node.setAttribute('aria-pressed', String(year === selectedYear));
  }
}

function showSkeleton(stage) {
  stage.replaceChildren();
  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton skeleton--map';
  stage.append(skeleton);
}

function showState(stage, modifier, message) {
  stage.replaceChildren();
  const box = document.createElement('div');
  box.className = `state ${modifier}`;
  box.textContent = message;
  stage.append(box);
}
