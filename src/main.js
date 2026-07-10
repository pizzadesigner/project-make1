// Entry point: wire the router to the store, and mount the view that matches
// the current route. This is the only module that reads the store and drives
// the views — views receive their data as props and emit intent via callbacks.

import './styles/tokens.css';
import './styles/base.css';

import { getState, setState, subscribe } from './store.js';
import { startRouter, navigate } from './router.js';
import { setLocale } from './lib/i18n.js';
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

function viewProps(state) {
  return { ...state, navigate };
}

function render(state) {
  const view = views[state.route.name] ?? views.notFound;
  const name = state.route.name in views ? state.route.name : 'notFound';

  if (mounted && mounted.name === name) {
    mounted.handle.update(viewProps(state));
    return;
  }

  if (mounted) mounted.handle.destroy();
  root.replaceChildren();
  mounted = { name, handle: view.render(root, viewProps(state)) };
}

function boot() {
  setLocale(getState().locale);
  subscribe(render);
  startRouter((route) => setState({ route }));
}

boot();
