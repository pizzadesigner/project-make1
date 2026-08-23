// The L1→L2 seam: entering a criterion opens the region and stands its modules
// in it, and leaving takes the whole thing away again.
//
// The teardown half is the one worth a test. The region is rebuilt from
// innerHTML on every sync, so anything not cleared first is left in the DOM.
// Under reduced motion there is no exit animation to wait for either, which
// makes "clears in the same tick" a behaviour and not just a duration.
//
// The entrance half is worth one too, for a different reason: the modules are
// supposed to come out of the widget that was clicked rather than in from the
// edge, and the only thing holding them to it is arithmetic over two measured
// boxes. A sign error there is a module flying in from off-screen — which is
// precisely the entrance this replaced, and which looks deliberate enough that
// nobody would call it a bug.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from './widgetStack.js';

/** jsdom ships no matchMedia, and a11y.js asks it whether to animate. */
function stubReducedMotion(reduce) {
  window.matchMedia = () => ({ matches: reduce });
}

const props = {
  project: { id: 'koeln-test', citySlug: 'koeln' },
  activeCriterion: null,
  metrics: { problemFit: null, impact: null, adoption: null },
  impactSubMetrics: [],
  modalSplitTarget: null,
  problemFit: null,
  comingSoon: false,
  onSelectCriterion: () => {},
};

// jsdom lays nothing out: every rect is 0x0 and every offset 0. These are the
// boxes setFlightOrigin measures — the widget the modules leave, the region
// they land in, and a cell for each of them — with the numbers picked so the
// expected offsets stay readable (the widget is 380 wide against a 304-wide
// cell, so the scale is exactly 1.25).
const REGION_BOX = { left: 24, top: 72, width: 900, height: 800 };
const WIDGET_BOX = { left: 16, top: 72, width: 380, height: 340 };
const CELL_WIDTH = 304;
const cellLeft = (index) => 16 + (index % 3) * 340;
const cellTop = (index) => 20 + index * 120;

/** Which module a node is, by the class that places it, or null for anything
 * that is not a module. */
function moduleIndex(node) {
  const place = [...node.classList].find((name) => name.startsWith('widget-detail__module--'));
  return place ? Number(place.slice(-1)) - 1 : null;
}

/** Give jsdom just enough layout for the entrance to be measurable, and hand
 * back the undo — nothing else in the suite wants these boxes. */
function stubLayout() {
  const realRect = Element.prototype.getBoundingClientRect;
  const offsets = {
    offsetWidth: (node) => (moduleIndex(node) === null ? 0 : CELL_WIDTH),
    offsetLeft: (node) => cellLeft(moduleIndex(node) ?? 0),
    offsetTop: (node) => cellTop(moduleIndex(node) ?? 0),
  };
  Element.prototype.getBoundingClientRect = function fakeRect() {
    if (this.classList.contains('widget')) return { ...WIDGET_BOX };
    if (this.classList.contains('widget-detail')) return { ...REGION_BOX };
    return realRect.call(this);
  };
  for (const [name, from] of Object.entries(offsets)) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get() {
        return from(this);
      },
    });
  }
  return () => {
    Element.prototype.getBoundingClientRect = realRect;
    for (const name of Object.keys(offsets)) delete HTMLElement.prototype[name];
  };
}

let container;
let stack;
let undoLayout = null;

beforeEach(() => {
  stubReducedMotion(false);
  container = document.createElement('div');
  document.body.append(container);
  stack = render(container, props);
});

afterEach(() => {
  undoLayout?.();
  undoLayout = null;
  stack.destroy();
  container.remove();
});

const region = () => container.querySelector('.widget-detail');
const modules = () => container.querySelectorAll('.widget-detail__module');

// A widget that opens into the six modules stands on a deck of cards, so the
// flight out starts from something the user has already seen rather than from
// an empty corner. Which widgets carry one is a design decision (DECK_WIDGETS),
// not a property of having an L2 — every widget has one of those.
describe('the deck at L1', () => {
  it('gives Problem Fit a deck and leaves the others flat', () => {
    expect(container.querySelector('.widget--problemFit').classList).toContain('widget--deck');
    expect(container.querySelector('.widget--impact').classList).not.toContain('widget--deck');
    expect(container.querySelector('.widget--adoption').classList).not.toContain('widget--deck');
  });
});

