// Hash router. The URL is the app's state: #/ is the map, #/city/:slug is a
// city view that must load cold from a shared link. Keep this dumb — it maps a
// hash string to a route descriptor and nothing else.

/**
 * @param {string} hash e.g. "#/city/zilina"
 * @returns {{ name: string, params: Record<string, string> }}
 */
export function parseHash(hash) {
  const path = hash.replace(/^#/, '') || '/';

  if (path === '/') return { name: 'map', params: {} };
  if (path === '/list') return { name: 'list', params: {} };

  const city = path.match(/^\/city\/([^/]+)$/);
  if (city) return { name: 'city', params: { slug: decodeURIComponent(city[1]) } };

  return { name: 'notFound', params: { path } };
}

/**
 * Start listening for hash changes and fire once on boot for deep links.
 * @param {(route: ReturnType<typeof parseHash>) => void} onRoute
 * @returns {() => void} teardown handle
 */
export function startRouter(onRoute) {
  const handle = () => onRoute(parseHash(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}

/** @param {string} path e.g. "/city/bern" */
export function navigate(path) {
  window.location.hash = path;
}
