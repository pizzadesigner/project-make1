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
//
// The stage owns the map's size: a ResizeObserver re-fits the projection, the
// markers and the city layers whenever it changes, so the map is sized by the
// window rather than by whatever the window happened to be at mount.

import { select, geoPath, zoom, zoomIdentity } from 'd3';
import { feature, mesh } from 'topojson-client';
import { createEuropeProjection, fitToViewport } from '../lib/projection.js';
import { motionMs, prefersReducedMotion } from '../lib/a11y.js';
import { t } from '../lib/i18n.js';
import { renderTooltip } from './tooltip.js';

const MARKER_ARROWS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const MIN_ZOOM = 1;
// A city is a speck on a continent map, so fitting its silhouette needs a very
// deep zoom (~120x for Cologne); the ceiling leaves headroom above that.
const MAX_ZOOM = 200;
const FOCUS_ZOOM = 5; // L1 fallback for cities without a silhouette to fit
const MAP_PADDING = 16; // uniform gap between the fitted continent and the stage
// Width kept clear on each side for a widget column, so the focused city fits
// between them; CITY_FILL is the fraction of that free area the silhouette fills.
// The reserve is also capped at a fraction of the stage, because a flat 340px a
// side eats a narrow one whole: at 760px wide it left 80px to fit the city into
// and Cologne came out a 60px speck. Below ~1550px the cap takes over and the
// city always keeps ~56% of the width.
const WIDGET_STRIP = 340;
const WIDGET_STRIP_MAX_FRACTION = 0.22;
const CITY_FILL = 0.75;
// L2 pushes the city into one half and zooms a touch deeper — a city-level
// cutout, freeing the opposite half for the widget's modules.
const CITY_L2_ZOOM = 1.2;
// Impact's L2 goes deeper still: the city is pushed almost off-canvas on its
// side (just a corner staying visible) so its modules can use most of the freed
// width for the sub-metric breakdown.
const IMPACT_L2_ZOOM = 2.4;
// Above this scale, the country/border geometry is swapped for a flat backdrop
// (see buildDom) — well above FOCUS_ZOOM (the regional zoom for cities without a
// silhouette), well below a real city fit (40x-120x+).
const DEEP_ZOOM_THRESHOLD = 15;