describe('entering L2', () => {
  it('opens the region with its full set of modules', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().hidden).toBe(false);
    expect(modules()).toHaveLength(6);
  });

  // Each module's position in the three staggered columns, the order it flies
  // out in, and the path it takes all hang off this class (see widgets.css), so
  // a module without one would land on top of module 1.
  it('gives every module its own place in the arrangement', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    const places = [...modules()].map((module) =>
      [...module.classList].find((name) => name.startsWith('widget-detail__module--')),
    );
    expect(places).toEqual([1, 2, 3, 4, 5, 6].map((n) => `widget-detail__module--${n}`));
  });

  it('opens on the side its widget sits on', () => {
    stack.update({ ...props, activeCriterion: 'problemFit' });
    expect(region().classList.contains('widget-detail--left')).toBe(true);
    stack.update({ ...props, activeCriterion: null });
    stack.update({ ...props, activeCriterion: 'impact' });
    expect(region().classList.contains('widget-detail--right')).toBe(true);
  });

  // The modules are empty shells until content is moved into them
  // (detailContent.js), and an empty shell must not be announced as if it held
  // a figure.
  it('draws the arrows between the modules they join', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().querySelectorAll('.connector__line')).toHaveLength(2);
  });

  // The widgets left standing on the map's side are context at L2. They are
  // already inert and dimmed; stepping them down in size is what stops them
  // competing with the modules for the same glance.
  it('steps the widgets on the map side down in size', () => {
    stack.update({ ...props, activeCriterion: 'impact' });
    const bystander = container.querySelector('.widget--problemFit');
    const covered = container.querySelector('.widget--adoption');
    expect(bystander.style.transform).toBe('scale(0.78)');
    expect(bystander.style.transformOrigin).toBe('top left');
    // The ones the modules cover are out of sight, so they keep their size.
    expect(covered.style.transform).toBe('scale(1)');
    expect(covered.style.opacity).toBe('0');
  });

  it('keeps the empty scaffold out of the accessibility tree', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().querySelector('.widget-detail__modules').getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

// One movement out of one card: every module starts on the widget that was
// clicked, at that widget's width, and travels to its own place. The stylesheet
// only ever multiplies these three values by --module-fly, so if they are wrong
// there is nothing downstream to catch it.
describe('the flight out of the widget', () => {
  it('starts every module on the clicked widget, at the widget\u2019s width', () => {
    undoLayout = stubLayout();
    stack.update({ ...props, activeCriterion: 'problemFit' });

    const starts = [...modules()].map((module, index) => ({
      x: module.style.getPropertyValue('--from-x'),
      y: module.style.getPropertyValue('--from-y'),
      scale: module.style.getPropertyValue('--from-scale'),
      // Where the module ends up, in the same coordinates, so the two can be
      // compared without re-deriving the arithmetic under test.
      cell: { left: cellLeft(index), top: cellTop(index) },
    }));

    expect(starts).toHaveLength(6);
    for (const start of starts) {
      // The offset lands the module's corner on the widget's corner: region
      // origin + cell + offset === widget.
      expect(REGION_BOX.left + start.cell.left + Number.parseFloat(start.x)).toBe(WIDGET_BOX.left);
      expect(REGION_BOX.top + start.cell.top + Number.parseFloat(start.y)).toBe(WIDGET_BOX.top);
      // Uniform, and taken from the width alone — a widget is a tall card and a
      // module a wide one, so a scale per axis would squash the module.
      expect(start.scale).toBe(String(WIDGET_BOX.width / CELL_WIDTH));
    }
  });

  it('sends no two modules along the same line', () => {
    undoLayout = stubLayout();
    stack.update({ ...props, activeCriterion: 'problemFit' });
    const lines = [...modules()].map(
      (module) =>
        `${module.style.getPropertyValue('--from-x')},${module.style.getPropertyValue('--from-y')}`,
    );
    expect(new Set(lines).size).toBe(lines.length);
  });

  // Measuring a page that has not been laid out yet would put every module at
  // an offset of zero-minus-zero and call it a flight. Better to leave the
  // stylesheet's fallbacks alone: they stand the module on its own cell, at its
  // own size, which is where it was going anyway.
  it('leaves the modules where they belong when there is nothing to measure', () => {
    stack.update({ ...props, activeCriterion: 'problemFit' });
    for (const module of modules()) {
      expect(module.style.getPropertyValue('--from-x')).toBe('');
      expect(module.style.getPropertyValue('--from-scale')).toBe('');
    }
  });
});

describe('leaving L2', () => {
  it('clears the region completely', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.update({ ...props, activeCriterion: null });
    // Reduced motion is off but jsdom resolves no token, so the hold is 0 and
    // the region has already cleared — what this pins is that it cleared
    // completely rather than being merely hidden.
    expect(region().hidden).toBe(true);
    expect(region().children).toHaveLength(0);
    expect(modules()).toHaveLength(0);
    expect(container.querySelector('.connector')).toBeNull();
  });

  it('clears in the same tick when the user asked for no motion', () => {
    stubReducedMotion(true);
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.update({ ...props, activeCriterion: null });
    expect(region().hidden).toBe(true);
    expect(region().classList.contains('is-leaving')).toBe(false);
    expect(modules()).toHaveLength(0);
  });
});

describe('re-syncing a region that is already open', () => {
  it('leaves the modules where they are instead of replaying the entrance', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().classList.contains('is-settled')).toBe(false);
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().classList.contains('is-settled')).toBe(true);
  });
});

describe('destroying the stack', () => {
  it('leaves nothing behind', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    stack.destroy();
    expect(container.querySelector('.widget-stack')).toBeNull();
    expect(container.querySelector('.widget-detail')).toBeNull();
    // afterEach destroys again — a second teardown must be harmless.
  });
});
