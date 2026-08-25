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

function setFocusedCity(citySlug) {
  // Leaving/zooming a city also collapses any expanded Exploration widget — it
  // does not outlive the focused city it belongs to, and neither does the module
  // expanded inside it.
  setState({
    focusedCity: citySlug,
    activeCriterion: citySlug ? getState().activeCriterion : null,
    activeModule: citySlug ? getState().activeModule : null,
  });
}

// Each layer clears the one above it: a module is expanded *within* a criterion,
// so switching or closing the criterion takes its focus slot with it rather than
// leaving a key pointing at a card that is no longer on screen.
function setActiveCriterion(criterion) {
  setState({ activeCriterion: criterion, activeModule: null });
}

function setActiveModule(moduleKey) {
  setState({ activeModule: moduleKey });
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
    setFocusedCity,
    setActiveCriterion,
    setActiveModule,
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
    const { projects, metrics, peers, cityIndicators, timeline, milestones, geo } =
      await loadDataset();
    setState({
      status: 'ready',
      projects,
      metrics,
      peers,
      cityIndicators,
      timeline,
      milestones,
      geo,
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
