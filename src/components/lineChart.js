// A small time-series line chart (adoption/impact over years), animated on entry
// and reduced-motion aware. One project's own metric over time — absolute
// values, so no cross-city normalisation is implied. Data down as
// { series, unit, locale }; the component owns only its SVG.
//
// One line, or several sharing one axis: pass `lines` instead of `series` and
// every line is drawn against the same scale, coloured by
// `.line-chart__line--<key>` from the stylesheet. Sharing an axis is a claim
// about the data — the L2 air module's three pollutants are all annual means in
// µg/m³ — so the caller does the checking; this never adds a second y-scale.

import { scaleLinear, line, min, max, extent } from 'd3';
import { formatNumber, formatYear } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { motionMs, prefersReducedMotion } from '../lib/a11y.js';
import { renderTooltip } from './tooltip.js';

const W = 640;
const H = 260;
// A compact chart is drawn in a shallower box, not just a smaller one: in an L2
// module it has a card's width and a fraction of its height, and a 640x260
// viewBox scaled to fit that would leave most of the width empty.
const COMPACT_H = 170;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 52 };
// Compact mode drops the axes/gridlines/unit label entirely (there's no room
// for legible 12px-in-a-640-viewBox text once this scales down into a narrow
// widget slot) and reclaims that space for the line itself — a sparkline, not
// a smaller version of the full chart.
const COMPACT_MARGIN = { top: 6, right: 6, bottom: 6, left: 6 };
const SVG_NS = 'http://www.w3.org/2000/svg';

/** The lines to draw, whichever way the caller named them. A single `series`
 * is one unnamed line — the chart's own title says what it is, so it takes the
 * default stroke and no legend is implied. */
function linesOf(props) {
  return props.lines ?? [{ key: null, points: props.series }];
}

