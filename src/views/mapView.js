// The single page. Owns the fullscreen stage and the europeMap lifecycle, plus
// the loading/error/empty states so the stage never shows a half-drawn map, and
// the floating controls that overlay every layer.
//
// Everything happens here, in place, with no URL change:
//   L0 overview → click a city → L1 in-place zoom with the Exploration widgets
//   → click a widget → L2 modules → click a module → L3 focus slot.
// Back and Escape step back one layer at a time via stepBack(). #/city/:slug and #/list stay
// reachable only as cold/shared links; nothing here navigates to them.

import { getLocale, t } from '../lib/i18n.js';
import {
  widgetMetricsForProject,
  impactSubMetrics,
  impactModules,
  problemFitModules,
  adoptionModules,
  problemFitForCity,
  cityHasResearchedContent,
} from '../data/selectors.js';
import { loadCityOutline, loadCityDistricts, loadCityInfrastructure } from '../data/load.js';
import * as europeMap from '../components/europeMap.js';
import * as widgetStack from '../components/widgetStack.js';
import * as hintLayer from '../components/hintLayer.js';

// L0 reserves a left column for the project overview panel; the map frames
// Europe in the space to its right. Below OVERVIEW_MIN_WIDTH a side column is
// too cramped, so the panel is dropped and the map re-centres (inset 0).
const OVERVIEW_LEFT_FRACTION = 0.33;
const OVERVIEW_MIN_WIDTH = 860;

/** Left inset (px) to reserve for the overview panel, or 0 on narrow viewports.
 * Takes the width rather than the element because the map asks again on every
 * resize, with the size it has just measured. */
function overviewInset(width) {
  return width >= OVERVIEW_MIN_WIDTH ? Math.round(width * OVERVIEW_LEFT_FRACTION) : 0;
}

