// The project's own story as a serpentine: a track that runs across, turns, runs
// back, and so on, with one dot per event along it.
//
// Two readings, as the card has. In a column the track carries dots and nothing
// else — the shape of the whole thing at a glance — and hovering a dot names the
// event. Opened, the names are written beside the dots and hovering brings the
// account instead. Progressive disclosure: at each size, what is written is what
// there is room to read, and the hover holds the next layer down.
//
// The track is an SVG path behind; the dots are HTML over it, on a grid. That is
// what lets a dot carry the same `data-hint` every other hoverable thing on
// these cards carries and be drawn in the same floating box (hintLayer.js) — an
// SVG circle could not hold the markup the hint layer reads.
//
// The path is built in *pixels* rather than in grid cells, and redrawn when the
// card's width changes. A path drawn in cells and stretched by a viewBox is the
// obvious way to avoid measuring, and it is what this did first: the corners
// came out as ellipses, because a cell is nothing like square and the stretch
// applies to the curve as much as to the line.
//
// render(container, { events, phases, expanded }) → { update, destroy }. The
// component never reads the store; the events arrive shaped
// (selectors.js#timelineModule) and it only places them.

import { path as d3path } from 'd3';
import { motionMs } from '../lib/a11y.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// How many dots a row holds before the track turns. Two readings, two counts: a
// column has room for four across, the opened card three per row with the names
// written beside them.
const PER_ROW = { compact: 4, expanded: 3 };

// How far the track bows as it turns, as a share of the gap between two dots in
// a row — so it holds at any card width, and stays inside the space the dots are
// already inset by.
const CORNER = 0.42;

/**
 * @param {HTMLElement} container
 * @param {{ events: object[], phases: object[], expanded?: boolean }} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const node = document.createElement('div');
  node.className = 'timeline';
  container.append(node);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'timeline__track');
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('class', 'timeline__line');
  svg.append(line);

  let places = [];
  let columns = PER_ROW.compact;
  let rows = 1;
  let frame = 0;

  /** Lay the dots out and redraw the track under them. */
  function draw(next) {
    const expanded = Boolean(next.expanded);
    columns = expanded ? PER_ROW.expanded : PER_ROW.compact;
    places = serpentine(next.events.length, columns);
    rows = Math.max(...places.map((place) => place.row)) + 1;
    node.className = `timeline${expanded ? ' timeline--expanded' : ''}`;
    node.style.setProperty('--timeline-columns', String(columns));
    node.style.setProperty('--timeline-rows', String(rows));
    node.replaceChildren(svg, ...dots(next, places, expanded));
    // Painted on the next frame, not here. The track is drawn through the marks
    // as they actually sit (markCentres), and the dots that were just written
    // have not been laid out yet — measuring now gives the places the *previous*
    // reading left behind, which is a track for a card of another shape.
    frame = requestAnimationFrame(() => paint(true));
  }

  /** Redraw the track at the size the card currently is. Nothing to draw before
   * the card has been laid out (jsdom, or a card still hidden), and no reason to
   * animate a redraw that is only following a resize. */
  function paint(animate = true) {
    const width = node.clientWidth;
    const height = node.clientHeight;
    if (width === 0 || height === 0) return;
    const points = markCentres(node);
    if (points.length !== places.length) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    line.setAttribute('d', trackPath(places, points, columns));
    if (animate) drawOn(line);
  }

  const observer = new ResizeObserver(() => paint(false));
  observer.observe(node);

  draw(props);

  return {
    update: draw,
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.remove();
    },
  };
}

/** Where each event sits: which row, and how far along it. Odd rows run the
 * other way, which is what makes the track a serpentine rather than a stack of
 * separate lines — the last dot of one row is directly above the first of the
 * next, so the turn is a short drop rather than a long return. */
function serpentine(count, perRow) {
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / perRow);
    const along = index % perRow;
    return { row, column: row % 2 === 0 ? along : perRow - 1 - along };
  });
}

