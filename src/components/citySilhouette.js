// Renders a city's own administrative boundary as an SVG shape — the city's real
// districts (from geoJSONFiles/, via scripts/cities-build.mjs), each drawn with
// its internal border, not a generic pin. Unlike the Europe map (which must
// never use geoMercator because of continental distortion), a single city spans
// a few kilometres where Mercator distortion is invisible and its fitExtent is
// numerically robust — so we use it here to frame the shape reliably.

import { geoMercator, geoPath } from 'd3';

const VIEW = 220;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} container
 * @param {{ geojson: import('geojson').FeatureCollection | import('geojson').Feature, cityDisplay: string }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'city-silhouette');
  svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', props.cityDisplay);

  const features = toFeatures(props.geojson);
  // One projection fit to the whole city so its districts stay aligned.
  const projection = geoMercator().fitExtent(
    [
      [8, 8],
      [VIEW - 8, VIEW - 8],
    ],
    { type: 'FeatureCollection', features },
  );
  const path = geoPath(projection);

  for (const feature of features) {
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('class', 'city-silhouette__district');
    shape.setAttribute('d', path(feature) ?? '');
    const name = feature.properties?.name;
    if (name) {
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = name;
      shape.append(title);
    }
    svg.append(shape);
  }
  container.append(svg);

  return {
    update() {},
    destroy() {
      svg.remove();
    },
  };
}

/** Accept a district FeatureCollection or a single Feature (legacy silhouette). */
function toFeatures(geojson) {
  if (!geojson) return [];
  if (geojson.type === 'FeatureCollection') return geojson.features ?? [];
  // mapshaper writes a bare GeometryCollection when a layer carries no
  // per-district properties (Cologne, Lisbon, Paris; Helsinki keeps its 59
  // named districts). fitExtent projects Features, not raw geometries — handed
  // one of these it silently produced NaN bounds and drew "MNaN,NaN…" paths.
  if (geojson.type === 'GeometryCollection') {
    return (geojson.geometries ?? []).map((geometry) => ({
      type: 'Feature',
      properties: {},
      geometry,
    }));
  }
  return [geojson];
}