/**
 * @param {HTMLElement} container
 * @param {object} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const refs = buildShell(container, props);
  // One floating box for every hover hint under this view — the source chips,
  // the link hostnames, the cards' info points. It lives outside the region so
  // that nothing which scrolls can clip it (hintLayer.js).
  const hints = hintLayer.render(refs.root);
  let mapHandle = null;
  let widgetHandle = null;
  let comingSoonNode = null;
  let focusedCity = null;
  let activeCriterion = null;
  let activeModule = null;
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
      mapHandle.setCityHighlight(null, null);
      mapHandle.setInfrastructure(null, null);
      return undefined;
    }
    const token = ++layersToken;
    loadLayer(slug, districtsCache, loadCityDistricts, token, (data) =>
      mapHandle.setDistricts(slug, data),
    );
    loadLayer(slug, outlineCache, loadCityOutline, token, (data) =>
      mapHandle.setCityHighlight(slug, data),
    );
    loadLayer(slug, infrastructureCache, loadCityInfrastructure, token, (data) =>
      mapHandle.setInfrastructure(slug, data),
    );
    return undefined;
  }

  // One step back through the zoom chain: opened module → expanded widget →
  // focused city → overview. Shared by the Back control and the Escape key so
  // they can't diverge.
  function stepBack() {
    if (activeModule) props.setActiveModule(null);
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
    activeCriterion = next.activeCriterion ?? null;
    activeModule = next.activeModule ?? null;

    refs.updateOverview(next);

    // Reset and the language toggle are always available (top-right). Back
    // appears once a city is focused (L1); the overview panel shows only at L0.
    const atOverview = !(focusedCity || activeCriterion);
    refs.back.hidden = atOverview;
    refs.overview.hidden = !atOverview;
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
    // Which of the city's sub-metrics the L1 Impact widget headlines with.
    const subMetrics = impactSubMetrics(next.cityIndicators, focusedProject?.citySlug ?? null);
    // A focused city with no researched figures (Lisbon, Helsinki) is covered by
    // the "coming soon" overlay instead of empty widgets — see buildComingSoon
    // and .map-coming-soon. Derived, so it clears itself once their data lands.
    const comingSoon =
      Boolean(next.focusedCity) && !cityHasResearchedContent(next.focusedCity, next.cityIndicators);
    const problemFit = problemFitForCity(focusedProject?.citySlug ?? null);
    const widgetProps = {
      project: focusedProject,
      activeCriterion: next.activeCriterion,
      // Which of the criterion's six modules is open in the L3 focus slot, by
      // its key. Guarded inside the component: a key held over from another
      // city names no card in this one's six.
      activeModule: next.activeModule,
      metrics: widgetMetricsForProject(focusedProject, subMetrics),
      // Problem Fit's SDG targets (L1) + the slug keying its prose; null for
      // every city without researched content, so the widget stays empty there.
      // What each criterion's L2 unpacks into — the city's six data topics for
      // Impact, the same Problem Fit narrative one block per card, and what it
      // takes to adopt the project for the third. A city without rows for a
      // topic gets an empty card there, never a filled-in one (see
      // selectors.js#impactModules).
      impactModules: impactModules(next.cityIndicators, focusedProject?.citySlug ?? null),
      problemFitModules: problemFitModules(problemFit, next.milestones),
      adoptionModules: adoptionModules(
        next.cityIndicators,
        focusedProject?.citySlug ?? null,
        next.timeline,
      ),
      // Under the coming-soon overlay the widgets are covered, so they go inert
      // (not click/focus targets) rather than offering an empty L2 to open.
      comingSoon,
      onSelectCriterion: props.setActiveCriterion,
      onSelectModule: props.setActiveModule,
    };

    if (!mapHandle) {
      refs.stage.replaceChildren();
      mapHandle = europeMap.render(refs.stage, {
        projects: next.projects,
        geo: next.geo,
        focusedCity: next.focusedCity,
        locale: next.locale,
        leftInset: (size) => overviewInset(size.width),
        onSelect: (slug) => props.setFocusedCity(slug),
      });
      widgetHandle = widgetStack.render(refs.stage, widgetProps);
      comingSoonNode = buildComingSoon();
      refs.stage.append(comingSoonNode);
    }

    mapHandle.update({
      focusedCity: next.focusedCity,
      // L2/L3 no longer cut the map to one side — the module panel floats over
      // it. The criterion still comes down so the map can zoom the city in while
      // a panel is open (europeMap#L2_MAP_ZOOM) and switch its cycle-route layers.
      activeCriterion: next.activeCriterion,
      locale: next.locale,
    });
    syncCityLayers(next.focusedCity);
    widgetHandle.update(widgetProps);
    comingSoonNode.hidden = !comingSoon;
    // buildComingSoon() bakes the label once; without this it keeps whatever
    // locale was active when the node was first built (todo #7).
    comingSoonNode.querySelector('.map-coming-soon__label').textContent = t('city.comingSoon');
  }

  function teardownMap() {
    if (!mapHandle) return;
    mapHandle.destroy();
    mapHandle = null;
    widgetHandle.destroy();
    widgetHandle = null;
    comingSoonNode = null;
  }

  update(props);

  return {
    update,
    destroy() {
      document.removeEventListener('keydown', handleKeydown);
      hints.destroy();
      teardownMap();
      refs.root.remove();
    },
  };
}

function buildShell(container, props) {
  const root = document.createElement('section');
  root.className = 'view view--map';
  // Controls sit in the corners the map layers leave free: Back top-left above
  // the widget stack, Reset + language top-right. Reset and
  // language show at every layer including the overview (L0); Back appears once
  // a city is focused. Both clusters sit above the L2 overlay so they stay
  // reachable there.
  root.innerHTML = `
    <div class="map-stage" data-stage></div>
    <aside class="map-overview" data-overview hidden>
      <h1 class="map-overview__title"></h1>
      <p class="map-overview__lead"></p>
      <p class="map-overview__hint"></p>
    </aside>
    <div class="map-controls map-controls--top-left">
      <button type="button" class="map-float button" data-back hidden></button>
    </div>
    <div class="map-controls map-controls--top-right">
      <button type="button" class="map-float button" data-reset></button>
      <button type="button" class="map-float button" data-lang-toggle>${props.locale === 'en' ? 'DE' : 'EN'}</button>
      <button type="button" class="map-float button theme-toggle" data-theme-toggle aria-label="Toggle theme">
      <span data-theme-icon class="theme-icon">
        <!-- Wird von updateOverview dynamisch gesetzt -->
      </span>
    </button>
    </div>
  `;
  container.append(root);

  const stage = root.querySelector('[data-stage]');
  const overview = root.querySelector('[data-overview]');
  const back = root.querySelector('[data-back]');
  const reset = root.querySelector('[data-reset]');
  const langToggle = root.querySelector('[data-lang-toggle]');
  const themeToggle = root.querySelector('[data-theme-toggle]');
  const themeIcon = root.querySelector('[data-theme-icon]');

  langToggle.addEventListener('click', props.toggleLocale);
  themeToggle.addEventListener('click', () => {
    props.toggleTheme();
  });

  function updateOverview(nextProps) {
    const title = overview.querySelector('.map-overview__title');
    const lead = overview.querySelector('.map-overview__lead');
    const hint = overview.querySelector('.map-overview__hint');
    title.textContent = t('overview.title');
    lead.innerHTML = t('overview.lead');
    hint.textContent = t('overview.hint');
    back.textContent = `← ${t('detail.back')}`;
    reset.textContent = t('map.resetView');

    const currentLocale = getLocale();
    langToggle.textContent = currentLocale === 'en' ? 'DE' : 'EN';

    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
</svg>`;

    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
  <path d="M9.37 5.51A7.35 7.35 0 0 0 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27A7.014 7.014 0 0 1 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49zM12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
</svg>`;

    if (themeIcon) {
      const theme = nextProps?.theme ?? props.theme ?? 'dark';
      // Sonne für Dark Mode (weil Klick zu Light wechselt), Mond für Light Mode
      const isDark = theme === 'dark';
      themeIcon.innerHTML = isDark ? sunIcon : moonIcon;
    }
  }

  // Initial update
  updateOverview(props);

  return {
    root,
    stage,
    overview,
    back,
    reset,
    langToggle,
    themeToggle,
    themeIcon,
    updateOverview,
  };
}

/** The L1 "coming soon" scrim: a black-transparent layer covering the focused
 * city and its widgets (see .map-coming-soon), shown for cities with no
 * researched content (cityHasResearchedContent). Kept in the DOM and toggled via
 * `hidden`; sits below the corner controls so Back/Reset stay reachable. */
function buildComingSoon() {
  const overlay = document.createElement('div');
  overlay.className = 'map-coming-soon';
  overlay.hidden = true;
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `<span class="map-coming-soon__label">${t('city.comingSoon')}</span>`;
  return overlay;
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
