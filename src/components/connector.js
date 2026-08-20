// The arrows between L2 modules: a curved line from one module's edge into
// another's, drawn once the modules have finished flying into place.
//
// render(container, { links }) — each link is a { source, target } pair of rects
// in the container's own coordinate space. The region owns the modules and
// measures them; this component only draws, which is also what keeps every
// arrow inside the region and away from the map.
//
// Rects are the modules' resting places, not where they happen to be at the
// moment of mounting: the entrance is a transform, so it moves what a module
// looks like without moving where it is (see widgetStack.js#moduleRect). The
// arrow is drawn to where the module is going to be, and by the time it is
// drawn the module is there.
//
// The draw itself is CSS (connector.css). Each path declares pathLength="1", so
// revealing it is a dashoffset 1 → 0 whatever its real length: no measurement in
// JS, no duration read into JS, and prefers-reduced-motion is a token change
// rather than a branch here.
//
// The arrowhead rides the curve rather than waiting at the end of it. An SVG
// marker is painted at a path's geometric end whether or not the dash pattern
// has reached it, so a marker has to be hidden and then faded in once the line
// lands — which reads as two events, a line arriving and a head appearing.
// Given `offset-path`, the head is instead an element travelling the same curve
// over the same duration with the same easing, so it sits exactly at the tip
// the whole way and the arrow is drawn *by* it. Where that is not supported it
// falls back to the marker.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A head small enough not to blunt the curve it ends, drawn around its own
 * origin so `offset-path` can carry it by the point rather than by a corner. */
const HEAD_SHAPE = 'M -5.5 -4 L 3 0 L -5.5 4 z';

/** Chrome, Safari 16 and Firefox 72 travel the head along the path; anything
 * older gets a marker sitting at the end of it instead. */
function canTravel() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('offset-path', 'path("M 0 0 L 1 1")')
  );
}

// Where an arrow meets a module. The tail starts inside the source so it reads
// as coming out from under it; the head stops short of the target so the
// arrowhead is not hidden beneath it (the layer sits behind the modules). Both
// are also the slack that keeps the arrow attached while the modules drift.
const TAIL_INSET = 8;
const HEAD_GAP = 7;

// Two arrows leaving one module would overlap at the tail if both started at its
// middle; this fans them apart across the source's edge.
const TAIL_SPREAD = 12;

// How far along the gap each control point sits. Horizontal tangents at both
// ends: the arrow leaves its source sideways and arrives at its target sideways,
// so the curve is a smooth S rather than a diagonal with bent ends.
const CONTROL_ALONG = 0.5;

/** Sub-pixel precision buys nothing in a 1.5px line and makes the `d` attribute
 * (and any test asserting on it) unreadable. */
const round = (value) => Math.round(value * 10) / 10;

/**
 * @param {HTMLElement} container  A positioned element (see .widget-detail__connectors).
 * @param {{ links: { source: {x: number, y: number, width: number, height: number}, target: {x: number, y: number, width: number, height: number} }[] }} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'connector');
  // Decorative: the relationship an arrow draws is one the modules it joins
  // state themselves, so it has nothing of its own to announce.
  svg.setAttribute('aria-hidden', 'true');
  container.append(svg);

  function draw({ links }) {
    const travelling = canTravel();
    const marker = travelling ? [] : [arrowheadMarker()];
    svg.replaceChildren(
      ...marker,
      ...links.flatMap((link, i) => arrow(link, i, links, travelling)),
    );
  }

  draw(props);

  return {
    update(next) {
      draw(next);
    },
    destroy() {
      svg.remove();
    },
  };
}

/** One arrow: the line, and the head that draws it. */
function arrow(link, index, links, travelling) {
  const d = arrowPath(link.source, link.target, index, links.length);
  const line = path(d, 'connector__line', index);
  if (!travelling) {
    line.setAttribute('marker-end', 'url(#connector-arrowhead)');
    return [line];
  }
  return [line, travellingHead(d, index)];
}

/** The head, carried along the same curve the line is being revealed along.
 * Both run for --arrow-draw-duration under the same easing, and both measure
 * their progress as a fraction of the path's length, so the head stays on the
 * tip for the whole draw instead of merely arriving at the same time. */
function travellingHead(d, index) {
  const head = document.createElementNS(SVG_NS, 'path');
  head.setAttribute('class', 'connector__head connector__head--travelling');
  head.setAttribute('d', HEAD_SHAPE);
  head.style.setProperty('offset-path', `path("${d}")`);
  head.style.setProperty('--arrow-index', String(index));
  return head;
}

/** One curve. The index is what the stylesheet staggers the draw by, and what
 * puts the two pulses out of step — carried on the element rather than read off
 * its position, which changes as soon as a second path joins it. */
function path(d, className, index) {
  const node = document.createElementNS(SVG_NS, 'path');
  node.setAttribute('class', className);
  node.setAttribute('d', d);
  // Normalised length: the stylesheet reveals and pulses the line in fractions
  // of it, without anyone measuring the real curve.
  node.setAttribute('pathLength', '1');
  node.style.setProperty('--arrow-index', String(index));
  return node;
}

/** The arrowhead, defined once per layer and pointed along the path it ends. */
function arrowheadMarker() {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', 'connector-arrowhead');
  marker.setAttribute('viewBox', '0 0 8 8');
  marker.setAttribute('refX', '7');
  marker.setAttribute('refY', '4');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const head = document.createElementNS(SVG_NS, 'path');
  head.setAttribute('class', 'connector__head');
  head.setAttribute('d', 'M 0 0 L 8 4 L 0 8 z');
  marker.append(head);
  defs.append(marker);
  return defs;
}

/**
 * Where an arrow starts and ends: out of the source's trailing edge, in to the
 * target's leading one. `index` fans the tails apart so two arrows leaving the
 * same module do not sit on top of each other.
 * @returns {{ start: {x: number, y: number}, end: {x: number, y: number} }}
 */
export function endpoints(source, target, index = 0, count = 1) {
  const offset = (index - (count - 1) / 2) * TAIL_SPREAD;
  return {
    start: {
      x: source.x + source.width - TAIL_INSET,
      y: source.y + source.height / 2 + offset,
    },
    end: { x: target.x - HEAD_GAP, y: target.y + target.height / 2 },
  };
}

/**
 * A single smooth cubic from one module to another.
 * @returns {string} an SVG path `d`
 */
export function arrowPath(source, target, index = 0, count = 1) {
  const { start, end } = endpoints(source, target, index, count);
  const reach = (end.x - start.x) * CONTROL_ALONG;
  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `C ${round(start.x + reach)} ${round(start.y)}`,
    `${round(end.x - reach)} ${round(end.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(' ');
}
