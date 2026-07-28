// The single page. Owns the shell (title, SDG 11 panel, target filter, year row)
// and the europeMap lifecycle, plus the loading/error/empty states so the stage
// never shows a half-drawn map.
//
// Everything happens here, in place, with no URL change:
//   L0 overview → click a city → L1 in-place zoom + a "View project" pill
//   → click the pill → L2 in-place project detail (cityDetail overlay).
// Escape steps back L2 → L1 → L0. #/city/:slug and #/list stay reachable only
// as cold/shared links; nothing here navigates to them.

import { t } from '../lib/i18n.js';
import { SDG11_TARGET_CODES, SDG11_TARGETS } from '../lib/sdg11.js';
import { availableYears, metricsForProject, widgetMetricsForProject } from '../data/selectors.js';
import * as europeMap from '../components/europeMap.js';
import * as cityDetail from '../components/cityDetail.js';
import * as widgetStack from '../components/widgetStack.js';

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const refs = buildShell(container, props);
  let mapHandle = null;
  let detailHandle = null;
  let widgetHandle = null;
  let filterButtons = null;
  let yearButtons = null;
  let legendNode = null;
  let focusedCity = null;
  let detailCity = null;
  let activeCriterion = null;

  // Escape steps back one layer at a time: L2 detail → expanded widget →
  // focused city → overview.
  function handleKeydown(event) {
    if (event.key !== 'Escape') return;
    if (detailCity) props.closeProjectDetail();
    else if (activeCriterion) props.setActiveCriterion(null);
    else if (focusedCity) props.setFocusedCity(null);
  }
  document.addEventListener('keydown', handleKeydown);

  function update(next) {
    focusedCity = next.focusedCity ?? null;
    detailCity = next.detailCity ?? null;
    activeCriterion = next.activeCriterion ?? null;
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
    if (!yearButtons)
      yearButtons = buildYearBar(refs.yearBar, availableYears(next.metrics), props.setSelectedYear);
    syncYearBar(yearButtons, next.selectedYear);
    mountOrUpdateMap(next);
    return undefined;
  }

  function mountOrUpdateMap(next) {
    const focusedProject = next.projects.find((p) => p.citySlug === next.focusedCity) ?? null;
    const detailOpen = Boolean(next.detailCity) && next.detailCity === next.focusedCity;
    const detailProps = {
      project: focusedProject,
      detailOpen,
      cityIndicators: next.cityIndicators,
      metrics: focusedProject ? metricsForProject(next.metrics, focusedProject.id) : [],
      locale: next.locale,
    };
    // Exploration widgets belong to L1 only — hide them once the L2 overlay opens.
    const widgetProps = {
      project: detailOpen ? null : focusedProject,
      activeCriterion: next.activeCriterion,
      metrics: widgetMetricsForProject(focusedProject),
      onSelectCriterion: props.setActiveCriterion,
    };

    if (!mapHandle) {
      refs.stage.replaceChildren();
      mapHandle = europeMap.render(refs.stage, {
        projects: next.projects,
        geo: next.geo,
        filterTarget: next.filterTarget,
        focusedCity: next.focusedCity,
        detailCity: next.detailCity,
        locale: next.locale,
        onSelect: (slug) => props.setFocusedCity(slug),
      });
      refs.pill = buildViewProjectPill(refs.stage);
      widgetHandle = widgetStack.render(refs.stage, widgetProps);
      detailHandle = cityDetail.render(refs.stage, {
        ...detailProps,
        onClose: props.closeProjectDetail,
      });
      legendNode = buildLegend();
      refs.stage.append(legendNode);
    }

    mapHandle.update({
      filterTarget: next.filterTarget,
      focusedCity: next.focusedCity,
      detailCity: next.detailCity,
    });
    widgetHandle.update(widgetProps);
    detailHandle.update(detailProps);
    syncViewProjectPill(refs.pill, focusedProject, detailOpen, props.openProjectDetail);
  }

  function teardownMap() {
    if (!mapHandle) return;
    mapHandle.destroy();
    mapHandle = null;
    widgetHandle.destroy();
    widgetHandle = null;
    detailHandle.destroy();
    detailHandle = null;
    legendNode = null;
    refs.pill = null;
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
    </header>
    <details class="panel" open>
      <summary class="panel__summary">${t('sdg11.panelTitle')}</summary>
      <p class="panel__body">${t('sdg11.panelBody')}</p>
    </details>
    <div class="filter-bar" role="group" aria-label="${t('filter.legend')}" data-filter></div>
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
    yearBar: root.querySelector('[data-year]'),
    pill: null,
  };
}

/** The L1 affordance: shown under a focused city, opens the L2 detail. */
function buildViewProjectPill(stage) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'map-view-project';
  pill.hidden = true;
  stage.append(pill);
  return pill;
}

function syncViewProjectPill(pill, focusedProject, detailOpen, openProjectDetail) {
  if (!pill) return;
  const show = Boolean(focusedProject) && !detailOpen;
  pill.hidden = !show;
  if (!show) {
    pill.onclick = null;
    return;
  }
  pill.textContent = `${t('map.viewProject')} →`;
  pill.onclick = () => openProjectDetail(focusedProject.citySlug);
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