/** Where each dot's mark actually is, in the container's own coordinates.
 *
 * Measured rather than worked out from the grid. A dot is its mark and, once the
 * card is opened, the name under it — so the mark sits above the middle of its
 * cell by however tall that name turned out to be. A track drawn through cell
 * centres ran straight across the row above's labels; a track drawn through the
 * marks touches every dot at any size, whatever the names do.
 *
 * Offsets, not bounding boxes. The card flies in from its widget and drifts
 * afterwards, and a transform moves what an element looks like without moving
 * where it is: measured with getBoundingClientRect mid-flight, every distance
 * came back multiplied by the flight's scale and the track was drawn for a card
 * a fraction of the size. (widgetStack.js#moduleRect makes the same choice, for
 * the same reason.) */
function markCentres(node) {
  return [...node.querySelectorAll('.timeline__dot')].map((dot) => {
    const mark = dot.querySelector('.timeline__mark');
    return [
      dot.offsetLeft + mark.offsetLeft + mark.offsetWidth / 2,
      dot.offsetTop + mark.offsetTop + mark.offsetHeight / 2,
    ];
  });
}

/** The track: along each row, then a bow out into the next.
 *
 * A serpentine's rows end above one another — the last dot of a row and the
 * first of the next share a column — so the join is a vertical drop, and a
 * corner rounded at the dot would cut the dot off the line it stands on. The
 * turn bows outward instead, through a cubic whose control points are pushed
 * past the column and back, which keeps the line touching both dots and gives
 * the bend its shape.
 *
 * The bow is a share of the gap between two dots in a row, so it stays inside
 * the space the dots are already inset by — the first thing this got wrong was
 * an elbow put exactly on the card's edge, with the line running off it.
 */
function trackPath(places, points, columns) {
  const across = Math.abs((points[1]?.[0] ?? 0) - (points[0]?.[0] ?? 0));
  const bow = across * CORNER;
  const track = d3path();
  places.forEach((place, index) => {
    const point = points[index];
    if (index === 0) return track.moveTo(...point);
    const previous = places[index - 1];
    if (previous.row === place.row) return track.lineTo(...point);
    const out = turnOut(previous, columns) * bow;
    const from = points[index - 1];
    return track.bezierCurveTo(from[0] + out, from[1], point[0] + out, point[1], ...point);
  });
  return track.toString();
}

/** Which way the track bows as it turns: away from the arrangement, on whichever
 * side the row ended, so the bend happens clear of the dots rather than across
 * the row it is leaving. */
function turnOut(place, columns) {
  return place.column === columns - 1 ? 1 : -1;
}

/** Draw the line on rather than having it appear: the track is the order the
 * events happened in, and watching it drawn says so. Uses the Web Animations
 * API on the dash offset, the same way lineChart draws its lines, and does
 * nothing at all under reduced motion. */
function drawOn(line) {
  const duration = motionMs('--motion-entrance');
  if (duration === 0 || typeof line.getTotalLength !== 'function') return;
  const length = line.getTotalLength();
  if (!length) return;
  line.style.strokeDasharray = String(length);
  line.animate?.([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration,
    easing: 'ease-out',
    fill: 'forwards',
  });
}

/** One dot per event, placed on the grid the track was drawn across.
 *
 * A button rather than a div: it is the thing a keyboard reaches, and what it
 * carries — the title in a column, the account once the card is opened — is the
 * `.link-hint` inside it, drawn in the floating box on hover and on focus. */
function dots(props, places, expanded) {
  return props.events.map((event, index) => {
    const place = places[index];
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `timeline__dot${event.planned ? ' timeline__dot--planned' : ''}`;
    dot.dataset.hint = '';
    dot.style.setProperty('--column', String(place.column));
    dot.style.setProperty('--row', String(place.row));
    dot.setAttribute('aria-label', `${event.when}: ${event.title}`);
    dot.innerHTML = `
      <span class="timeline__mark" aria-hidden="true"></span>
      ${expanded ? `<span class="timeline__label"><span class="timeline__when">${event.when}</span>${event.title}</span>` : ''}
      <span class="link-hint">${expanded ? event.details : event.title}</span>`;
    return dot;
  });
}

/** Which phase each stretch of the track belongs to, named where it starts.
 * Exported for the card, which writes them above the track rather than on it —
 * a label among the dots would be one more thing to read at a glance. */
export function phaseLegend(phases) {
  return phases.map((phase) => phase.labelKey);
}
