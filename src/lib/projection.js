// The one true projection for this map: a conic conformal centred on Europe so
// Finland does not tower over Portugal. Never geoMercator. Zoom/pan is applied
// as an SVG transform, so we project once and only re-fit on resize.

import { geoConicConformal } from 'd3';

/** @returns {import('d3').GeoProjection} */
export function createEuropeProjection() {
  return geoConicConformal().parallels([35, 65]).rotate([-10, 0]);
}

/**
 * Fit the projection to a viewport with uniform padding.
 * @param {import('d3').GeoProjection} projection
 * @param {import('geojson').GeoJSON} geojson  The full feature collection to frame.
 * @param {number} width
 * @param {number} height
 * @param {number} [padding]
 * @returns {import('d3').GeoProjection}
 */
export function fitToViewport(projection, geojson, width, height, padding = 16) {
  projection.fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    geojson,
  );
  return projection;
}
