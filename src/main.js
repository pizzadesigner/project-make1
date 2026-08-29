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
import { setLocale } from './lib/i18n.js';
import { loadDataset } from './data/load.js';
import * as mapView from './views/mapView.js';

const root = document.querySelector('#app');

let mounted = null; // { name, handle }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sdg-dashboard-theme', theme);
}

function initTheme() {
  const stored = localStorage.getItem('sdg-dashboard-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  setState({ theme });
  applyTheme(theme);
}

function toggleTheme() {
  const current = getState().theme;
  const next = current === 'dark' ? 'light' : 'dark';
  setState({ theme: next });
  applyTheme(next);
}

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
    setFocusedCity,
    setActiveCriterion,
    setActiveModule,
    toggleLocale,
    toggleTheme,
  };
}

function render(state) {
  if (mounted) {
    mounted.update(viewProps(state));
    return;
  }

  root.replaceChildren();
  const handle = mapView.render(root, viewProps(state));
  mounted = {
    update: handle.update,
    destroy: handle.destroy,
  };
}

async function loadData() {
  setState({ status: 'loading' });
  try {
    const { projects, metrics, cityIndicators, timeline, milestones, geo } = await loadDataset();
    setState({
      status: 'ready',
      projects,
      metrics,
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
  initTheme();
  setLocale(getState().locale);
  subscribe(render);
  loadData();
}

boot();
