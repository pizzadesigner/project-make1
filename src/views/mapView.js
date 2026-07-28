// The single page. Owns the fullscreen stage and the europeMap lifecycle, plus
// the loading/error/empty states so the stage never shows a half-drawn map, and
// two floating controls (language toggle + back) that overlay every layer.
//
// Everything happens here, in place, with no URL change:
//   L0 overview → click a city → L1 in-place zoom + a "View project" pill
//   → click the pill → L2 in-place project detail (cityDetail overlay).
// Back and Escape both step back one layer via stepBack(). #/city/:slug and
// #/list stay reachable only as cold/shared links; nothing here navigates to them.

import { t } from '../lib/i18n.js';
import { metricsForProject, widgetMetricsForProject } from '../data/selectors.js';
import { loadCityOutline, loadCityDistricts, loadCityInfrastructure } from '../data/load.js';
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
  let legendNode = null;
  let focusedCity = null;
  let detailCity = null;
  let activeCriterion = null;
  // Each focused city has three independent geometry layers. They load in
  // parallel — a slow or missing one never holds up the others — and each is
  // cached per city. A shared token drops a fetch that resolves after the user
  // has moved on. Only districts is drawn for now; outline and infrastructure
  // are warmed in cache, ready to render later.
  const outlineCache = new Map();
  const districtsCache = new Map();
  const infrastructureCache = new Map();
  let layersToken = 0;
  let layersSlug;

  function loadLayer(slug, cache, loader, token, draw) {
    if (cache.has(slug)) return draw(cache.get(slug));
    loader(slug)
      .then((data) => {
        cache.set(slug, data);
        if (token === layersToken && mapHandle) draw(data);
      })
      .catch(() => {
        // A missing or invalid file drops just its own layer, not the others.
        if (token === layersToken && mapHandle) draw(null);
      });
    return undefined;
  }

  function syncCityLayers(citySlug) {
    if (!mapHandle) return;
    const slug = citySlug ?? null;
    // React only to an actual city change; repeat updates (e.g. opening L2) must
    // not re-run the fit and fight a manual zoom.
    if (slug === layersSlug) return;
    layersSlug = slug;
    if (!slug) return mapHandle.setDistricts(null, null);
    const token = ++layersToken;
    loadLayer(slug, districtsCache, loadCityDistricts, token, (data) =>
      mapHandle.setDistricts(slug, data),
    );
    // Loaded and cached now; not drawn on the map yet.
    loadLayer(slug, outlineCache, loadCityOutline, token, () => {});
    loadLayer(slug, infrastructureCache, loadCityInfrastructure, token, () => {});
    return undefined;
  }

  // One step back through the zoom chain: L2 detail → expanded widget →
  // focused city → overview. Shared by the Back control and the Escape key so
  // the two can never diverge.
  function stepBack() {
    if (detailCity) props.closeProjectDetail();
    else if (activeCriterion) props.setActiveCriterion(null);
    else if (focusedCity) props.setFocusedCity(null);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') stepBack();
  }
  document.addEventListener('keydown', handleKeydown);
  refs.back.addEventListener('click', stepBack);
  // Reset lives here (top-right) but the actual zoom reset belongs to the map.
  refs.reset.addEventListener('click', () => mapHandle?.resetView());

  function update(next) {
    focusedCity = next.focusedCity ?? null;
    detailCity = next.detailCity ?? null;
    activeCriterion = next.activeCriterion ?? null;
    // Overview (L0) shows only Reset; Back, the language toggle and the legend
    // appear once a city is focused (L1) and stay through the detail layer (L2).
    const atOverview = !(focusedCity || detailCity || activeCriterion);
    refs.back.hidden = atOverview;
    refs.langToggle.hidden = atOverview;
    if (legendNode) legendNode.hidden = atOverview;
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
        focusedCity: next.focusedCity,
        detailCity: next.detailCity,
        locale: next.locale,
        onSelect: (slug) => props.setFocusedCity(slug),
      });
      refs.pill = buildViewProjectPill(refs.stage);
      widgetHandle = widgetStack.render(refs.stage, widgetProps);
      detailHandle = cityDetail.render(refs.stage, detailProps);
      legendNode = buildLegend();
      legendNode.hidden = !next.focusedCity;
      refs.stage.append(legendNode);
    }

    mapHandle.update({
      focusedCity: next.focusedCity,
      detailCity: next.detailCity,
    });
    syncCityLayers(next.focusedCity);
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
  // Controls sit in the corners the map layers leave free: Back top-left above
  // the widget stack, Reset + language top-right, legend bottom-left. Only Reset
  // shows at the overview (L0); the rest appear once a city is focused. Both
  // clusters sit above the L2 overlay so they stay reachable there.
  root.innerHTML = `
    <div class="map-stage" data-stage></div>
    <div class="map-controls map-controls--top-left">
      <button type="button" class="map-float button" data-back hidden>← ${t('detail.back')}</button>
    </div>
    <div class="map-controls map-controls--top-right">
      <button type="button" class="map-float button" data-reset>${t('map.resetView')}</button>
      <button type="button" class="map-float button" data-lang-toggle hidden>${props.locale === 'en' ? 'DE' : 'EN'}</button>
    </div>
  `;
  container.append(root);
  root.querySelector('[data-lang-toggle]').addEventListener('click', props.toggleLocale);
  return {
    root,
    stage: root.querySelector('[data-stage]'),
    back: root.querySelector('[data-back]'),
    reset: root.querySelector('[data-reset]'),
    langToggle: root.querySelector('[data-lang-toggle]'),
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
