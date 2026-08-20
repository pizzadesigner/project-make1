// The arrows between L2 modules. Two things here are worth pinning down, and
// neither is visible from a screenshot.
//
// The first is where an arrow meets a module. It has to start inside the module
// it leaves and stop short of the one it enters: the layer sits behind the
// cards, so a tail flush with the edge shows a seam and a head flush with the
// far edge is painted underneath it and disappears. Those two insets are also
// the slack that keeps an arrow attached while the modules drift at rest.
//
// The second is that both control points sit level with their own end, which is
// what makes the curve leave and arrive horizontally instead of cutting the
// corner as a bent diagonal.
//
// The head travelling the line is checked here too, because the head and the
// line are only in step for as long as they are drawn from the same curve.

import { describe, it, expect } from 'vitest';
import { render, arrowPath, endpoints } from './connector.js';

const source = { x: 0, y: 100, width: 200, height: 100 };
const target = { x: 300, y: 0, width: 200, height: 100 };

/** The points of an `M x y C ...` path, as {x, y} pairs. */
function points(d) {
  const numbers = d.match(/-?[\d.]+/g).map(Number);
  const pairs = [];
  for (let i = 0; i < numbers.length; i += 2) pairs.push({ x: numbers[i], y: numbers[i + 1] });
  return pairs;
}

describe('endpoints', () => {
  it('starts inside the source and stops short of the target', () => {
    const { start, end } = endpoints(source, target);
    expect(start.x).toBeGreaterThan(source.x);
    expect(start.x).toBeLessThan(source.x + source.width);
    expect(end.x).toBeLessThan(target.x);
  });

  it('fans two arrows apart so they do not leave on the same line', () => {
    const first = endpoints(source, target, 0, 2);
    const second = endpoints(source, target, 1, 2);
    expect(first.start.y).not.toBe(second.start.y);
    // Evenly, either side of the edge's middle.
    const middle = source.y + source.height / 2;
    expect(first.start.y + second.start.y).toBeCloseTo(middle * 2);
  });

  it('aims at the middle of the target whichever way it is going', () => {
    const middle = target.y + target.height / 2;
    expect(endpoints(source, target, 0, 2).end.y).toBe(middle);
    expect(endpoints(source, target, 1, 2).end.y).toBe(middle);
  });
});

describe('arrowPath', () => {
  it('is a cubic bezier, not a line', () => {
    const d = arrowPath(source, target);
    expect(d).toMatch(/^M .* C /);
    expect(points(d)).toHaveLength(4);
  });

  it('leaves and arrives horizontally', () => {
    const [start, control1, control2, end] = points(arrowPath(source, target));
    expect(control1.y).toBe(start.y);
    expect(control2.y).toBe(end.y);
    expect(control1.x).toBeGreaterThan(start.x);
    expect(control2.x).toBeLessThan(end.x);
  });
});

describe('the mounted layer', () => {
  const links = [
    { source, target },
    { source, target: { x: 300, y: 200, width: 200, height: 100 } },
  ];

  /** jsdom answers no support of its own, so the head strategy is stubbed:
   * `travelling` is the modern path, anything else the marker fallback. */
  function mount(travelling = true) {
    window.CSS = { supports: () => travelling };
    const container = document.createElement('div');
    document.body.append(container);
    return { container, handle: render(container, { links }) };
  }

  it('draws a line and a head for every link', () => {
    const { container, handle } = mount();
    expect(container.querySelectorAll('.connector__line')).toHaveLength(2);
    expect(container.querySelectorAll('.connector__head')).toHaveLength(2);
    handle.destroy();
  });

  // The head is the thing that draws the line, so it has to travel the same
  // curve — not an approximation of it, or it drifts off the tip mid-draw.
  it('sends each head along its own line', () => {
    const { container, handle } = mount();
    const [first, second] = container.querySelectorAll('.connector__line');
    const [firstHead, secondHead] = container.querySelectorAll('.connector__head');
    expect(firstHead.style.getPropertyValue('offset-path')).toBe(
      `path("${first.getAttribute('d')}")`,
    );
    expect(secondHead.style.getPropertyValue('offset-path')).toBe(
      `path("${second.getAttribute('d')}")`,
    );
    handle.destroy();
  });

  // Without offset-path there is nothing to carry the head, so it goes back to
  // being a marker at the end of the line rather than nothing at all.
  it('falls back to a marker where the head cannot travel', () => {
    const { container, handle } = mount(false);
    expect(container.querySelectorAll('#connector-arrowhead')).toHaveLength(1);
    for (const line of container.querySelectorAll('.connector__line')) {
      expect(line.getAttribute('marker-end')).toBe('url(#connector-arrowhead)');
    }
    expect(container.querySelectorAll('.connector__head--travelling')).toHaveLength(0);
    handle.destroy();
  });

  // The stagger and the out-of-step pulses hang off this. Read off the element
  // rather than its position among its siblings, because each link contributes
  // two paths and the positions stop matching the arrow numbers.
  it('numbers each arrow for the stylesheet to stagger', () => {
    const { container, handle } = mount();
    const indices = [...container.querySelectorAll('.connector__line')].map((line) =>
      line.style.getPropertyValue('--arrow-index'),
    );
    expect(indices).toEqual(['0', '1']);
    handle.destroy();
  });

  // The reveal is a dashoffset 1 → 0 in the stylesheet, which only works on a
  // path whose length has been normalised: without pathLength the dash pattern
  // is in user units and a 1-unit dash on a 300px curve draws nothing.
  it('normalises every path length so the stylesheet can reveal it', () => {
    const { container, handle } = mount();
    for (const node of container.querySelectorAll('.connector__line')) {
      expect(node.getAttribute('pathLength')).toBe('1');
    }
    handle.destroy();
  });

  it('marks itself decorative — the modules it joins do the announcing', () => {
    const { container, handle } = mount();
    expect(container.querySelector('.connector').getAttribute('aria-hidden')).toBe('true');
    handle.destroy();
  });

  it('leaves no SVG behind', () => {
    const { container, handle } = mount();
    handle.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });
});
