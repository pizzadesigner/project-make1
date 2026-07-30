// A small time-series line chart (adoption/impact over years), animated on entry
// and reduced-motion aware. One project's own metric over time — absolute
// values, so no cross-city normalisation is implied. Data down as
// { series, unit, locale }; the component owns only its SVG.

import { scaleLinear, line, min, max, extent } from 'd3';
import { formatNumber, formatYear } from '../lib/format.js';
import { motionMs, prefersReducedMotion } from '../lib/a11y.js';
import { renderTooltip } from './tooltip.js';

const W = 640;
const H = 260;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 52 };
// Compact mode drops the axes/gridlines/unit label entirely (there's no room
// for legible 12px-in-a-640-viewBox text once this scales down into a narrow
// widget slot) and reclaims that space for the line itself — a sparkline, not
// a smaller version of the full chart.
const COMPACT_MARGIN = { top: 6, right: 6, bottom: 6, left: 6 };
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} container
 * @param {{ series: {year: number, value: number}[], unit: string|null, locale: 'en'|'de', compact?: boolean }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const compact = Boolean(props.compact);
  const margin = compact ? COMPACT_MARGIN : MARGIN;
  const svg = el('svg', {
    class: compact ? 'line-chart line-chart--compact' : 'line-chart',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
  });
  svg.setAttribute('aria-label', describe(props));
  container.append(svg);

  // The tooltip anchors within the container, so it must be a positioned box.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const tooltip = renderTooltip(container);

  const x = scaleLinear()
    .domain(extent(props.series, (d) => d.year))
    .range([margin.left, W - margin.right]);
  const y = scaleLinear()
    .domain(yDomain(props.series, compact))
    .nice()
    .range([H - margin.bottom, margin.top]);

  if (!compact) drawAxes(svg, x, y, props);
  drawLine(svg, x, y, props.series);
  drawDots(svg, x, y, props.series, compact, { container, tooltip, props });

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
function yDomain(series, compact) {
  const lo = min(series, (d) => d.value);
  const hi = max(series, (d) => d.value);
  if (!compact) return [0, hi || 1];
  const span = hi - lo;
  const pad = span > 0 ? span * 0.15 : Math.max(hi * 0.05, 1);
  return [lo - pad, hi + pad];
}

function drawAxes(svg, x, y, props) {
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
  for (const point of props.series) {
    svg.append(
      text(x(point.year), H - MARGIN.bottom + 20, formatYear(point.year), 'line-chart__x-label'),
    );
  }
  if (props.unit) {
    svg.append(text(MARGIN.left, MARGIN.top - 4, props.unit, 'line-chart__unit'));
  }
}

function drawLine(svg, x, y, series) {
  if (series.length < 2) return;
  const path = el('path', {
    class: 'line-chart__line',
    d: line()
      .x((d) => x(d.year))
      .y((d) => y(d.value))(series),
  });
  svg.append(path);
  animateDraw(path);
}

function drawDots(svg, x, y, series, compact, hover) {
  const r = compact ? 3 : 4;
  for (const point of series) {
    const cx = x(point.year);
    const cy = y(point.value);
    const dot = el('circle', { class: 'line-chart__dot', cx, cy, r });
    svg.append(dot);
    // A larger transparent hit target so the small dot is comfortable to hover;
    // it enlarges the dot and shows the value tooltip.
    const hit = el('circle', { class: 'line-chart__hit', cx, cy, r: 14 });
    wirePoint(hit, dot, point, hover);
    svg.append(hit);
  }
}

function wirePoint(hit, dot, point, { container, tooltip, props }) {
  const html = `<strong>${formatNumber(point.value, props.locale, props.unit)}</strong><span>${formatYear(point.year)}</span>`;
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

function describe(props) {
  const values = props.series.map(
    (d) => `${formatYear(d.year)}: ${formatNumber(d.value, props.locale, props.unit)}`,
  );
  return values.join(', ');
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