export function render(container, props) {
  let size = measure(container);
  // The committed TopoJSON has a single object; take it by value rather than a
  // fixed key so a re-simplified or hand-edited file (which may name the layer
  // differently) still loads.
  const topology = Object.values(props.geo.objects)[0];
  const countries = feature(props.geo, topology);
  const borders = mesh(props.geo, topology, (a, b) => a !== b);
  // fitToViewport re-fits this projection in place, so geoPath keeps reading the
  // live one and a resize needs no new path.
  const projection = createEuropeProjection();
  const path = geoPath(projection);
  // A left inset (for the L0 overview panel) frames Europe in the space to the
  // right; irrelevant at L1/L2, which zoom into a city regardless of framing.
  // It arrives as a function of the measured size because the panel is dropped
  // on narrow stages — a resize has to be able to ask again.
  const leftInsetFor = (measured) => props.leftInset?.(measured) ?? 0;

  const dom = buildDom(container, size);

  // Whether the live selection started from a visible keyboard focus. Decides
  // whether stepping back to the overview hands the marker its focus back
  // (see releaseMarkerFocus).
  let keyboardSelection = false;
  // The live zoom transform, mirrored out of the zoom handler so the tooltip can
  // anchor to a marker's current screen position rather than its unzoomed one.
  let viewTransform = zoomIdentity;

  const tooltip = renderTooltip(dom.root);
  const markers = drawMarkers(dom.markers, orderProjects(props.projects, props.locale), {
    onSelect: (citySlug, viaKeyboard) => {
      keyboardSelection = viaKeyboard;
      props.onSelect(citySlug);
    },
    tooltip,
    pointOf: (marker) => viewTransform.apply([marker.x, marker.y]),
    onHover: (project) => applyCountryHover(dom, project.country),
    onHoverEnd: () => applyCountryHover(dom, null),
  });

  const zoomBehavior = setupZoom(dom, markers, (transform) => {
    viewTransform = transform;
  });
  bindKeyboard(dom.markers, markers);

  let focusedCity = null;
  // When a widget's L2 is open, the city is cut to this side ('left' | 'right')
  // to free the opposite half for the data panel; null at L1 (centred).
  let citySide = null;
  // Impact's L2 pushes further than the other widgets (see IMPACT_L2_ZOOM).
  let deepZoom = false;
  // The focused city's geometry, kept rather than only drawn: a resize has to
  // redraw it against the re-fitted projection. Only ever one city's, so its fit
  // (which lets L1 frame the city in one step) is a single value beside it.
  const cityLayers = { slug: null, districts: null, outline: null, infrastructure: null };
  let cityFit = null;

  /** Stash one of the focused city's layers and redraw. Moving to another city
   * drops the layers still held for the previous one, so a slow fetch can never
   * leave two cities' geometry drawn at once. */
  function setCityLayer(slug, name, data) {
    if (slug !== cityLayers.slug) {
      Object.assign(cityLayers, { slug, districts: null, outline: null, infrastructure: null });
    }
    cityLayers[name] = data;
    drawCityLayers();
  }

  /** Redraw the focused city's three layers and re-measure its fit. Called on
   * every layer change and again whenever the stage resizes. */
  function drawCityLayers() {
    // Districts get one path per feature — they read as separate areas. The
    // outline and the cycle network are each a single path; the network
    // deliberately so, one animated element regardless of route count.
    const districts = select(dom.districts);
    districts.selectAll('*').remove();
    if (cityLayers.districts) {
      districts
        .selectAll('.europe-map__district')
        .data(cityLayers.districts.features)
        .join('path')
        .attr('class', 'europe-map__district')
        .attr('d', path);
    }
    drawSinglePath(dom.cityHighlight, cityLayers.outline, 'europe-map__city-highlight-shape', path);

    //drawSinglePath(dom.infrastructure, cityLayers.infrastructure, 'europe-map__cycle-path', path);
    const infra = select(dom.infrastructure);
    infra.selectAll('*').remove();
    if (cityLayers.infrastructure) {
      const layers = Array.isArray(cityLayers.infrastructure)
        ? cityLayers.infrastructure
        : [{ data: cityLayers.infrastructure, className: 'europe-map_cycle-path' }];
      for (const layer of layers) {
        if (!layer.data) continue;
        // Wenn es ein FeatureCollection ist, in einzelne Features zerlegen
        const features = layer.data.features || [layer.data];
        for (const feature of features) {
          infra
            .append('path')
            .attr('class', layer.className || 'europe-map__cycle-path')
            .attr('d', path(feature));
        }
      }
    }

    cityFit = cityLayers.districts ? cityFitInfo(path, size, cityLayers.districts) : null;
  }

  // The city transform for the current layer: L2 cutout when a side is set and
  // the fit is known, otherwise the centred L1 frame (or a regional fallback).
  function cityTransform(focused) {
    const fit = cityLayers.slug === focused.citySlug ? cityFit : null;
    if (fit && citySide) return cityL2Transform(size, fit, citySide, deepZoom);
    if (fit) return cityFitTransform(size, fit);
    return focusTransform(size, ...projection([focused.lon, focused.lat]), FOCUS_ZOOM);
  }

  /** The transform the current layer says the view should be at. */
  function layerTransform() {
    const focused = markers.find((m) => m.project.citySlug === focusedCity)?.project ?? null;
    return focused ? cityTransform(focused) : zoomIdentity;
  }

  /** Size everything to the current stage: the viewBox and backdrop, the fitted
   * projection, and everything drawn through it. */
  function layout() {
    select(dom.svg).attr('viewBox', `0 0 ${size.width} ${size.height}`);
    dom.backdrop.attr('width', size.width).attr('height', size.height);
    fitToViewport(projection, countries, size.width, size.height, MAP_PADDING, leftInsetFor(size));
    drawGeometry(dom, countries, borders, path);
    placeMarkers(markers, projection);
    drawCityLayers();
    zoomBehavior.translateExtent([
      [0, 0],
      [size.width, size.height],
    ]);
  }

  // A resize invalidates the frame the current view was computed in, so re-frame
  // the current layer rather than keep a transform fitted to a stage that is
  // gone. That does drop a manual zoom, which only meant anything against the
  // framing it was made in. Snapped, not animated: a drag-resize fires this per
  // frame and a transition per frame would never land.
  function handleResize() {
    const next = measure(container);
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    layout();
    setZoom(dom.svg, zoomBehavior, layerTransform(), 0);
  }

  layout();
  let resizeFrame = 0;
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(handleResize);
  });
  resizeObserver.observe(container);

  return {
    update(next) {
      const nextFocused = next.focusedCity ?? null;
      const nextSide = next.citySide ?? null;
      const nextDeepZoom = next.deepZoom ?? false;
      if (nextFocused === focusedCity && nextSide === citySide && nextDeepZoom === deepZoom) {
        return;
      }
      const focusChanged = nextFocused !== focusedCity;
      focusedCity = nextFocused;
      citySide = nextSide;
      deepZoom = nextDeepZoom;
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
    // scales with the zoom. Measuring the fit here also lets a still-focused
    // city snap to frame once its geometry finishes loading.
    setDistricts(slug, districts) {
      setCityLayer(slug, 'districts', districts);
      const focused = markers.find((m) => m.project.citySlug === slug)?.project ?? null;
      if (focused && slug === focusedCity) {
        animateZoom(dom.svg, zoomBehavior, cityTransform(focused));
      }
    },
    // Draw (or clear, when passed null) the focused city's own highlight shape.
    // Cities without outline geometry simply show no highlight — the country is
    // never substituted in (see applyCountryFocus).
    setCityHighlight(slug, outline) {
      setCityLayer(slug, 'outline', outline);
    },
    // Draw (or clear, when passed null) the city's infrastructure lines (cycle
    // routes). The whole collection renders as one path — one animated element
    // regardless of route count — with the "flow" a CSS dash animation. Static
    // geometry; only the dash offset moves (see the stylesheet).
    setInfrastructure(slug, data) {
      setCityLayer(slug, 'infrastructure', data);
    },
    destroy() {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      tooltip.destroy();
      dom.root.remove();
    },
  };
}

