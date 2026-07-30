// The single page. Owns the fullscreen stage and the europeMap lifecycle, plus
// the loading/error/empty states so the stage never shows a half-drawn map, and
// the floating controls that overlay every layer.
//
// Everything happens here, in place, with no URL change:
//   L0 overview → click a city → L1 in-place zoom with the Exploration widgets.
// Back and Escape step back via stepBack(). #/city/:slug and #/list stay
// reachable only as cold/shared links; nothing here navigates to them.

import { t } from '../lib/i18n.js';
import { widgetMetricsForProject, impactSubMetrics } from '../data/selectors.js';
import { loadCityOutline, loadCityDistricts, loadCityInfrastructure } from '../data/load.js';
import * as europeMap from '../components/europeMap.js';
import * as widgetStack from '../components/widgetStack.js';

/** The map cuts to the side opposite the active widget's data panel. */
function citySideFor(activeCriterion) {
  if (!activeCriterion) return null;
  return widgetStack.widgetSide(activeCriterion) === 'left' ? 'right' : 'left';
}

// L0 reserves a left column for the project overview panel; the map frames
// Europe in the space to its right. Below OVERVIEW_MIN_WIDTH a side column is
// too cramped, so the panel is dropped and the map re-centres (inset 0).
const OVERVIEW_LEFT_FRACTION = 0.33;
const OVERVIEW_MIN_WIDTH = 860;

/** Left inset (px) to reserve for the overview panel, or 0 on narrow viewports. */
function overviewInset(stage) {
  const width = stage.clientWidth;
  return width >= OVERVIEW_MIN_WIDTH ? Math.round(width * OVERVIEW_LEFT_FRACTION) : 0;
}

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const refs = buildShell(container, props);
  let mapHandle = null;
  let widgetHandle = null;
  let legendNode = null;
  let focusedCity = null;
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
    if (!slug) {
      mapHandle.setDistricts(null, null);
      mapHandle.setCityHighlight(null);
      mapHandle.setInfrastructure(null);
      return undefined;
    }
    const token = ++layersToken;
    loadLayer(slug, districtsCache, loadCityDistricts, token, (data) =>
      mapHandle.setDistricts(slug, data),
    );
    loadLayer(slug, outlineCache, loadCityOutline, token, (data) =>
      mapHandle.setCityHighlight(data),
    );
    loadLayer(slug, infrastructureCache, loadCityInfrastructure, token, (data) =>
      mapHandle.setInfrastructure(data),
    );
    return undefined;
  }

  // One step back through the zoom chain: expanded widget → focused city →
  // overview. Shared by the Back control and the Escape key so they can't diverge.
  function stepBack() {
    if (activeCriterion) props.setActiveCriterion(null);
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
    activeCriterion = next.activeCriterion ?? null;
    // Reset and the language toggle are always available (top-right). Back and
    // the legend appear once a city is focused (L1); the overview panel shows
    // only at L0.
    const atOverview = !(focusedCity || activeCriterion);
    refs.back.hidden = atOverview;
    refs.overview.hidden = !atOverview;
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
    const widgetProps = {
      project: focusedProject,
      activeCriterion: next.activeCriterion,
      metrics: widgetMetricsForProject(focusedProject),
      impactSubMetrics: impactSubMetrics(next.cityIndicators, focusedProject?.citySlug ?? null),
      onSelectCriterion: props.setActiveCriterion,
    };

    if (!mapHandle) {
      refs.stage.replaceChildren();
      mapHandle = europeMap.render(refs.stage, {
        projects: next.projects,
        geo: next.geo,
        focusedCity: next.focusedCity,
        locale: next.locale,
        leftInset: overviewInset(refs.stage),
        onSelect: (slug) => props.setFocusedCity(slug),
      });
      widgetHandle = widgetStack.render(refs.stage, widgetProps);
      legendNode = buildLegend();
      legendNode.hidden = !next.focusedCity;
      refs.stage.append(legendNode);
    }

    mapHandle.update({
      focusedCity: next.focusedCity,
      citySide: citySideFor(next.activeCriterion),
      deepZoom: next.activeCriterion === 'impact',
    });
    syncCityLayers(next.focusedCity);
    widgetHandle.update(widgetProps);
  }

  function teardownMap() {
    if (!mapHandle) return;
    mapHandle.destroy();
    mapHandle = null;
    widgetHandle.destroy();
    widgetHandle = null;
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
  // Controls sit in the corners the map layers leave free: Back top-left above
  // the widget stack, Reset + language top-right, legend bottom-left. Reset and
  // language show at every layer including the overview (L0); Back appears once
  // a city is focused. Both clusters sit above the L2 overlay so they stay
  // reachable there.
  root.innerHTML = `
    <div class="map-stage" data-stage></div>
    <aside class="map-overview" data-overview hidden>
      <h1 class="map-overview__title">${t('overview.title')}</h1>
      <p class="map-overview__lead">${t('overview.lead')}</p>
      <p class="map-overview__hint">${t('overview.hint')}</p>
    </aside>
    <div class="map-controls map-controls--top-left">
      <button type="button" class="map-float button" data-back hidden>← ${t('detail.back')}</button>
    </div>
    <div class="map-controls map-controls--top-right">
      <button type="button" class="map-float button" data-reset>${t('map.resetView')}</button>
      <button type="button" class="map-float button" data-lang-toggle>${props.locale === 'en' ? 'DE' : 'EN'}</button>
    </div>
  `;
  container.append(root);
  root.querySelector('[data-lang-toggle]').addEventListener('click', props.toggleLocale);
  return {
    root,
    stage: root.querySelector('[data-stage]'),
    overview: root.querySelector('[data-overview]'),
    back: root.querySelector('[data-back]'),
    reset: root.querySelector('[data-reset]'),
    langToggle: root.querySelector('[data-lang-toggle]'),
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
