// The project's milestones as a chart: one vertical line running down the card,
// a mark on it for every year something happened, and the year written beside
// each mark.
//
// Drawn in the same language as timelineChart.js — accent marks with a ring the
// colour of the canvas behind them, muted labels, the line drawn on at entrance
// — and on a d3 scale, as every chart here is, but none of its geometry. That one snakes across and back and has
// to solve for rows, bows and turns; this is a straight line, and the only thing
// it has to solve is how far apart the years sit.
//
// **The line is a scale, not a list.** A mark's distance down the line is its
// distance in years, so the three years between the 2016 council decision and
// the first delivery are drawn three times the gap between 2023 and 2024. That
// is the whole reason to draw a line rather than write a list, and it is also
// what makes the spacing non-obvious: the text beside a mark needs a certain
// amount of room, and proportional spacing does not care what the text needs.
// `stepFor` below resolves that — it finds the tightest pair and scales the
// whole line until that pair fits, so the proportions hold exactly and nothing
// overlaps at any card width.
//
// Two readings, as the card has. In a column the line carries its years and the
// marks, and hovering one names what happened that year. Opened, the events are
// written out beside their marks and there is nothing left to hover for.
//
// One viewBox unit is one pixel: the chart measures the container and draws at
// its width, rather than drawing at a fixed width and letting CSS scale it. The
// serpentine can do the latter because it writes nothing in a column; this one
// writes years at both sizes, and a fixed 640-wide viewBox in a 360px card would
// scale 12-unit type down to seven.
//
// render(container, { years, expanded }) → { update, destroy }. The component
// never reads the store; the years arrive grouped (selectors.js#milestonesModule)
// and it only places them.

import { scaleLinear } from 'd3';
import { motionMs } from '../lib/a11y.js';
import { t } from '../lib/i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// The chart's columns, in pixels from the left edge: the year is right-aligned
// against the line, the line stands clear of it, and the events take whatever is
// left. A card narrower than this has bigger problems than the milestone line.
const COLUMN = { year: 34, line: 46, event: 58, right: 4 };
const FALLBACK_WIDTH = 320;

// The label type, and a character's width and a line's height as fractions of
// it. The sizes live here rather than in the stylesheet because the line
// breaking depends on them: a stylesheet setting a size this file did not know
// about is a wrap computed for the wrong column, which is how text ends up off
// the card. The opened card raises its small print by about a quarter and the
// chart follows, or the milestones read smaller than everything around them.
// 0.508 is this font's measured character width as a fraction of its size — the
// 6.1-at-12 timelineChart.js uses, stated as a ratio so it survives the change.
const FONT = { closed: 12, open: 14 };
const CHAR_RATIO = 0.508;
const LINE_RATIO = 1.25;

// How much room a year's block needs below its mark, and how close two marks may
// come when there is no text between them. The closed card has only the years,
// so its floor is what keeps two 12-unit labels off each other.
const GAP = { event: 6, closed: 20 };
const PAD = { top: 12, bottom: 10 };
const MARK = 5;

// How far a year's tick reaches either side of the line. Wider than the line is
// thick, or it would be swallowed by it — the line is what the ticks are drawn
// across, and only the ends of them show.
const TICK = 7;

/**
 * @param {HTMLElement} container
 * @param {{ years: { year: number, events: string[] }[], expanded?: boolean }} props
 * @returns {{ update(next: object): void, destroy(): void }}
 */
export function render(container, props) {
  let current = props;
  let drawnAt = 0;

  function draw() {
    const width = container.clientWidth || FALLBACK_WIDTH;
    container.replaceChildren();
    drawnAt = width;
    if (!current.years || current.years.length === 0) return;
    const svg = chart(current, width);
    container.append(svg);
    drawOn(svg.querySelector('.milestones__line'));
  }

  draw();

  // Redraw when the card's width actually changes, because the width at mount is
  // not the width the chart ends up at: a card opening into the focus slot is
  // mounted first and flown to its new size after, so measuring at mount gives
  // the width it is coming *from*. Left uncorrected the opened card drew a
  // 374-unit chart into a 714px slot — everything scaled 1.9×, type included.
  // Only the width is watched; a redraw changes the height, so answering that
  // too would be a loop.
  const observer =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (container.clientWidth && container.clientWidth !== drawnAt) draw();
        })
      : null;
  observer?.observe(container);

  return {
    update(next) {
      current = { ...current, ...next };
      draw();
    },
    destroy() {
      observer?.disconnect();
      container.replaceChildren();
    },
  };
}