// Fallbacks only for a stage that has not been laid out yet (both are 0 before
// the first layout pass); once it has, the map takes its real size, so the
// viewBox matches the box it is drawn into and nothing letterboxes.
function measure(container) {
  return {
    width: container.clientWidth || 960,
    height: container.clientHeight || 480,
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

  // Gradient the cycle-route lines are stroked with (colours in the stylesheet).
  // It repeats across the network and slowly translates by one period, so the
  // brighter band runs through the lines — unless the user prefers reduced motion.
  const cycleGradient = svg
    .append('defs')
    .append('linearGradient')
    .attr('id', 'europe-map-cycle')
    .attr('spreadMethod', 'repeat')
    .attr('x1', '0')
    .attr('y1', '0')
    .attr('x2', '0.35')
    .attr('y2', '0');
  cycleGradient.append('stop').attr('offset', '0').attr('class', 'europe-map__cycle-stop--from');
  cycleGradient.append('stop').attr('offset', '0.5').attr('class', 'europe-map__cycle-stop--to');
  cycleGradient.append('stop').attr('offset', '1').attr('class', 'europe-map__cycle-stop--from');
  if (!prefersReducedMotion()) {
    cycleGradient
      .append('animateTransform')
      .attr('attributeName', 'gradientTransform')
      .attr('type', 'translate')
      .attr('from', '0 0')
      .attr('to', '0.35 0')
      .attr('dur', '6s')
      .attr('repeatCount', 'indefinite');
  }

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
  // City infrastructure (cycle routes) — over the districts, animated in CSS.
  const infrastructure = zoomLayer.append('g').attr('class', 'europe-map__infrastructure');
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
    infrastructure: infrastructure.node(),
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

function drawMarkers(group, projects, handlers) {
  return projects.map((project) => {
    const marker = createMarker(project);
    group.append(marker.node);
    wireMarker(marker, project, handlers);
    return marker;
  });
}

/** Put every marker where the current projection says its city is. Re-run after
 * a re-fit, so the dots move with the geometry instead of staying where the
 * projection used to put them. */
function placeMarkers(markers, projection) {
  for (const marker of markers) {
    const [x, y] = projection([marker.project.lon, marker.project.lat]);
    marker.x = x;
    marker.y = y;
    marker.node.setAttribute('transform', `translate(${x}, ${y})`);
  }
}

function createMarker(project) {
  const node = svgEl('g');
  node.setAttribute('class', 'marker');
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
  return { node, scale, project, x: 0, y: 0 };
}

function wireMarker(marker, project, { onSelect, tooltip, pointOf, onHover, onHoverEnd }) {
  // Report whether the focus ring was already showing when the marker was
  // activated: only a keyboard user should get focus handed back on the way out.
  const select_ = () => onSelect(project.citySlug, marker.node.matches(':focus-visible'));
  // Hovering (or keyboard-focusing) a marker shows its tooltip and highlights
  // the country the city sits in; leaving reverts both. The tooltip is a plain
  // DOM element over the map, so it needs the marker's *zoomed* position — its
  // own coordinates are the unzoomed ones the geometry is drawn in.
  const enter = () => {
    tooltip.show(tooltipHtml(project), ...pointOf(marker));
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

/** Wheel and drag stay live at every layer, focused city or not: the fit frames
 * a city, it does not decide how close the user is allowed to look. Esc, Back
 * and Reset remain the way out; translateExtent (set in layout) keeps a pan
 * inside the map. `onTransform` mirrors the live transform back to the caller. */
function setupZoom(dom, markers, onTransform) {
  let isDeepZoom = false;
  const behavior = zoom()
    .scaleExtent([MIN_ZOOM, MAX_ZOOM])
    .on('zoom', (event) => {
      onTransform(event.transform);
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
 * between the two widget columns. Exported for the fit test: the numbers here
 * decide whether a city fills its stage or shows up as a speck.
 * @param {import('d3').GeoPath} path
 * @param {{ width: number, height: number }} size
 * @param {import('geojson').FeatureCollection} districts
 */
export function cityFitInfo(path, size, districts) {
  const [[x0, y0], [x1, y1]] = path.bounds(districts);
  const width = x1 - x0;
  const height = y1 - y0;
  // A widget column sits on each side, so reserve both — but never so much of a
  // narrow stage that nothing is left to fit the city into (WIDGET_STRIP).
  const strip = Math.min(WIDGET_STRIP, size.width * WIDGET_STRIP_MAX_FRACTION);
  const usableWidth = size.width - 2 * strip;
  const scale = Math.min(usableWidth / width, size.height / height) * CITY_FILL;
  // halfWidth is in projection units, so it scales with whatever zoom is applied
  // to it — it is what cityL2Transform needs to know where the city's edge will
  // land once it is placed.
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    halfWidth: width / 2,
    scale: Math.min(scale, MAX_ZOOM),
  };
}

/** Transform centring the fitted city between the two widget columns. */
function cityFitTransform(size, info) {
  return zoomIdentity
    .translate(size.width / 2, size.height / 2)
    .scale(info.scale)
    .translate(-info.cx, -info.cy);
}

/** L2 cutout: the city pushed into its own half and zoomed a touch deeper, so
 * the other half is free for the widget's modules. Impact's L2 (`deepZoom`)
 * zooms further still, so only a corner of the city stays visible.
 *
 * The city is placed by where it has to *end* rather than by a fraction of the
 * stage width, because its size does not track the stage's: the fit is
 * height-driven on anything wide (see cityFitInfo), so a fixed anchor fraction
 * left a 41px gap to the modules at 1440 and 173px of dead canvas at 2560. Its
 * inner edge now lands on the same split the modules are sized from, whatever
 * shape the stage is. */
function cityL2Transform(size, info, side, deepZoom) {
  const zoomMultiplier = deepZoom ? IMPACT_L2_ZOOM : CITY_L2_ZOOM;
  const scale = Math.min(info.scale * zoomMultiplier, MAX_ZOOM);
  const edge = l2SplitEdge(size.width);
  // Half the city's own width once scaled — the distance from its centre to the
  // edge that faces the modules.
  const reach = info.halfWidth * scale;
  const anchorX = side === 'left' ? edge - reach : size.width - edge + reach;
  return zoomIdentity
    .translate(anchorX, size.height / 2)
    .scale(scale)
    .translate(-info.cx, -info.cy);
}

/** Where the map's half ends: the stage less the modules' share, their margin
 * and the clear canvas between the two. All three live in tokens.css, which is
 * also where the modules read their own width from, so the two halves of the
 * split cannot drift apart. */
function l2SplitEdge(stageWidth) {
  const styles = getComputedStyle(document.documentElement);
  const share = Number.parseFloat(styles.getPropertyValue('--l2-region-share')) || 0.55;
  const margin = Number.parseFloat(styles.getPropertyValue('--l2-region-margin')) || 16;
  const gap = Number.parseFloat(styles.getPropertyValue('--l2-region-gap')) || 40;
  return stageWidth * (1 - share) - margin - gap;
}

/** Move the view to `transform`, over `duration` ms or at once when it is 0
 * (which is also what prefers-reduced-motion resolves --motion-slow to). */
function setZoom(svg, behavior, transform, duration) {
  const selection = select(svg);
  const target = duration > 0 ? selection.transition().duration(duration) : selection;
  target.call(behavior.transform, transform);
}

function animateZoom(svg, behavior, transform) {
  setZoom(svg, behavior, transform, motionMs('--motion-slow'));
}

/** Replace a layer's contents with one path for the whole geometry, or clear it
 * when there is none. */
function drawSinglePath(node, geometry, className, path) {
  const layer = select(node);
  layer.selectAll('*').remove();
  if (!geometry) return;
  layer.append('path').attr('class', className).attr('d', path(geometry));
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
