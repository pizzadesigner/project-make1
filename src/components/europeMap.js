// The Europe map. Draws muted country context, thin borders, and one focusable
// marker per project. Countries are context; the markers are the content.
// Clicking a marker zooms in place — dims every country but the marker's own,
// recedes the other markers, and shows a small floating header. There is no
// navigation away from the map; the only way out is the reset button or
// Escape (see mapView.js).
//
// render(container, { projects, geo, focusedCity, detailCity, locale, onSelect })
// and the component never reads the store — data comes down, selection goes up
// via onSelect(citySlug | null).

import { select, geoPath, zoom, zoomIdentity } from 'd3';
import { feature, mesh } from 'topojson-client';
import { createEuropeProjection, fitToViewport } from '../lib/projection.js';
import { motionMs } from '../lib/a11y.js';
import { t } from '../lib/i18n.js';
import { renderTooltip } from './tooltip.js';

const MARKER_ARROWS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const FOCUS_ZOOM = 5; // L1: city focused
const DETAIL_ZOOM = 8; // L2: diving into the city's own map

export function render(container, props) {
  const size = measure(container);
  const countries = feature(props.geo, props.geo.objects.countries);
  const borders = mesh(props.geo, props.geo.objects.countries, (a, b) => a !== b);
  const projection = fitToViewport(createEuropeProjection(), countries, size.width, size.height);
  const path = geoPath(projection);

  const dom = buildDom(container, size);
  drawGeometry(dom, countries, borders, path);

  const tooltip = renderTooltip(dom.root);
  const markers = drawMarkers(dom.markers, orderProjects(props.projects, props.locale), {
    projection,
    onSelect: props.onSelect,
    tooltip,
  });

  const zoomBehavior = setupZoom(dom, size, markers);
  bindKeyboard(dom.markers, markers);
  dom.reset.addEventListener('click', () => props.onSelect(null));

  let focusedCity = null;
  let detailCity = null;

  return {
    update(next) {
      const nextFocused = next.focusedCity ?? null;
      const nextDetail = next.detailCity ?? null;
      if (nextFocused === focusedCity && nextDetail === detailCity) return;
      focusedCity = nextFocused;
      detailCity = nextDetail;
      const focused = markers.find((m) => m.project.citySlug === focusedCity)?.project ?? null;
      applyCountryFocus(dom, focused);
      applyMarkerFocus(markers, focusedCity);
      applyFocusHeader(dom, focused);
      dom.root.classList.toggle('is-detail', Boolean(detailCity));
      // L2 zooms deeper into the same city than L1 — the "dive in" that reveals
      // the city's own map in the detail overlay.
      const transform = focused
        ? focusTransform(
            size,
            ...projection([focused.lon, focused.lat]),
            detailCity ? DETAIL_ZOOM : FOCUS_ZOOM,
          )
        : zoomIdentity;
      animateZoom(dom.svg, zoomBehavior, transform);
    },
    destroy() {
      tooltip.destroy();
      dom.root.remove();
    },
  };
}

function measure(container) {
  return {
    width: container.clientWidth || 960,
    height: Math.max(container.clientHeight, 480),
  };
}

/** West-to-east-ish stable order for arrow-key navigation. */
function orderProjects(projects, locale) {
  return [...projects].sort((a, b) => a.cityDisplay.localeCompare(b.cityDisplay, locale));
}

function buildDom(container, size) {
  const root = document.createElement('div');
  root.className = 'europe-map';

  const svg = select(root)
    .append('svg')
    .attr('class', 'europe-map__svg')
    .attr('viewBox', `0 0 ${size.width} ${size.height}`)
    .attr('role', 'group')
    .attr('aria-label', t('map.heading'));

  const zoomLayer = svg.append('g').attr('class', 'europe-map__zoom');
  const countries = zoomLayer.append('g').attr('class', 'europe-map__countries');
  const borders = zoomLayer.append('path').attr('class', 'europe-map__borders');
  const markers = zoomLayer.append('g').attr('class', 'europe-map__markers');

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'europe-map__reset button';
  reset.textContent = t('map.resetView');
  root.append(reset);

  const focusHeader = document.createElement('div');
  focusHeader.className = 'europe-map__focus';
  focusHeader.hidden = true;
  root.append(focusHeader);

  container.append(root);
  return {
    root,
    svg: svg.node(),
    zoomLayer: zoomLayer.node(),
    countries,
    borders,
    markers: markers.node(),
    reset,
    focusHeader,
  };
}

function drawGeometry(dom, countries, borders, path) {
  dom.countries
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('class', 'europe-map__country')
    .attr('d', path);
  dom.borders.attr('d', path(borders));
}

function drawMarkers(group, projects, { projection, onSelect, tooltip }) {
  return projects.map((project) => {
    const [x, y] = projection([project.lon, project.lat]);
    const marker = createMarker(project, x, y);
    group.append(marker.node);
    wireMarker(marker, project, { onSelect, tooltip });
    return marker;
  });
}

