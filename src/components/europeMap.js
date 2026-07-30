// The Europe map. Draws muted country context, thin borders, and one focusable
// marker per project. Countries are context; the markers are the content.
// Clicking a marker zooms in place — dims every country but the marker's own,
// recedes the other markers, and shows a small floating header. There is no
// navigation away from the map; the only way out is the reset button or
// Escape (see mapView.js).
//
// render(container, { projects, geo, focusedCity, locale, leftInset, onSelect })
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
// A city is a speck on a continent map, so fitting its silhouette needs a very
// deep zoom (~120x for Cologne); the ceiling leaves headroom above that.
const MAX_ZOOM = 200;
const FOCUS_ZOOM = 5; // L1 fallback for cities without a silhouette to fit
// Width kept clear on each side for a widget column, so the focused city fits
// between them; CITY_FILL is the fraction of that free area the silhouette fills.
const WIDGET_STRIP = 340;
const CITY_FILL = 0.75;
// L2 pushes the city into one half and zooms a touch deeper — a city-level
// cutout, freeing the opposite half for the widget's data panel.
const CITY_L2_ZOOM = 1.2;
// Above this scale, the country/border geometry is swapped for a flat backdrop
// (see buildDom) — well above FOCUS_ZOOM (the regional zoom for cities without a
// silhouette), well below a real city fit (40x-120x+).
const DEEP_ZOOM_THRESHOLD = 15;

