// The project's own story as a chart: a serpentine track that runs across, turns
// and runs back, with one dot per event on it.
//
// Drawn the way the other charts here are — one SVG in a fixed viewBox scaled to
// the card's width (lineChart.js works the same way), marks in the accent colour
// with a ring the colour of the canvas behind them, rules at the grid's weight,
// labels at 12 viewBox units in the muted text colour. It began as HTML dots on
// a CSS grid, which worked but read as a different kind of object from the
// charts beside it.
//
// Two readings, as the card has. In a column the track carries dots and nothing
// else — the shape of the whole thing at a glance — and hovering a dot names the
// event. Opened, the names are written under the dots and hovering brings the
// account instead. At each size, what is written is what there is room to read,
// and the hover holds the next layer down.
//
// The hover box is the floating one every other card uses (hintLayer.js), not
// the charts' own `.tooltip`: that one is positioned inside its container, and
// this card sits in a region that scrolls — which is the clipping the floating
// box exists to avoid. Each event carries its text in a `<desc class="link-hint">`,
// which the hint layer reads and a screen reader takes as the description.
//
// render(container, { events, phases, expanded }) → { update, destroy }. The
// component never reads the store; the events arrive shaped
// (selectors.js#timelineModule) and it only places them.

import { path as d3path } from 'd3';
import { t } from '../lib/i18n.js';
import { motionMs } from '../lib/a11y.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// The chart's own coordinates. Width matches lineChart so a label at 12 units
// comes out the same size on the same card; the height follows the rows.
const W = 640;
const MARGIN = { top: 24, bottom: 14 };

// A row is two lanes: the track along the top, and the text under it. Keeping
// them apart is half of why nothing overlaps — the turn drops through the outer
// margin, past the text lane, and never through it. `mark` is how far the track
// sits below the row's top; `date` and `title` are measured from the mark.
const LAYOUT = {
  compact: { perRow: 4, row: 44, mark: 22 },
  expanded: { perRow: 4, row: 108, mark: 30, date: 20, title: 38, line: 15 },
};

const MARK = 6;

// A label's width, estimated from its length: SVG text cannot be measured before
// it is drawn, and every distance below is derived from this one number.
const CHAR = 6.1;

// How much of the space between two columns a label may take, and the clearance
// the turn keeps outside the widest one.
const LABEL_SHARE = 0.9;
const TURN_CLEARANCE = 10;

// How far a cubic actually reaches when both its control points are pushed out
// by the same amount: about three quarters of it, never the whole. Solving the
// turn against the control point rather than against the curve was what left the
// bow still clipping the outer titles — it cleared them only at its deepest.
const BOW_REACH = 0.75;

/**
 * @param {HTMLElement} container
 * @param {{ events: object[], phases: object[], expanded?: boolean }} props
 * @returns {{ update(props: object): void, destroy(): void }}
 */
