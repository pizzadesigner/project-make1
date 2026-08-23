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

/** Two more things jsdom does not implement: SVG path geometry and the Web
 * Animations API. lineChart.js draws each line on with a dash offset, which
 * needs both. Same shape as the matchMedia stub above — a gap in the test
 * environment, not a branch the component should carry. */
function stubSvgGeometry() {
  const proto = window.SVGElement.prototype;
  proto.getTotalLength = () => 100;
  proto.animate = () => ({ cancel() {}, finish() {} });
  return () => {
    delete proto.getTotalLength;
    delete proto.animate;
  };
}

const props = {
  project: { id: 'koeln-test', citySlug: 'koeln' },
  activeCriterion: null,
  metrics: { problemFit: null, impact: null, adoption: null },
  impactModules: [],
  problemFitModules: [],
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

  // Adoption has no researched content at any city yet, so its six cards come
  // back empty — which is the honest stand-in, and must stay distinguishable
  // from a card whose content simply failed to render.
  it('leaves a criterion with no content standing in six empty cards', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    const cards = [...region().querySelectorAll('.widget-detail__card')];
    expect(cards).toHaveLength(6);
    expect(cards.every((card) => card.textContent.trim() === '')).toBe(true);
  });
});

// The content half. What a module is (`kind`) is decided in the data layer, and
// each kind has one shape it must come out as — so these check the shape, not
// the copy: a donut module that rendered a line chart, or a card that lost its
// source chip, is a figure standing on the canvas with nothing behind it.
describe('filling the modules', () => {
  let undoGeometry = null;
  beforeEach(() => {
    undoGeometry = stubSvgGeometry();
  });
  afterEach(() => {
    undoGeometry?.();
    undoGeometry = null;
  });

  const source = { url: 'https://example.org/a', label: 'A', accessed: '2026-08-23' };
  const noteSource = { url: 'https://example.org/b', label: 'B', accessed: '2026-08-23' };
  const filled = [
    {
      key: 'modalSplit',
      kind: 'donut',
      labelKey: 'impact.modalSplit',
      modes: ['transit', 'bike'],
      rings: [
        { year: 2017, values: [21, 18] },
        { year: 2022, values: [17, 25] },
      ],
      latestYear: 2022,
      source,
      target: null,
    },
    {
      key: 'car',
      kind: 'lines',
      labelKey: 'impact.carDensity',
      lines: [
        {
          key: 'car',
          points: [
            { year: 2015, value: 356 },
            { year: 2025, value: 373 },
          ],
        },
      ],
      unit: 'per 1000 residents',
      latest: { year: 2025, value: 373 },
      source,
      note: { key: 'koeln.car', source: noteSource },
    },
    {
      key: 'cycleNetwork',
      kind: 'breakdown',
      labelKey: 'impact.cycleNetwork',
      headline: { value: 2.48, unit: 'km per 1000 residents' },
      parts: [
        { key: 'mixed', value: 780.31 },
        { key: 'separated', value: 1248.67 },
        { key: 'offstreet', value: 699.8 },
      ],
      total: 2728.78,
      planned: 198.59,
      source,
      note: { key: 'koeln.cycleNetwork', source: null },
    },
    {
      key: 'roadSafety',
      kind: 'trend',
      labelKey: 'impact.roadSafety',
      points: [
        { year: 2015, value: 5.5 },
        { year: 2020, value: 4.8 },
      ],
      unit: 'per 1000 residents',
      latest: { year: 2020, value: 4.8 },
      source,
      note: null,
    },
  ];

  const open = () => stack.update({ ...props, activeCriterion: 'impact', impactModules: filled });
  const card = (index) => region().querySelectorAll('.widget-detail__card')[index];

  it('gives each module the shape its kind calls for', () => {
    open();
    expect(card(0).querySelector('svg.modal-split')).not.toBeNull();
    expect(card(1).querySelector('svg.line-chart')).not.toBeNull();
    expect(card(2).querySelectorAll('.module__bar-part')).toHaveLength(3);
    // A trend states its points rather than drawing a line through two
    // measurements five years apart.
    expect(card(3).querySelector('svg')).toBeNull();
    expect(card(3).querySelectorAll('.module__trend-point')).toHaveLength(2);
  });

  // Two rings, two modes: the ring stack and the table beside it are the same
  // data twice, and the table is what carries the years now that the pills are
  // too small to read at this size.
  it('names every ring and mode in the table beside the donut', () => {
    open();
    expect(card(0).querySelectorAll('svg.modal-split path.modal-split__seg')).toHaveLength(4);
    expect(card(0).querySelectorAll('svg.modal-split .modal-split__year')).toHaveLength(0);
    const years = [...card(0).querySelectorAll('.module__matrix thead th')].map(
      (cell) => cell.textContent,
    );
    expect(years).toEqual(['2017', '2022']);
    expect(card(0).querySelectorAll('.module__matrix tbody tr')).toHaveLength(2);
  });

  // The bar's segments are sized by the parts themselves, so a reader can take
  // the widths at face value — no rounding, no minimum share.
  it('sizes the breakdown bar from the parts', () => {
    open();
    const grows = [...card(2).querySelectorAll('.module__bar-part')].map(
      (part) => part.style.flexGrow,
    );
    expect(grows).toEqual(['780.31', '1248.67', '699.8']);
  });

  // Every claim on a card carries the document behind it: the figures' source,
  // and the note's own when the sentence came from somewhere else.
  it('chips every source a card rests on, and no more', () => {
    open();
    expect(card(0).querySelectorAll('.source-chip')).toHaveLength(1);
    expect(card(1).querySelectorAll('.source-chip')).toHaveLength(2);
    expect(card(2).querySelectorAll('.source-chip')).toHaveLength(1);
  });

  // A figure inside a sentence comes from the module, not from the copy.
  it('fills a figure into the note that names it', () => {
    open();
    expect(card(2).querySelector('.module__note').textContent).toContain('198.59');
  });

  // The region is rebuilt from innerHTML on every sync, so a chart or chip left
  // mounted is a leaked tooltip node and a set of listeners on a detached tree.
  it('tears the mounted content down when the region closes', () => {
    open();
    expect(region().querySelectorAll('.tooltip').length).toBeGreaterThan(0);
    stack.update({ ...props, activeCriterion: null });
    expect(region().querySelectorAll('.tooltip')).toHaveLength(0);
    expect(region().querySelectorAll('.widget-detail__card')).toHaveLength(0);
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