export function render(container, props) {
  const size = measure(container);
  // The committed TopoJSON has a single object; take it by value rather than a
  // fixed key so a re-simplified or hand-edited file (which may name the layer
  // differently) still loads.
  const topology = Object.values(props.geo.objects)[0];
  const countries = feature(props.geo, topology);
  const borders = mesh(props.geo, topology, (a, b) => a !== b);
  // A left inset (for the L0 overview panel) frames Europe in the space to the
  // right; irrelevant at L1/L2, which zoom into a city regardless of framing.
  const projection = fitToViewport(
    createEuropeProjection(),
    countries,
    size.width,
    size.height,
    16,
    props.leftInset ?? 0,
  );
  const path = geoPath(projection);

  const dom = buildDom(container, size);
  drawGeometry(dom, countries, borders, path);

  // Whether the live selection started from a visible keyboard focus. Decides
  // whether stepping back to the overview hands the marker its focus back
  // (see releaseMarkerFocus).
  let keyboardSelection = false;

  const tooltip = renderTooltip(dom.root);
  const markers = drawMarkers(dom.markers, orderProjects(props.projects, props.locale), {
    projection,
    onSelect: (citySlug, viaKeyboard) => {
      keyboardSelection = viaKeyboard;
      props.onSelect(citySlug);
    },
    tooltip,
    onHover: (project) => applyCountryHover(dom, project.country),
    onHoverEnd: () => applyCountryHover(dom, null),
  });

  const zoomBehavior = setupZoom(dom, size, markers);
  bindKeyboard(dom.markers, markers);

  let focusedCity = null;
  // When a widget's L2 is open, the city is cut to this side ('left' | 'right')
  // to free the opposite half for the data panel; null at L1 (centred).
  let citySide = null;
  // Manual zoom/pan is for the overview only. Once a city is focused (L1/L2) the
  // view is static — Esc, Back or Reset are the only ways out. Programmatic
  // transforms (focus, reset) bypass this filter.
  zoomBehavior.filter((event) => !focusedCity && defaultZoomFilter(event));
  // Fit info per city with a loaded silhouette, so L1 can frame the city in one
  // step once its geometry is known.
  const cityFit = new Map();

  // The city transform for the current layer: L2 cutout when a side is set and
  // the fit is known, otherwise the centred L1 frame (or a regional fallback).
  function cityTransform(focused) {
    const fit = cityFit.get(focused.citySlug);
    if (fit && citySide) return cityL2Transform(size, fit, citySide);
    if (fit) return cityFitTransform(size, fit);
    return focusTransform(size, ...projection([focused.lon, focused.lat]), FOCUS_ZOOM);
  }

  return {
    update(next) {
      const nextFocused = next.focusedCity ?? null;
      const nextSide = next.citySide ?? null;
      if (nextFocused === focusedCity && nextSide === citySide) return;
      const focusChanged = nextFocused !== focusedCity;
      focusedCity = nextFocused;
      citySide = nextSide;
      const focused = markers.find((m) => m.project.citySlug === focusedCity)?.project ?? null;
      if (focusChanged) {
        applyCountryFocus(dom, focused);
        applyMarkerFocus(markers, focusedCity);
        applyFocusHeader(dom, focused);
      }
      // L0 resets to the overview; L1 frames the city; L2 cuts it to one side.
      const transform = focused ? cityTransform(focused) : zoomIdentity;
      animateZoom(dom.svg, zoomBehavior, transform);
      if (!focused) releaseMarkerFocus(markers, keyboardSelection);
    },
    // Return to the default overview: snap the d3.zoom transform back to
    // identity (so a manual pan/zoom is undone even with no city focused) and
    // clear any selection.
    resetView() {
      props.onSelect(null);
      animateZoom(dom.svg, zoomBehavior, zoomIdentity);
    },
    // Draw (or clear, when passed null) a city's district overview. Geometry is
    // projected with the map's own projection so it lands over the real city and
    // scales with the zoom. Recording the fit here also lets a still-focused
    // city snap to frame once its geometry finishes loading.
    setDistricts(slug, districts) {
      const layer = select(dom.districts);
      layer.selectAll('*').remove();
      if (!districts) {
        cityFit.delete(slug);
        return;
      }
      layer
        .selectAll('.europe-map__district')
        .data(districts.features)
        .join('path')
        .attr('class', 'europe-map__district')
        .attr('d', path);
      cityFit.set(slug, cityFitInfo(path, size, districts));
      const focused = markers.find((m) => m.project.citySlug === slug)?.project ?? null;
      if (focused && slug === focusedCity) {
        animateZoom(dom.svg, zoomBehavior, cityTransform(focused));
      }
    },
    // Draw (or clear, when passed null) the focused city's own highlight shape.
    // Cities without outline geometry simply show no highlight — the country is
    // never substituted in (see applyCountryFocus).
    setCityHighlight(outline) {
      const layer = select(dom.cityHighlight);
      layer.selectAll('*').remove();
      if (!outline) return;
      layer
        .append('path')
        .attr('class', 'europe-map__city-highlight-shape')
        .attr('d', path(outline));
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

  // Sits outside the zoom layer, so it is never itself put through an extreme
  // scale transform. Stands in for the country geometry during deep zoom (see
  // setupZoom) — a flat fill is visually identical to that geometry at deep
  // zoom anyway, without the animated-seam artifacts of scaling many adjacent
  // topojson paths up ~100x.
  const backdrop = svg
    .append('rect')
    .attr('class', 'europe-map__backdrop')
    .attr('width', size.width)
    .attr('height', size.height)
    .attr('fill', 'none');

  const zoomLayer = svg.append('g').attr('class', 'europe-map__zoom');
  const countries = zoomLayer.append('g').attr('class', 'europe-map__countries');
  const borders = zoomLayer.append('path').attr('class', 'europe-map__borders');
  // The focused city's own highlight — the country never is (see
  // applyCountryFocus) — drawn under the district hairlines so they still
  // read as dividing lines over it.
  const cityHighlight = zoomLayer.append('g').attr('class', 'europe-map__city-highlight');
  // District overview for a focused city — drawn inside the zoom layer so it
  // tracks pan/zoom, and below the markers so they stay the interactive layer.
  const districts = zoomLayer.append('g').attr('class', 'europe-map__districts');
  const markers = zoomLayer.append('g').attr('class', 'europe-map__markers');

  const focusHeader = document.createElement('div');
  focusHeader.className = 'europe-map__focus';
  focusHeader.hidden = true;
  root.append(focusHeader);

  container.append(root);
  return {
    root,
    svg: svg.node(),
    zoomLayer: zoomLayer.node(),
    backdrop,
    countries,
    borders,
    markers: markers.node(),
    cityHighlight: cityHighlight.node(),
    districts: districts.node(),
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

/** Swap the multi-path country/border geometry for a flat backdrop rect (and
 * back) as the zoom crosses DEEP_ZOOM_THRESHOLD — including mid-transition, so
 * the expensive geometry is never animated through the deep-zoom range. Plain
 * country fill: the country is background, never highlighted (the city is —
 * see setCityHighlight). `wasDeep` is the caller's own state, so each map
 * instance tracks its own. */
function setDeepZoom(dom, next, wasDeep) {
  if (next === wasDeep) return next;
  dom.countries.attr('display', next ? 'none' : null);
  dom.borders.attr('display', next ? 'none' : null);
  dom.backdrop.attr('fill', next ? 'var(--color-country-fill)' : 'none');
  return next;
}

function drawMarkers(group, projects, { projection, onSelect, tooltip, onHover, onHoverEnd }) {
  return projects.map((project) => {
    const [x, y] = projection([project.lon, project.lat]);
    const marker = createMarker(project, x, y);
    group.append(marker.node);
    wireMarker(marker, project, { onSelect, tooltip, onHover, onHoverEnd });
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

function wireMarker(marker, project, { onSelect, tooltip, onHover, onHoverEnd }) {
  // Report whether the focus ring was already showing when the marker was
  // activated: only a keyboard user should get focus handed back on the way out.
  const select_ = () => onSelect(project.citySlug, marker.node.matches(':focus-visible'));
  // Hovering (or keyboard-focusing) a marker shows its tooltip and highlights
  // the country the city sits in; leaving reverts both.
  const enter = () => {
    tooltip.show(tooltipHtml(project), marker.x, marker.y);
    onHover(project);
  };
  const leave = () => {
    tooltip.hide();
    onHoverEnd();
  };
  marker.node.addEventListener('click', select_);
  marker.node.addEventListener('mouseenter', enter);
  marker.node.addEventListener('focus', enter);
  marker.node.addEventListener('mouseleave', leave);
  marker.node.addEventListener('blur', leave);
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

/** d3.zoom's default gesture filter: allow wheel/drag unless a modifier or a
 * secondary mouse button is involved. Reused so focus-gating keeps that base. */
function defaultZoomFilter(event) {
  return (!event.ctrlKey || event.type === 'wheel') && !event.button;
}

function setupZoom(dom, size, markers) {
  let isDeepZoom = false;
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
      // Fires continuously through the animated transition too (not just at
      // rest), so the swap happens before the deep-zoom range is reached.
      isDeepZoom = setDeepZoom(dom, event.transform.k >= DEEP_ZOOM_THRESHOLD, isDeepZoom);
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

/** Fit info (centroid + scale) to frame a city's districts in the free area
 * between the two widget columns. */
function cityFitInfo(path, size, districts) {
  const [[x0, y0], [x1, y1]] = path.bounds(districts);
  const width = x1 - x0;
  const height = y1 - y0;
  // A widget column sits on each side, so reserve both.
  const usableWidth = size.width - 2 * WIDGET_STRIP;
  const scale = Math.min(usableWidth / width, size.height / height) * CITY_FILL;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale: Math.min(scale, MAX_ZOOM) };
}

/** Transform centring the fitted city between the two widget columns. */
function cityFitTransform(size, info) {
  return zoomIdentity
    .translate(size.width / 2, size.height / 2)
    .scale(info.scale)
    .translate(-info.cx, -info.cy);
}

/** L2 cutout: the city anchored into one half and zoomed a touch deeper, so the
 * opposite half is free for the widget data panel. */
function cityL2Transform(size, info, side) {
  const anchorX = side === 'left' ? size.width * 0.3 : size.width * 0.7;
  const scale = Math.min(info.scale * CITY_L2_ZOOM, MAX_ZOOM);
  return zoomIdentity
    .translate(anchorX, size.height / 2)
    .scale(scale)
    .translate(-info.cx, -info.cy);
}

function animateZoom(svg, behavior, transform) {
  const duration = motionMs('--motion-slow');
  const selection = select(svg);
  const target = duration > 0 ? selection.transition().duration(duration) : selection;
  target.call(behavior.transform, transform);
}

/** Dim every country but the focused project's own, which stays at its plain
 * fill — the country itself is never highlighted, only the city (see
 * setCityHighlight); no-op when nothing is focused. */
function applyCountryFocus(dom, focused) {
  const home = focused?.country ?? null;
  dom.countries
    .selectAll('path')
    .classed('is-focus-dim', (d) => home != null && countryName(d) !== home);
}

/** Highlight the one country a hovered marker sits in (its fill lightens);
 * pass null to clear. */
function applyCountryHover(dom, country) {
  dom.countries
    .selectAll('path')
    .classed('is-hover-home', (d) => country != null && countryName(d) === country);
}

/** Natural Earth's name lives in `name`; some exports use `NAME`. */
function countryName(d) {
  return d.properties.name ?? d.properties.NAME ?? null;
}

/** Back at the overview, drop the focus a pointer-driven selection left on its
 * marker. Escape is a keyboard interaction, so the browser starts matching
 * :focus-visible on the still-focused marker and its pin keeps the enlarged
 * focus size with nothing on screen to explain it — the Back control never showed
 * this because clicking it moves focus off the marker. A keyboard-driven
 * selection keeps focus, so arrow-key navigation resumes where it left off. */
function releaseMarkerFocus(markers, keyboardSelection) {
  if (keyboardSelection) return;
  const active = document.activeElement;
  if (markers.some((marker) => marker.node === active)) active.blur();
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
