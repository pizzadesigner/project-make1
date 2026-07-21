// Renders a city's own administrative boundary as an SVG silhouette — the city's
// real shape, not a generic pin. Unlike the Europe map (which must never use
// geoMercator because of continental distortion), a single-city outline spans a
// few kilometres where Mercator distortion is invisible, and its fitExtent is
// numerically robust — so we use it here to frame the shape reliably.

import { geoMercator, geoPath } from 'd3';

const VIEW = 220;

/**
 * @param {HTMLElement} container
 * @param {{ geojson: import('geojson').Feature, cityDisplay: string }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'city-silhouette');
  svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${props.cityDisplay}`);

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('class', 'city-silhouette__shape');
  path.setAttribute('d', buildPath(props.geojson));
  svg.append(path);
  container.append(svg);

  return {
    update() {},
    destroy() {
      svg.remove();
    },
  };
}

function buildPath(geojson) {
  const projection = geoMercator().fitExtent(
    [
      [8, 8],
      [VIEW - 8, VIEW - 8],
    ],
    geojson,
  );
  return geoPath(projection)(geojson);
}
