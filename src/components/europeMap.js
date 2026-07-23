// The Europe map. Draws muted country context, thin borders, and one focusable
// marker per project. Countries are context; the markers are the content.
//
// render(container, { projects, geo, filterTarget, locale, onSelect }) and the
// component never reads the store — data comes down, selection goes up via
// onSelect(citySlug).

import { select, geoPath, zoom, zoomIdentity } from 'd3';
import { feature, mesh } from 'topojson-client';
import { createEuropeProjection, fitToViewport } from '../lib/projection.js';
import { motionMs } from '../lib/a11y.js';
import { t } from '../lib/i18n.js';
import { renderTooltip } from './tooltip.js';

const MARKER_ARROWS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

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
  applyFilter(markers, props.filterTarget);
  dom.reset.addEventListener('click', () => resetView(dom.svg, zoomBehavior));

  return {
    update(next) {
      applyFilter(markers, next.filterTarget);
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

  container.append(root);
  return {
    root,
    svg: svg.node(),
    zoomLayer: zoomLayer.node(),
    countries,
    borders,
    markers: markers.node(),
    reset,
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

function resetView(svg, behavior) {
  const duration = motionMs('--motion-slow');
  const selection = select(svg);
  const target = duration > 0 ? selection.transition().duration(duration) : selection;
  target.call(behavior.transform, zoomIdentity);
}

function applyFilter(markers, filterTarget) {
  for (const marker of markers) {
    const matched = !filterTarget || marker.project.sdg11Target === filterTarget;
    marker.node.classList.toggle('is-dimmed', !matched);
    marker.node.setAttribute('tabindex', matched ? '0' : '-1');
    marker.node.setAttribute('aria-hidden', matched ? 'false' : 'true');
  }
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