/**
 * @param {HTMLElement} container
 * @param {{ series?: {year: number, value: number}[], lines?: {key: string, points: {year: number, value: number}[]}[], unit: string|null, locale: 'en'|'de', compact?: boolean, unitLabel?: boolean }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const compact = Boolean(props.compact);
  const margin = compact ? COMPACT_MARGIN : MARGIN;
  const lines = linesOf(props);
  const points = lines.flatMap((entry) => entry.points);
  const height = compact ? COMPACT_H : H;
  const svg = el('svg', {
    class: compact ? 'line-chart line-chart--compact' : 'line-chart',
    viewBox: `0 0 ${W} ${height}`,
    role: 'img',
  });
  svg.setAttribute('aria-label', describe(props));
  container.append(svg);

  // The tooltip anchors within the container, so it must be a positioned box.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const tooltip = renderTooltip(container);

  const x = scaleLinear()
    .domain(extent(points, (d) => d.year))
    .range([margin.left, W - margin.right]);
  // One scale for every line — see the note at the top of this file.
  const y = scaleLinear()
    .domain(yDomain(points, compact))
    .nice()
    .range([height - margin.bottom, margin.top]);

  if (!compact) drawAxes(svg, x, y, points, props);
  // One line needs no naming — the chart's own label says what it is; several
  // sharing an axis do, in the tooltip and in what a screen reader is told.
  const named = lines.length > 1;
  for (const entry of lines) {
    drawLine(svg, x, y, entry);
    drawDots(svg, x, y, entry, compact, { container, tooltip, props, named });
  }

  return {
    update() {},
    destroy() {
      tooltip.destroy();
      svg.remove();
    },
  };
}

// The full chart starts at 0 — never exaggerate a trend by cropping the axis
// (Neutrality). A compact sparkline has no axis to mislead with, and its whole
// point is the shape of local variation, which a real quantity like car
// density (370-378) would lose entirely against a 0 baseline; it zooms to the
// data's own range instead, like the reference chart this pattern came from.
function yDomain(points, compact) {
  const lo = min(points, (d) => d.value);
  const hi = max(points, (d) => d.value);
  if (!compact) return [0, hi || 1];
  const span = hi - lo;
  const pad = span > 0 ? span * 0.15 : Math.max(hi * 0.05, 1);
  return [lo - pad, hi + pad];
}

function drawAxes(svg, x, y, points, props) {
  for (const tick of y.ticks(4)) {
    const yy = y(tick);
    svg.append(
      el('line', {
        class: 'line-chart__grid',
        x1: MARGIN.left,
        x2: W - MARGIN.right,
        y1: yy,
        y2: yy,
      }),
    );
    svg.append(
      text(MARGIN.left - 8, yy + 4, formatNumber(tick, props.locale), 'line-chart__y-label'),
    );
  }
  for (const year of new Set(points.map((point) => point.year))) {
    svg.append(text(x(year), H - MARGIN.bottom + 20, formatYear(year), 'line-chart__x-label'));
  }
  // Only where nothing above the chart has said it already. A card that states
  // the unit in words over the chart (detailContent.js#unitHtml) would otherwise
  // say it twice, once spelled out and once as the bare symbol.
  if (props.unit && props.unitLabel !== false) {
    svg.append(text(MARGIN.left, MARGIN.top - 4, props.unit, 'line-chart__unit'));
  }
}

function drawLine(svg, x, y, { key, points }) {
  if (points.length < 2) return;
  const path = el('path', {
    class: key ? `line-chart__line line-chart__line--${key}` : 'line-chart__line',
    d: line()
      .x((d) => x(d.year))
      .y((d) => y(d.value))(points),
  });
  svg.append(path);
  animateDraw(path);
}

function drawDots(svg, x, y, { key, points }, compact, hover) {
  const r = compact ? 3 : 4;
  const dotClass = key ? `line-chart__dot line-chart__dot--${key}` : 'line-chart__dot';
  for (const point of points) {
    const cx = x(point.year);
    const cy = y(point.value);
    const dot = el('circle', { class: dotClass, cx, cy, r });
    svg.append(dot);
    // A larger transparent hit target so the small dot is comfortable to hover;
    // it enlarges the dot and shows the value tooltip.
    const hit = el('circle', { class: 'line-chart__hit', cx, cy, r: 14 });
    wirePoint(hit, dot, point, key, hover);
    svg.append(hit);
  }
}

function wirePoint(hit, dot, point, key, { container, tooltip, props, named }) {
  // With several lines on one axis the year and value alone are ambiguous, so
  // the tooltip names the line too (the same label its legend row carries).
  const name = named ? `<span>${t(`impact.series.${key}`)}</span>` : '';
  const html = `<strong>${formatNumber(point.value, props.locale, props.unit)}</strong>${name}<span>${formatYear(point.year)}</span>`;
  const move = (event) => {
    const rect = container.getBoundingClientRect();
    tooltip.show(html, event.clientX - rect.left, event.clientY - rect.top);
    dot.classList.add('is-active');
  };
  hit.addEventListener('mouseenter', move);
  hit.addEventListener('mousemove', move);
  hit.addEventListener('mouseleave', () => {
    tooltip.hide();
    dot.classList.remove('is-active');
  });
}

function animateDraw(path) {
  const length = path.getTotalLength();
  path.style.strokeDasharray = String(length);
  if (prefersReducedMotion()) {
    path.style.strokeDashoffset = '0';
    return;
  }
  path.style.strokeDashoffset = String(length);
  path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration: motionMs('--motion-slow') || 480,
    easing: 'ease-out',
    fill: 'forwards',
  });
  path.style.strokeDashoffset = '0';
}

/** The chart read aloud: every line, named where there is more than one, with
 * its own year/value pairs. */
function describe(props) {
  const lines = linesOf(props);
  return lines
    .map(({ key, points }) => {
      const values = points.map(
        (d) => `${formatYear(d.year)}: ${formatNumber(d.value, props.locale, props.unit)}`,
      );
      return lines.length > 1
        ? `${t(`impact.series.${key}`)} — ${values.join(', ')}`
        : values.join(', ');
    })
    .join('. ');
}

function text(x, y, content, className) {
  const node = el('text', { x, y, class: className });
  node.textContent = content;
  return node;
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