export function render(container, props) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'timeline');
  svg.setAttribute('role', 'group');
  container.append(svg);

  function draw(next) {
    const expanded = Boolean(next.expanded);
    const lay = expanded ? LAYOUT.expanded : LAYOUT.compact;
    const box = frame(lay.perRow, expanded);
    const places = serpentine(next.events.length, lay.perRow);
    const rows = Math.max(...places.map((place) => place.row)) + 1;
    const height = MARGIN.top + rows * lay.row + MARGIN.bottom;
    const points = places.map((place) => centre(place, box, lay.row, lay.mark));

    svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
    svg.setAttribute('aria-label', t('adoption.timeline'));
    svg.replaceChildren(
      ...rules(rows, lay, box),
      ...bands(next, places, points, lay, box),
      ...track(next, places, points, lay, box),
      ...marks(next, points, lay, box, expanded),
    );
    for (const line of svg.querySelectorAll('.timeline__line')) drawOn(line);
  }

  draw(props);

  return {
    update: draw,
    destroy() {
      svg.remove();
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

/** The frame every other distance comes out of.
 *
 * The turn happens beside the outer column, which is exactly where that
 * column's own titles are — so the lane it turns in has to be wider than half a
 * label, or it cuts through the text. Rather than pick a margin and hope, this
 * solves for one: a label may take LABEL_SHARE of the gap between columns (so
 * two neighbours can never touch), the bow must clear half of that, and the
 * margin must hold the bow. Substituting the three gives the margin directly,
 * and the wrap limit falls out of the column width that is left.
 *
 * The compact reading writes no labels at all, so its lane only has to hold the
 * bow.
 */
function frame(perRow, expanded) {
  const gaps = Math.max(perRow - 1, 1);
  if (!expanded) {
    const margin = 56;
    const step = (W - 2 * margin) / gaps;
    return { margin, step, bow: Math.min(step * 0.42, margin - 8), wrapAt: 0 };
  }
  // Solved, not chosen. A label may take LABEL_SHARE of the gap between columns,
  // so two neighbours can never touch; the curve has to reach past half of that
  // plus a clearance, which costs bow/BOW_REACH of lane; and the margin has to
  // hold the bow. Substituting the three gives the margin in one step, and the
  // wrap limit falls out of the column width that is left.
  const half = LABEL_SHARE / 2;
  const margin =
    ((half * W) / gaps + TURN_CLEARANCE + BOW_REACH * 6) / (BOW_REACH + (2 * half) / gaps);
  const step = (W - 2 * margin) / gaps;
  return {
    margin,
    step,
    bow: (half * step + TURN_CLEARANCE) / BOW_REACH,
    wrapAt: Math.max(Math.floor((LABEL_SHARE * step) / CHAR), 8),
  };
}

/** A place's point in chart coordinates: its column across, and the track lane
 * of its row down. */
function centre(place, box, row, mark) {
  return [box.margin + place.column * box.step, MARGIN.top + place.row * row + mark];
}

/** One rule per row, at the grid's weight: the line each row of events stands
 * on, and what makes the rows read as axes rather than as free space. */
function rules(rows, lay, box) {
  return Array.from({ length: rows }, (_, index) =>
    el('line', {
      class: 'timeline__rule',
      x1: box.margin / 2,
      x2: W - box.margin / 2,
      y1: MARGIN.top + index * lay.row + lay.mark,
      y2: MARGIN.top + index * lay.row + lay.mark,
    }),
  );
}

/** The phases, as bands behind the events that belong to them, each in its own
 * colour — and its name above its first band with a swatch of that colour
 * beside it. The name itself stays muted: it is 12-unit text, and colour is
 * never the only thing telling two things apart here (see any legend).
 *
 * One band per stretch of a phase within a row: a phase runs along the track and
 * the track turns, so a phase that spans a turn is two bands rather than one
 * rectangle bent around a corner. */
function bands(props, places, points, lay, box) {
  const out = [];
  let start = 0;
  props.events.forEach((event, index) => {
    const next = props.events[index + 1];
    const ends = !next || next.phase !== event.phase || places[index + 1].row !== places[index].row;
    if (!ends) return;
    const from = points[start];
    const to = points[index];
    const left = Math.min(from[0], to[0]) - box.margin / 2;
    const width = Math.abs(to[0] - from[0]) + box.margin;
    const top = from[1] - lay.mark + 2;
    out.push(
      el('rect', {
        class: `timeline__band timeline__band--${event.phase}`,
        x: left,
        y: top,
        width,
        height: lay.row - 6,
        rx: 10,
      }),
    );
    // Named only where the phase begins, which is the first band of its run.
    // Centred over the band and kept inside the chart: a phase that starts in
    // the last column has its band against the edge, and a name anchored to it
    // ran off the side.
    if (props.events[start - 1]?.phase !== event.phase) {
      const label = t(`adoption.timeline.phase.${event.phase}`);
      const y = top + 14;
      const x = inside(left + width / 2, label, 12);
      out.push(
        el('circle', {
          class: `timeline__swatch timeline__swatch--${event.phase}`,
          cx: x - (label.length * CHAR) / 2 - 8,
          cy: y - 4,
          r: 3.5,
        }),
      );
      out.push(text(x, y, label, 'timeline__phase'));
    }
    start = index + 1;
  });
  return out;
}

/** Keep a centred label inside the chart. SVG text cannot be measured before it
 * is drawn, so the width is estimated from the character count at the label's
 * size — near enough, because the only thing it decides is how far a name is
 * nudged off a band it would otherwise overhang. */
function inside(x, label, lead = 0) {
  const half = (label.length * CHAR) / 2;
  return Math.min(Math.max(x, half + lead + 4), W - half - 4);
}

/** The track, one path per phase so each stretch carries that phase's colour.
 *
 * Along each row, then a bow out into the next. A serpentine's rows end above
 * one another — the last dot of a row and the first of the next share a column —
 * so the join is a vertical drop, and a corner rounded at the dot would cut the
 * dot off the line it stands on. The turn bows outward instead, through a cubic
 * whose control points are pushed past the column and back, which keeps the line
 * touching both dots. The bow's width comes from the frame, where it was solved
 * to clear the widest label.
 *
 * A segment starts at the previous point rather than its own first one, so the
 * phases meet rather than leaving a gap where the colour changes. */
function track(props, places, points, lay, box) {
  const out = [];
  let phase = null;
  let path = null;
  props.events.forEach((event, index) => {
    if (event.phase !== phase) {
      path = d3path();
      phase = event.phase;
      out.push({ phase, path });
      if (index === 0) path.moveTo(...points[0]);
      else path.moveTo(...points[index - 1]);
    }
    if (index === 0) return;
    const point = points[index];
    const previous = places[index - 1];
    if (previous.row === places[index].row) return path.lineTo(...point);
    const away = (previous.column === lay.perRow - 1 ? 1 : -1) * box.bow;
    const from = points[index - 1];
    return path.bezierCurveTo(from[0] + away, from[1], point[0] + away, point[1], ...point);
  });
  return out.map((segment) =>
    el('path', {
      class: `timeline__line timeline__line--${segment.phase}`,
      d: segment.path.toString(),
    }),
  );
}

/** One mark per event, and — once the card is opened — its date and title under
 * it.
 *
 * A focusable group rather than a bare circle: the charts here leave their dots
 * out of the tab order, which makes their hovers mouse-only, and an event on a
 * timeline is content rather than a point on a line. The `<desc>` is what the
 * hint layer draws and what a screen reader reads as the description. */
function marks(props, points, lay, box, expanded) {
  return props.events.map((event, index) => {
    const [x, y] = points[index];
    const group = el('g', {
      class: `timeline__event timeline__event--${event.phase}${event.planned ? ' timeline__event--planned' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${event.when}: ${event.title}`,
    });
    group.dataset.hint = '';
    const desc = document.createElementNS(SVG_NS, 'desc');
    desc.setAttribute('class', 'link-hint');
    desc.textContent = expanded ? event.details : event.title;
    group.append(
      desc,
      el('circle', { class: 'timeline__mark', cx: x, cy: y, r: MARK }),
      // A hit target the size of the space around the mark, so the pointer does
      // not have to find a six-unit circle.
      el('circle', { class: 'timeline__hit', cx: x, cy: y, r: MARK * 3 }),
    );
    if (expanded) {
      // In the row's text lane, under the track and never across it. Kept inside
      // the chart as well: the outer columns sit on the margin, and a title
      // centred on one would otherwise run off the side.
      group.append(text(inside(x, event.when), y + lay.date, event.when, 'timeline__when'));
      wrap(event.title, box.wrapAt).forEach((line, row) => {
        group.append(
          text(inside(x, line), y + lay.title + row * lay.line, line, 'timeline__label'),
        );
      });
    }
    return group;
  });
}

/** Break a title into lines short enough for a column. SVG text does not wrap,
 * so the breaking happens here.
 *
 * On spaces and after hyphens both: German compounds run past a column on their
 * own — "Verkehrsausschuss-Beschluss" is 27 characters against a 21-character
 * column — and a title that cannot break is a title that overlaps its
 * neighbour. Breaking after a hyphen the word already has costs nothing and
 * needs no hyphenation rules; a word with neither space nor hyphen is left
 * whole, because splitting one mid-syllable would be worse than the overlap. */
function wrap(title, limit) {
  const words = title.split(' ').flatMap((word) => word.split(/(?<=-)/));
  const lines = [''];
  for (const word of words) {
    const line = lines[lines.length - 1];
    const joiner = line.endsWith('-') ? '' : ' ';
    if (line && `${line}${joiner}${word}`.length > limit) lines.push(word);
    else lines[lines.length - 1] = line ? `${line}${joiner}${word}` : word;
  }
  return lines;
}

/** Draw the line on rather than having it appear: the track is the order the
 * events happened in, and watching it drawn says so. Uses the Web Animations
 * API on the dash offset, the same way lineChart draws its lines, and does
 * nothing at all under reduced motion. */
function drawOn(line) {
  const duration = motionMs('--motion-entrance');
  if (!line || duration === 0 || typeof line.getTotalLength !== 'function') return;
  const length = line.getTotalLength();
  if (!length) return;
  line.style.strokeDasharray = String(length);
  line.animate?.([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration,
    easing: 'ease-out',
    fill: 'forwards',
  });
}

function el(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function text(x, y, content, className) {
  const node = el('text', { class: className, x, y });
  node.textContent = content;
  return node;
}
