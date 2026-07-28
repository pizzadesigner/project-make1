// Entry point: wire the router to the store, and mount the view that matches
// the current route. This is the only module that reads the store and drives
// the views — views receive their data as props and emit intent via callbacks.

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/tokens.css';
import './styles/base.css';

import { getState, setState, subscribe } from './store.js';
import { startRouter, navigate } from './router.js';
import { setLocale } from './lib/i18n.js';
import { loadDataset } from './data/load.js';
import { availableYears } from './data/selectors.js';
import * as mapView from './views/mapView.js';
import * as cityView from './views/cityView.js';
import * as listView from './views/listView.js';
import * as notFoundView from './views/notFoundView.js';

const views = {
  map: mapView,
  list: listView,
  city: cityView,
  notFound: notFoundView,
};

const root = document.querySelector('#app');

let mounted = null; // { name, handle }

function setFilterTarget(target) {
  setState({ filterTarget: target });
}

function setFocusedCity(citySlug) {
  // Leaving/zooming a city also closes any open project detail (L2) and
  // collapses any expanded Exploration widget — none of those states outlive
  // the focused city they belong to.
  setState({
    focusedCity: citySlug,
    detailCity: citySlug ? getState().detailCity : null,
    activeCriterion: citySlug ? getState().activeCriterion : null,
  });
}

/** Open the in-place project detail (L2) for the focused city. */
function openProjectDetail(citySlug) {
  setState({ focusedCity: citySlug, detailCity: citySlug });
}

/** Close the project detail, stepping back to the focused-city level (L1). */
function closeProjectDetail() {
  setState({ detailCity: null });
}

function setActiveCriterion(criterion) {
  setState({ activeCriterion: criterion });
}

function setSelectedYear(year) {
  setState({ selectedYear: year });
}

function toggleLocale() {
  const next = getState().locale === 'en' ? 'de' : 'en';
  setLocale(next);
  setState({ locale: next });
}

function viewProps(state) {
  return {
    ...state,
    navigate,
    setFilterTarget,
    setFocusedCity,
    openProjectDetail,
    closeProjectDetail,
    setActiveCriterion,
    setSelectedYear,
    toggleLocale,
  };
}

function render(state) {
  const view = views[state.route.name] ?? views.notFound;
  const name = state.route.name in views ? state.route.name : 'notFound';

  // Views bake t()-translated strings into HTML once at mount, so a locale
  // change needs a full remount — update() alone would leave stale text.
  if (mounted && mounted.name === name && mounted.locale === state.locale) {
    mounted.handle.update(viewProps(state));
    return;
  }

  if (mounted) mounted.handle.destroy();
  root.replaceChildren();
  mounted = { name, locale: state.locale, handle: view.render(root, viewProps(state)) };
}

async function loadData() {
  setState({ status: 'loading' });
  try {
    const { projects, metrics, peers, cityIndicators, geo } = await loadDataset();
    const years = availableYears(metrics);
    setState({
      status: 'ready',
      projects,
      metrics,
      peers,
      cityIndicators,
      geo,
      selectedYear: years[years.length - 1] ?? null,
    });
  } catch (error) {
    // Loud in dev so bad data is impossible to miss; a graceful error state
    // in prod so the app never renders half-populated cards.
    if (import.meta.env.DEV) throw error;
    setState({ status: 'error', error });
  }
}

function boot() {
  setLocale(getState().locale);
  subscribe(render);
  startRouter((route) => setState({ route }));
  loadData();
}

boot();
