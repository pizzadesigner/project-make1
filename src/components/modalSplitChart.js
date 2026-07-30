// A concentric-ring donut of a city's modal split: one ring per year (oldest
// innermost, newest outermost), each divided into transport-mode segments sized
// by that year's share. Colours come from the stylesheet (per-mode classes);
// this component owns only its SVG. Data down as { modes, rings, ariaLabel };
// static (no tweens), so nothing to reduce under prefers-reduced-motion.

import { arc } from 'd3';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 220;
const HOLE = 26; // inner hole radius
const RING_GAP = 2; // gap between rings and between segments

/**
 * @param {HTMLElement} container
 * @param {{ modes: string[], rings: {year: number, values: number[]}[], ariaLabel: string }} props
 * @returns {{ update(): void, destroy(): void }}
 */
export function render(container, props) {
  const { modes, rings, ariaLabel } = props;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'modal-split');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('transform', `translate(${SIZE / 2} ${SIZE / 2})`);
  svg.append(group);

  const ringWidth = (SIZE / 2 - HOLE - RING_GAP) / Math.max(rings.length, 1);
  const build = arc().padAngle(0.008);

  rings.forEach((ring, ri) => {
    const innerRadius = HOLE + ri * ringWidth;
    const outerRadius = innerRadius + ringWidth - RING_GAP;
    const total = ring.values.reduce((sum, v) => sum + v, 0) || 1;
    let startAngle = 0; // 12 o'clock (d3.arc measures clockwise from the top)
    ring.values.forEach((value, mi) => {
      const endAngle = startAngle + (value / total) * Math.PI * 2;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', build({ innerRadius, outerRadius, startAngle, endAngle }));
      path.setAttribute('class', `modal-split__seg modal-split__seg--${modes[mi]}`);
      group.append(path);
      startAngle = endAngle;
    });
    // Year label on the top centre-line of the ring, so each ring names the year
    // it represents. A pill background keeps it legible over the segments.
    group.append(yearLabel(ring.year, (innerRadius + outerRadius) / 2));
  });

  container.append(svg);

  return {
    update() {},
    destroy() {
      svg.remove();
    },
  };
}

/** A pill-backed year label centred at the top of a ring (radius `midRadius`). */
function yearLabel(year, midRadius) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', `translate(0 ${-midRadius})`);
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('class', 'modal-split__year-bg');
  rect.setAttribute('x', '-15');
  rect.setAttribute('y', '-8');
  rect.setAttribute('width', '30');
  rect.setAttribute('height', '16');
  rect.setAttribute('rx', '3');
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('class', 'modal-split__year');
  text.setAttribute('dy', '0.35em');
  text.textContent = String(year);
  g.append(rect, text);
  return g;
}
