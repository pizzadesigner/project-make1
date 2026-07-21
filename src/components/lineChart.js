// A small time-series line chart (adoption/impact over years), animated on entry
// and reduced-motion aware. One project's own metric over time — absolute
// values, so no cross-city normalisation is implied. Data down as
// { series, unit, locale }; the component owns only its SVG.

import { scaleLinear, line, max, extent } from 'd3';
import { formatNumber, formatYear } from '../lib/format.js';
import { motionMs, prefersReducedMotion } from '../lib/a11y.js';

const W = 640;
const H = 260;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 52 };
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} container
 * @param {{ series: {year: number, value: number}[], unit: string|null, locale: 'en'|'de' }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const svg = el('svg', { class: 'line-chart', viewBox: `0 0 ${W} ${H}`, role: 'img' });
  svg.setAttribute('aria-label', describe(props));
  container.append(svg);

  const x = scaleLinear()
    .domain(extent(props.series, (d) => d.year))
    .range([MARGIN.left, W - MARGIN.right]);
  const y = scaleLinear()
    .domain([0, max(props.series, (d) => d.value) || 1])
    .nice()
    .range([H - MARGIN.bottom, MARGIN.top]);

  drawAxes(svg, x, y, props);
  drawLine(svg, x, y, props.series);
  drawDots(svg, x, y, props.series);

  return {
    update() {},
    destroy() {
      svg.remove();
    },
  };
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

function drawDots(svg, x, y, series) {
  for (const point of series) {
    svg.append(
      el('circle', { class: 'line-chart__dot', cx: x(point.year), cy: y(point.value), r: 4 }),
    );
  }
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