function createMarker(project, x, y) {
  const node = svgEl('g');
  node.setAttribute('class', 'marker');
  node.setAttribute('transform', `translate(${x}, ${y})`);
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', markerLabel(project));

  const scale = svgEl('g');
  scale.setAttribute('class', 'marker__scale');
  const ripple1 = svgEl('circle');
  ripple1.setAttribute('class', 'marker__ripple');
  ripple1.setAttribute('r', '7');
  const ripple2 = svgEl('circle');
  ripple2.setAttribute('class', 'marker__ripple marker__ripple--delay');
  ripple2.setAttribute('r', '7');
  const pin = svgEl('circle');
  pin.setAttribute('class', 'marker__pin');
  pin.setAttribute('r', '7');
  scale.append(ripple1, ripple2, pin);
  node.append(scale);
  return { node, scale, project, x, y };
}

function wireMarker(marker, project, { onSelect, tooltip }) {
  const select_ = () => onSelect(project.citySlug);
  const show = () => tooltip.show(tooltipHtml(project), marker.x, marker.y);
  marker.node.addEventListener('click', select_);
  marker.node.addEventListener('mouseenter', show);
  marker.node.addEventListener('focus', show);
  marker.node.addEventListener('mouseleave', tooltip.hide);
  marker.node.addEventListener('blur', tooltip.hide);
}

function bindKeyboard(group, markers) {
  group.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.target.dispatchEvent(new MouseEvent('click'));
      return;
    }
    const step = MARKER_ARROWS[event.key];
    if (!step) return;
    event.preventDefault();
    focusNeighbour(markers, event.target, step);
  });
}

/** Move focus to the next non-dimmed marker in the given direction, wrapping. */
function focusNeighbour(markers, current, step) {
  const focusable = markers.filter((m) => m.node.getAttribute('tabindex') === '0');
  const index = focusable.findIndex((m) => m.node === current);
  if (index === -1) return;
  const next = focusable[(index + step + focusable.length) % focusable.length];
  next.node.focus();
}

function setupZoom(dom, size, markers) {
  const behavior = zoom()
    .scaleExtent([MIN_ZOOM, MAX_ZOOM])
    .translateExtent([
      [0, 0],
      [size.width, size.height],
    ])
    .on('zoom', (event) => {
      dom.zoomLayer.setAttribute('transform', event.transform.toString());
      const inverse = 1 / event.transform.k;
      for (const marker of markers) marker.scale.setAttribute('transform', `scale(${inverse})`);
    });
  select(dom.svg).call(behavior);
  return behavior;
}

/** Zoom transform that centres (x, y) in the viewport at the given scale. */
function focusTransform(size, x, y, scale) {
  return zoomIdentity
    .translate(size.width / 2, size.height / 2)
    .scale(scale)
    .translate(-x, -y);
}

function animateZoom(svg, behavior, transform) {
  const duration = motionMs('--motion-slow');
  const selection = select(svg);
  const target = duration > 0 ? selection.transition().duration(duration) : selection;
  target.call(behavior.transform, transform);
}

/** Dim every country but the focused project's own; no-op when nothing is focused. */
function applyCountryFocus(dom, focused) {
  const home = focused?.country ?? null;
  dom.countries
    .selectAll('path')
    .classed('is-focus-home', (d) => home != null && d.properties.name === home)
    .classed('is-focus-dim', (d) => home != null && d.properties.name !== home);
}

/** Recede every marker but the focused one; no-op when nothing is focused. */
function applyMarkerFocus(markers, focusedCity) {
  for (const marker of markers) {
    const isFocused = focusedCity != null && marker.project.citySlug === focusedCity;
    const isOther = focusedCity != null && !isFocused;
    marker.node.classList.toggle('is-focused', isFocused);
    marker.node.classList.toggle('is-other', isOther);
  }
}

function applyFocusHeader(dom, focused) {
  if (!focused) {
    dom.focusHeader.hidden = true;
    dom.focusHeader.replaceChildren();
    return;
  }
  dom.focusHeader.hidden = false;
  dom.focusHeader.innerHTML = `
    <span class="europe-map__focus-name">${escapeHtml(focused.cityDisplay)}</span>
    <span class="europe-map__focus-country">${escapeHtml(focused.country)}</span>
  `;
}

function markerLabel(project) {
  const title = t(`sdg.target.${project.sdg11Target}`);
  return `${project.cityDisplay}: ${project.projectTitle} — ${project.sdg11Target} ${title}`;
}

function tooltipHtml(project) {
  const count = t('map.markerCountOne').replace('{count}', '1');
  return `<strong>${escapeHtml(project.cityDisplay)}</strong><span>${escapeHtml(count)}</span>`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function svgEl(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}