/** The whole chart, laid out and drawn. */
function chart(props, width) {
  const expanded = Boolean(props.expanded);
  // Closed there is no text column, so the line and its years would sit in the
  // left sixth of the card with five sixths of empty beside them. Centred, the
  // same marks read as the object the card is about rather than something backed
  // into a corner. Opened, the text takes the width and the line belongs at the
  // left edge of the reading.
  const shift = expanded ? 0 : Math.max(0, (width - COLUMN.event) / 2);
  const column = { year: COLUMN.year + shift, line: COLUMN.line + shift, event: COLUMN.event };
  const font = expanded ? FONT.open : FONT.closed;
  const step = font * LINE_RATIO;
  const wrapAt = Math.max(
    1,
    Math.floor((width - COLUMN.event - COLUMN.right) / (font * CHAR_RATIO)),
  );
  const blocks = props.years.map((entry) => {
    // entry.events holds i18n keys (selectors.js#milestonesModule); resolve them
    // here so a locale switch that redraws the chart picks up the new language.
    const events = entry.events.map((key) => t(key));
    return {
      ...entry,
      events,
      lines: expanded ? events.map((event) => wrap(event, wrapAt)) : [],
    };
  });
  const needs = blocks.map((block) =>
    expanded ? block.lines.flat().length * step + block.lines.length * GAP.event : GAP.closed,
  );
  const perYear = stepFor(
    blocks.map((block) => block.year),
    needs,
  );
  // Years to pixels, as every other chart here does it. `perYear` decides how
  // tall the line has to be; the scale is what maps a year onto it, and a hand-
  // written (year - first) * perYear is that mapping with the library taken out.
  // A single milestone gives the scale an empty domain, which d3 answers with
  // the middle of the range — here a zero-length range, so the one mark lands on
  // PAD.top and nothing has to special-case it.
  const first = blocks[0].year;
  const last = blocks[blocks.length - 1].year;
  const at = scaleLinear()
    .domain([first, last])
    .range([PAD.top, PAD.top + (last - first) * perYear]);
  const height = at(last) + needs[needs.length - 1] + PAD.bottom;

  const svg = el('svg', {
    class: 'milestones',
    viewBox: `0 0 ${width} ${round(height)}`,
    'font-size': font,
    role: 'img',
    preserveAspectRatio: 'xMinYMin meet',
  });
  // Every year on the scale gets a tick, and the ones something happened in get a
  // mark instead. This is what makes the spacing legible: without them the four
  // years between the council decision and the first delivery are a gap you have
  // to measure by reading two labels and subtracting, which is most of the
  // reason for drawing the line to scale in the first place.
  const marked = new Set(blocks.map((block) => block.year));
  for (let year = first; year <= last; year += 1) {
    if (!marked.has(year)) svg.append(tick(column, at(year)));
  }
  svg.append(line(column, at(first), at(last)));
  for (const block of blocks) {
    svg.append(markGroup(column, block, at(block.year), expanded, step));
  }
  return svg;
}

/**
 * How many pixels one year of the line is worth.
 *
 * Every year's block has to fit in the space before the next year's mark, and
 * that space is its year gap times this number. So the answer is the largest
 * ratio of "room this block needs" to "years until the next one" — scale to
 * that and the tightest pair fits exactly, every other pair fits with room to
 * spare, and the proportions between them are untouched. The last block has
 * nothing after it to collide with and so does not constrain the scale.
 */
function stepFor(years, needs) {
  let step = 0;
  for (let index = 0; index < years.length - 1; index += 1) {
    step = Math.max(step, needs[index] / (years[index + 1] - years[index]));
  }
  return step;
}

/** A year with no milestone in it: a short stroke across the line, at the grid's
 * weight, so the empty stretches can be counted rather than estimated. */
function tick(column, y) {
  return el('line', {
    class: 'milestones__tick',
    x1: round(column.line - TICK),
    x2: round(column.line + TICK),
    y1: round(y),
    y2: round(y),
  });
}

/** The line itself, from the first mark to the last. It stops at the marks
 * rather than running to the edges: the project did not start before its first
 * milestone, and drawing past the last one would imply an end nobody has set. */
function line(column, top, bottom) {
  return el('path', {
    class: 'milestones__line',
    d: `M ${round(column.line)} ${round(top)} L ${round(column.line)} ${round(bottom)}`,
  });
}

/** One year: its mark, its label, and — opened — what happened that year.
 *
 * Closed, the group is the thing you point at and the events arrive in the
 * floating hint box (hintLayer.js), which is what every other hover on these
 * cards uses. Opened, the events are already written beside the mark, so the
 * group stops being focusable and stops carrying a hint — a control that opens a
 * box repeating the paragraph next to it is a control with nothing to do, and a
 * screen reader would read the year twice to get there.
 */
function markGroup(column, block, y, expanded, step) {
  const group = el('g', { class: 'milestones__year' });
  group.append(
    el('circle', { class: 'milestones__mark', cx: round(column.line), cy: round(y), r: MARK }),
    text(round(column.year), round(y), String(block.year), 'milestones__when'),
  );
  if (!expanded) {
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${block.year}: ${block.events.join(' · ')}`);
    group.dataset.hint = '';
    const desc = el('desc', { class: 'link-hint' });
    desc.textContent = block.events.join(' · ');
    group.append(
      desc,
      // A hit target the size of the space around the mark, so the pointer does
      // not have to find a five-unit circle.
      el('circle', { class: 'milestones__hit', cx: round(column.line), cy: round(y), r: MARK * 3 }),
    );
    return group;
  }
  let row = 0;
  for (const lines of block.lines) {
    for (const written of lines) {
      group.append(text(column.event, round(y + row * step), written, 'milestones__label'));
      row += 1;
    }
    row += GAP.event / step;
  }
  return group;
}

/** Break an event into lines that fit the text column. SVG text does not wrap,
 * so the breaking happens here — on spaces and after hyphens both, because a
 * German compound runs past a column on its own and a word that cannot break is
 * a word that runs off the card. */
function wrap(event, wrapAt) {
  const words = String(event)
    .split(/\s+/)
    .flatMap((word) => word.split(/(?<=-)/))
    .filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const joiner = current === '' || current.endsWith('-') ? '' : ' ';
    const next = `${current}${joiner}${word}`;
    if (next.length > wrapAt && current !== '') {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current !== '') lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/** Draw the line on rather than having it appear, at the entrance duration the
 * rest of the app uses — and not at all when the reader has asked for no
 * motion, which is what motionMs returns zero for. */
function drawOn(node) {
  const duration = motionMs('--motion-entrance');
  if (!node || duration === 0 || typeof node.getTotalLength !== 'function') return;
  const length = node.getTotalLength();
  if (!length) return;
  node.style.strokeDasharray = String(length);
  node.animate?.([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
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

/** Coordinates to a tenth of a unit. Full precision writes eleven decimal places
 * into the DOM and reads no better. */
function round(value) {
  return Math.round(value * 10) / 10;
}
