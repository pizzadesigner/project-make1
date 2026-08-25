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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from './widgetStack.js';

// A third thing jsdom does not implement: the timeline redraws its track when
// the card it is in changes width. Same shape as the stubs below — a gap in the
// test environment, not a branch the component should carry.
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};

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
  adoptionModules: [],
  comingSoon: false,
  activeModule: null,
  onSelectCriterion: () => {},
  onSelectModule: () => {},
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
// an empty corner. All three do, so all three carry one: the deck says "this
// opens", and a flat card beside a deck said the two behaved differently.
describe('the deck at L1', () => {
  it('gives every widget that opens into modules a deck', () => {
    for (const kind of ['problemFit', 'impact', 'adoption']) {
      expect(container.querySelector(`.widget--${kind}`).classList).toContain('widget--deck');
    }
  });

  // The deck leans into the screen rather than towards the edge its widget is
  // anchored to — a right-hand widget sits closer to the edge than the deck is
  // deep, so fanning right would hang it off the screen.
  it('fans each deck away from the edge its widget is anchored to', () => {
    expect(container.querySelector('.widget--problemFit').classList).toContain('widget--deck-left');
    for (const kind of ['impact', 'adoption']) {
      expect(container.querySelector(`.widget--${kind}`).classList).toContain('widget--deck-right');
    }
  });
});

describe('entering L2', () => {
  it('opens the region with its full set of modules', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    expect(region().hidden).toBe(false);
    // Adoption is five cards: four in two columns and the timeline below them.
    expect(modules()).toHaveLength(5);
  });

  // Each module's position in the three staggered columns, the order it flies
  // out in, and the path it takes all hang off this class (see widgets.css), so
  // a module without one would land on top of module 1.
  it('gives every module its own place in the arrangement', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    const places = [...modules()].map((module) =>
      [...module.classList].find((name) => name.startsWith('widget-detail__module--')),
    );
    expect(places).toEqual([1, 2, 3, 4, 5].map((n) => `widget-detail__module--${n}`));
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

  // A city with nothing researched for a criterion gets six empty cards — the
  // honest stand-in, and it must stay distinguishable from a card whose content
  // simply failed to render.
  it('leaves a criterion with no content standing in empty cards', () => {
    stack.update({ ...props, activeCriterion: 'adoption' });
    const cards = [...region().querySelectorAll('.widget-detail__card')];
    expect(cards).toHaveLength(5);
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

  // The SDGs card, as selectors.js#problemFitModules hands it down: a lead, two
  // targets, and an ⓘ on each of them that the L1 preview has to leave behind.
  const problemFitCards = [
    {
      key: 'sdgs',
      kind: 'targets',
      labelKey: 'problemFit.card.sdgs',
      leadKey: 'problemFit.koeln.sdgsLead',
      targets: [
        {
          code: '11.2',
          textKey: 'problemFit.koeln.target.11.2',
          infoKey: 'problemFit.targetDefinition.11.2',
        },
        {
          code: '11.6',
          textKey: 'problemFit.koeln.target.11.6',
          infoKey: 'problemFit.targetDefinition.11.6',
        },
      ],
    },
  ];

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

  // The L1 widget used to headline with a bare figure, which read as a different
  // thing from the card it opened into. It now stands on that card — the same
  // body, minus the sentence and the chips that belong to the reading below it.
  it('stands the impact widget on the card it opens into', () => {
    stack.update({ ...props, impactModules: filled });
    const widget = container.querySelector('.widget--impact');
    expect(widget.querySelectorAll('.module__bar-part')).toHaveLength(3);
    expect(widget.querySelectorAll('.module__legend-item')).toHaveLength(3);
    expect(widget.textContent).toContain('2.48');
    // Everything that belongs to the card and not to the widget standing on it.
    expect(widget.querySelector('.module__note')).toBeNull();
    expect(widget.querySelector('.module__sources')).toBeNull();
    expect(widget.querySelector('.module__info')).toBeNull();
    expect(widget.querySelector('.module__expand')).toBeNull();
  });

  // All three widgets stand on one of their own cards now, so the correspondence
  // is the thing to hold: what you click at L1 is what opens at L2, not a
  // summary of it. Problem Fit's is the SDGs card — its lead and its two boxes.
  it('stands the problem fit widget on the card it opens into', () => {
    stack.update({ ...props, problemFitModules: problemFitCards });
    const widget = container.querySelector('.widget--problemFit');
    expect(widget.querySelectorAll('.module__target-item')).toHaveLength(2);
    expect(widget.querySelector('.module__lead')).not.toBeNull();
    expect(widget.textContent).toContain('SDG 11.2');
    // Everything that belongs to the card and not to the widget standing on it —
    // the info points included, because the widget is one control and a button
    // inside it is a tab stop before it.
    expect(widget.querySelector('.module__info')).toBeNull();
    expect(widget.querySelector('.module__sources')).toBeNull();
    expect(widget.querySelector('.module__expand')).toBeNull();
  });

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

  // The target sentence has two readings, like the card it sits on: the short one
  // in a column, and — where the target says what plan it comes from — the one
  // naming that plan in the room the opened card has. A city whose target has no
  // such wording keeps the short sentence at both sizes rather than being handed
  // a longer one with holes in it, which is what the fallbacks below check.
  describe('the target sentence', () => {
    const reached = {
      key: 'modalSplit',
      kind: 'donut',
      labelKey: 'impact.modalSplit',
      infoKey: 'impact.info.modalSplit',
      detailKey: 'impact.detail.modalSplit',
      detailTitleKey: 'impact.detailTitle.modalSplit',
      modes: ['transit', 'bike'],
      rings: [
        { year: 2017, values: [30, 20] },
        { year: 2022, values: [40, 35] },
      ],
      latestYear: 2022,
      source,
      target: {
        year: 2025,
        comparable: true,
        segments: [
          {
            mode: 'umweltverbund',
            share: 67,
            shareKey: 'twoThirds',
            actualModes: ['transit', 'bike'],
          },
        ],
        periodKey: 'impact.modalSplitTarget.period',
        strategyKey: 'impact.modalSplitTarget.strategy',
      },
    };
    const openWith = (module, activeModule = null) =>
      stack.update({
        ...props,
        activeCriterion: 'impact',
        impactModules: [module],
        activeModule,
      });
    const sentence = () => region().querySelector('.module__target').textContent.trim();

    it('states the short reading in a column', () => {
      openWith(reached);
      // 40 + 35, and the year the newest ring was measured in.
      expect(sentence()).toBe(
        'In 2022, sustainable modes were already at 75 %, above the two-thirds target for 2025.',
      );
    });

    it('names the plan and its period once the card is opened', () => {
      openWith(reached);
      openWith(reached, 'modalSplit');
      expect(sentence()).toContain('2025/2030');
      expect(sentence()).toContain('Köln mobil 2025');
    });

    it('keeps the short reading for a target with no wording of its own', () => {
      const bare = { ...reached, target: { ...reached.target } };
      delete bare.target.periodKey;
      delete bare.target.strategyKey;
      openWith(bare);
      openWith(bare, 'modalSplit');
      expect(sentence()).not.toContain('2025/2030');
      expect(sentence()).toContain('for 2025.');
    });
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
    // Impact, which stands its six in two columns — the flight is measured the
    // same way whatever the arrangement, and six modules exercise more of it.
    stack.update({ ...props, activeCriterion: 'impact' });

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

// L3: one module opens into the focus slot and the other five stand aside in a
// rail. The arrangement it moves between is measured on the running page, so
// what is worth testing is the arithmetic over those measurements — every place
// here is derived from the boxes and the tokens below, and a card that came out
// somewhere else is a card standing over the map or on top of another one.
describe('the focus slot at L3', () => {
  // The arrangement the six rest in, as jsdom will not lay one out: a 900x600
  // area holding six 300x120 cards. The numbers are picked so the rail's own
  // fit (176/300) lands *under* the floor, which is the case that decides
  // whether the floor is honoured or silently overridden.
  const AREA = { width: 900, height: 600 };
  const CARD = { width: 300, height: 120 };
  const TOKENS = {
    '--module-rail-width': '176px',
    '--module-rail-gap': '14px',
    '--module-focus-gap': '28px',
    '--module-rail-min-scale': '0.62',
  };

  /** The tokens the layout reads, and enough offsets to measure a box from. */
  function stubArrangement() {
    for (const [name, value] of Object.entries(TOKENS)) {
      document.documentElement.style.setProperty(name, value);
    }
    const box = (node) => {
      if (node.classList.contains('widget-detail__modules')) return AREA;
      return moduleIndex(node) === null ? { width: 0, height: 0 } : CARD;
    };
    // A distinct resting place per module, so "flew back to where it was" is a
    // claim about six different boxes rather than about zero six times over.
    // The columns' own origin stays 0,0 — every box is measured against the
    // region, which is what the places are written back relative to.
    const offsets = {
      offsetWidth: (node) => box(node).width,
      offsetHeight: (node) => box(node).height,
      offsetLeft: (node) => (moduleIndex(node) ?? 0) * 10,
      offsetTop: (node) => (moduleIndex(node) === null ? 0 : moduleIndex(node) * 130),
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
      for (const name of Object.keys(offsets)) delete HTMLElement.prototype[name];
      for (const name of Object.keys(TOKENS)) {
        document.documentElement.style.removeProperty(name);
      }
    };
  }

  // `infoKey` is attached in the data layer (selectors.js#withInfoKeys) and
  // arrives here like any other field — the component renders what it is handed.
  const modulesOf = (city) => [
    {
      key: 'cost',
      kind: 'facts',
      labelKey: 'adoption.context',
      infoKey: 'adoption.info.cost',
      facts: [],
    },
    {
      key: 'context',
      kind: 'prose',
      labelKey: null,
      infoKey: 'adoption.info.context',
      detailKey: 'adoption.detail.context',
      detailTitleKey: 'adoption.detailTitle.context',
      text: `adoption.${city}.recommendation`,
    },
    {
      key: 'departments',
      kind: 'prose',
      labelKey: null,
      infoKey: 'adoption.info.departments',
      text: 'adoption.koeln.recommendation',
    },
    { key: 'partners', kind: null },
    { key: 'recommendation', kind: null },
    { key: 'funding', kind: null },
  ];

  let undoArrangement = null;
  let cards;

  beforeEach(() => {
    undoArrangement = stubArrangement();
    cards = modulesOf('koeln');
  });
  afterEach(() => {
    undoArrangement?.();
    undoArrangement = null;
  });

  const openL2 = (extra = {}) =>
    stack.update({ ...props, activeCriterion: 'adoption', adoptionModules: cards, ...extra });
  const openL3 = (key) =>
    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: cards,
      activeModule: key,
    });
  const cardFor = (key) => region().querySelector(`.widget-detail__card[data-module="${key}"]`);
  const moduleAt = (index) => region().querySelectorAll('.widget-detail__module')[index];
  const moduleFor = (key) => cardFor(key).closest('.widget-detail__module');

  it('opens the clicked card and leaves the other five as they were', () => {
    openL2();
    openL3('context');
    expect(cardFor('context').classList.contains('is-expanded')).toBe(true);
    expect(cardFor('cost').classList.contains('is-expanded')).toBe(false);
    expect(region().classList.contains('has-focus')).toBe(true);
  });

  // The whole point of the layer: the card gets the region minus the rail, and
  // the five it displaced are stacked down the side their widget is on — which
  // is the right for Adoption, so the opened card sits towards the map rather
  // than against the edge of the screen.
  it('gives the opened card the region minus the rail', () => {
    openL2();
    openL3('context');
    const focus = moduleFor('context');
    expect(focus.style.left).toBe('0px');
    // 900 − 186 − 28: the rail's width is what its cards come out at (300 ×
    // 0.62), not the 176 it was asked for — held at the floor they stay wider,
    // and the slot beside them gets what is actually left.
    expect(focus.style.width).toBe('686px');
    expect(focus.style.height).toBe('600px');
    expect(focus.style.transform).toBe('none');
  });

  it('stacks the rest in the rail, all shrunk by the same scale', () => {
    openL2();
    openL3('context');
    // Every module but the one that opened — the empty shells included: they
    // cannot be opened, but they are still cards standing in the arrangement.
    const rail = [0, 2, 3, 4].map(moduleAt);
    // 176/300 would be 0.587, under the floor — so the floor is what they take,
    // and the rail is allowed to run long rather than the cards being shrunk
    // past reading.
    expect(rail.map((node) => node.style.transform)).toEqual(Array(4).fill('scale(0.62)'));
    // Aligned to the arrangement's outer edge by their own scaled width, so the
    // rail ends exactly where the region does: 900 − 300 × 0.62.
    expect(rail.map((node) => node.style.left)).toEqual(Array(4).fill('714px'));
    // One card's scaled height plus the gap, over and over: 120 × 0.62 + 14,
    // written to whole pixels (round) but accumulated in full.
    expect(rail.map((node) => node.style.top)).toEqual(['0px', '88px', '177px', '265px']);
  });

  it('lifts the cards out of their columns while they are away', () => {
    openL2();
    expect(region().classList.contains('is-pinned')).toBe(false);
    openL3('context');
    expect(region().classList.contains('is-pinned')).toBe(true);
  });

  it('puts the six back in their columns when the slot closes', () => {
    openL2();
    openL3('context');
    openL2();
    expect(region().classList.contains('is-pinned')).toBe(false);
    expect(region().classList.contains('has-focus')).toBe(false);
    expect(moduleFor('context').getAttribute('style')).toBeNull();
    expect(cardFor('context').classList.contains('is-expanded')).toBe(false);
  });

  // A key is held above this component, and the city underneath it can change to
  // one whose six cards are not the same six. A key naming no card here opens
  // nothing rather than opening the card that happens to sit in that position.
  it('ignores a key that names no card in this set', () => {
    openL2();
    openL3('a-card-from-another-city');
    expect(region().querySelector('.is-expanded')).toBeNull();
    expect(region().classList.contains('is-pinned')).toBe(false);
  });

  // An empty shell is the honest stand-in for an unresearched topic. There is
  // nothing to open, so it must not answer a click as though there were.
  it('gives no empty shell a key to be opened by', () => {
    openL2();
    expect(region().querySelectorAll('.widget-detail__card[data-module]')).toHaveLength(3);
    expect(region().querySelectorAll('.module__expand')).toHaveLength(3);
  });

  it('names the card its control acts on, and says which state it is in', () => {
    openL2();
    const control = cardFor('cost').querySelector('.module__expand');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(control.getAttribute('aria-label')).toBe('Expand Context');
    openL3('cost');
    const open = cardFor('cost').querySelector('.module__expand');
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(open.getAttribute('aria-label')).toBe('Collapse Context');
  });

  // A card whose content leads with its own prose has no label to be named by,
  // so the control falls back to the card's place in the reading order — "Expand"
  // alone would not say which of six is about to open.
  it('falls back to a card\u2019s place when it has no label of its own', () => {
    openL2();
    const control = cardFor('context').querySelector('.module__expand');
    expect(control.getAttribute('aria-label')).toBe('Expand card 2');
  });

  it('carries the in-depth block, standing empty until its content is written', () => {
    openL2();
    expect(region().querySelector('.module__in-depth')).toBeNull();
    openL3('context');
    const block = cardFor('context').querySelector('.module__in-depth');
    expect(block).not.toBeNull();
    expect(block.querySelector('.module__in-depth-empty').textContent).toContain(
      'not been published',
    );
  });

  // The return is a movement, and the thing that makes it one is that the six
  // stay out of their columns — positioned, and transitioning — until they have
  // arrived. The first version of this rewrote the region's class list on the
  // way out, which took that state with it: the boxes were handed straight back
  // to the columns in the same tick and the flight never happened at all. Every
  // end-state assertion still passed.
  // The info point: what a card is, behind an ⓘ beside its title. Most of the
  // copy is not written yet, so what is tested here is the plumbing — that every
  // card with content offers one, that an empty shell does not, and that it is
  // wired for a screen reader rather than being a hover-only affordance.
  describe('the info point', () => {
    it('gives every card with content one, and every empty shell none', () => {
      openL2();
      expect(region().querySelectorAll('.module__info')).toHaveLength(3);
      const shells = [...region().querySelectorAll('.widget-detail__card')].filter(
        (card) => !card.dataset.module,
      );
      expect(shells.every((card) => card.querySelector('.module__info') === null)).toBe(true);
    });

    it('names the card it explains, and points at the text that explains it', () => {
      openL2();
      const control = cardFor('cost').querySelector('.module__info');
      expect(control.getAttribute('aria-label')).toBe('About Context');
      const hint = cardFor('cost').querySelector('.module__info .link-hint');
      expect(control.getAttribute('aria-describedby')).toBe(hint.id);
      expect(hint.getAttribute('role')).toBe('tooltip');
    });

    // Until the copy exists a card says so, rather than showing the raw key —
    // which is what t() answers a missing string with.
    it('says the explanation is unwritten rather than showing its key', () => {
      openL2();
      // A key with nothing behind it, unlike the cards whose copy is written.
      const hint = cardFor('departments').querySelector('.module__info .link-hint');
      expect(hint.textContent).toContain('has not been written yet');
      expect(hint.textContent).not.toContain('adoption.info');
    });

    // It sits inside a card that answers a click by opening. Reaching for the
    // explanation must not be the same gesture as opening the card.
    it('does not open the card it sits on', () => {
      const onSelectModule = vi.fn();
      stack.destroy();
      stack = render(container, { ...props, onSelectModule });
      openL2({ onSelectModule });
      cardFor('cost').querySelector('.module__info').click();
      expect(onSelectModule).not.toHaveBeenCalled();
    });
  });

  describe('flying back to the arrangement', () => {
    beforeEach(() => {
      document.documentElement.style.setProperty('--module-focus-duration', '520ms');
    });
    afterEach(() => {
      document.documentElement.style.removeProperty('--module-focus-duration');
    });

    it('hands them back without replaying the entrance they never left on', () => {
      document.documentElement.style.removeProperty('--module-focus-duration');
      openL2();
      openL3('context');
      openL2();
      // The entrance is switched off while they are pinned, so re-applying it
      // would start it from its first frame — opacity 0, held through the
      // stagger — and the six would blink out and fade back in having just
      // arrived. .is-settled starts it at its last frame instead.
      expect(region().classList.contains('is-pinned')).toBe(false);
      expect(region().classList.contains('is-settled')).toBe(true);
    });

    // The flag says "already flown out once", so it must not outlive the region
    // it was set on: a criterion opened afresh has an entrance to play.
    it('leaves a criterion opened afresh with its entrance intact', () => {
      document.documentElement.style.removeProperty('--module-focus-duration');
      openL2();
      openL3('context');
      openL2();
      stack.update({ ...props });
      openL2();
      expect(region().classList.contains('is-settled')).toBe(false);
    });

    it('holds them out of their columns until they have arrived', () => {
      openL2();
      openL3('context');
      openL2();
      expect(region().classList.contains('is-pinned')).toBe(true);
      // Written back to the boxes they were measured from — which is the flight,
      // since they are still standing in the focus arrangement when it is set.
      expect(
        [...region().querySelectorAll('.widget-detail__module')].map((m) => m.style.top),
      ).toEqual([0, 130, 260, 390, 520].map((y) => `${y}px`));
      expect(region().querySelector('.widget-detail__module').style.left).toBe('0px');
      expect(moduleAt(4).style.left).toBe('40px');
      // No card is left scaled down on the way home.
      expect(moduleAt(4).style.transform).toBe('none');
    });
  });

  describe('what a click inside the region means', () => {
    let onSelectModule;
    beforeEach(() => {
      onSelectModule = vi.fn();
      stack.destroy();
      stack = render(container, { ...props, onSelectModule });
    });

    it('opens the card a click lands on', () => {
      openL2({ onSelectModule });
      cardFor('cost').click();
      expect(onSelectModule).toHaveBeenCalledWith('cost');
    });

    it('closes the open card from its own control, and only from there', () => {
      stack.update({
        ...props,
        onSelectModule,
        activeCriterion: 'adoption',
        adoptionModules: cards,
      });
      stack.update({
        ...props,
        onSelectModule,
        activeCriterion: 'adoption',
        adoptionModules: cards,
        activeModule: 'cost',
      });
      // Clicking into the card that is already open is someone reading it.
      cardFor('cost').click();
      expect(onSelectModule).not.toHaveBeenCalled();
      cardFor('cost').querySelector('.module__expand').click();
      expect(onSelectModule).toHaveBeenCalledWith(null);
    });

    it('leaves a link inside a card to do its own job', () => {
      openL2({ onSelectModule });
      const link = document.createElement('a');
      link.href = 'https://example.org';
      cardFor('cost').append(link);
      link.addEventListener('click', (event) => event.preventDefault());
      link.click();
      expect(onSelectModule).not.toHaveBeenCalled();
    });
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

// Adoption Requirements: the same six-card contract as Impact, filled with what
// another city needs in order to run the project rather than with figures. Each
// kind has one shape it has to come out as, and two of them are new here — a
// grid of the city's own numbers, and lists of links that have to stay links.
describe('the adoption cards', () => {
  const source = { url: 'https://example.org/dvr', label: 'DVR', accessed: '2026-08-23' };
  const adoption = [
    {
      key: 'cost',
      kind: 'cost',
      labelKey: 'adoption.cost',
      headline: { value: 2900000, year: 2023 },
      scopeKey: 'adoption.koeln.costScope',
      coversKey: 'adoption.koeln.costCovers',
      length: { value: 9, unit: 'km' },
      perKm: 322000,
      items: [
        { key: 'signals', labelKey: 'adoption.koeln.cost.signals', value: 1500000 },
        { key: 'ebertplatz', labelKey: 'adoption.koeln.cost.ebertplatz', value: null },
      ],
      rateKey: 'adoption.koeln.costRate',
      disclaimerKey: 'adoption.koeln.costNote',
      sources: [source],
    },
    {
      key: 'funding',
      kind: 'linkGroups',
      labelKey: 'adoption.funding',
      groups: [
        {
          key: 'eu',
          headingKey: 'adoption.funding.eu',
          links: [
            { key: 'life', url: 'https://example.org/life', textKey: 'adoption.funding.life' },
          ],
          plain: [],
        },
        {
          key: 'private',
          headingKey: 'adoption.funding.private',
          links: [],
          plain: ['adoption.funding.sponsorship'],
        },
      ],
    },
    {
      key: 'context',
      kind: 'facts',
      labelKey: 'adoption.context',
      facts: [
        { key: 'population', value: 1028273, unit: 'people', year: 2025 },
        { key: 'density', value: 2539, unit: 'per km²' },
      ],
      sources: [source, { ...source, url: 'https://example.org/area', label: 'Area' }],
    },
    {
      key: 'politics',
      kind: 'policy',
      labelKey: 'adoption.politics',
      infoKey: 'adoption.info.politics',
      authorities: [{ key: 'a', textKey: 'adoption.politics', url: 'https://example.org/amt' }],
      alliance: { key: 'r', textKey: 'adoption.politics' },
      members: [{ key: 'm', textKey: 'adoption.politics' }],
      recommendations: ['movement', 'phased'].map((key) => ({
        key,
        titleKey: 'adoption.politics',
        claimKey: 'adoption.timeline',
        exampleKey: 'adoption.cost',
        lessonKey: 'adoption.context',
      })),
    },
    {
      key: 'timeline',
      kind: 'timeline',
      labelKey: 'adoption.timeline',
      infoKey: 'adoption.info.timeline',
      events: [
        { key: 'a', when: 'Okt. 2015', title: 'Gründung', details: 'Wie es dazu kam.' },
        { key: 'b', when: '2019', title: 'Auszeichnung', details: 'Wofür genau.' },
        {
          key: 'c',
          when: 'In Planung',
          title: 'Ebertplatz',
          details: 'Was noch aussteht.',
          planned: true,
        },
      ],
      phases: [{ phase: 'history', labelKey: 'adoption.timeline.phase.history', from: 0 }],
    },
  ];

  const open = () =>
    stack.update({ ...props, activeCriterion: 'adoption', adoptionModules: adoption });
  const card = (index) => region().querySelectorAll('.widget-detail__card')[index];

  it('gives each adoption card the shape its kind calls for', () => {
    open();
    expect(card(2).querySelectorAll('.module__fact')).toHaveLength(2);
    expect(card(1).querySelectorAll('.module__link-group')).toHaveLength(2);
  });

  // The timeline is one card read two ways. In a column it is dots and nothing
  // else — the shape of the whole story — and the hover names the event. Opened,
  // the names are written beside the dots and the hover brings the account
  // instead: at each size, what is written is what there is room to read.
  it('shows the timeline as dots alone, and names them once opened', () => {
    open();
    const events = card(4).querySelectorAll('.timeline__event');
    expect(events).toHaveLength(3);
    expect(card(4).querySelectorAll('.timeline__label')).toHaveLength(0);
    // The text a hover shows rides in the event's <desc>, which is what the hint
    // layer draws and what a screen reader takes as the description.
    expect(events[0].querySelector('.link-hint').textContent).toBe('Gründung');
    // The undated entry is still ahead, and reads that way.
    expect(events[2].getAttribute('class')).toContain('timeline__event--planned');

    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: adoption,
      activeModule: 'timeline',
    });
    const opened = region().querySelector('.widget-detail__card.is-expanded');
    expect(opened.querySelectorAll('.timeline__label').length).toBeGreaterThanOrEqual(3);
    // The card's own info point carries a .link-hint too; the event's is the one.
    expect(opened.querySelector('.timeline__event .link-hint').textContent).toBe(
      'Wie es dazu kam.',
    );
    // Every event is reachable by keyboard and says what it is without a hover —
    // which the charts' own dots are not, and this is content rather than a
    // point on a line.
    const first = opened.querySelector('.timeline__event');
    expect(first.getAttribute('aria-label')).toBe('Okt. 2015: Gründung');
    expect(first.getAttribute('tabindex')).toBe('0');
  });

  // The Politik card's recommendations are a toggle list. In a column they are
  // named and nothing more; opened, each name carries its sentence and a
  // disclosure holding what the city did and what to take from it.
  // The card's three sections are three boxes — the same surface the Kontext
  // card's tiles sit on, one to a category rather than one to an entry, so a
  // name inside is a line and not a box within a box. The alliance stands above
  // its members: it is not one more organisation, it is the ones under it taken
  // together.
  it('boxes each section, with the names as lines inside', () => {
    open();
    expect(card(3).querySelectorAll('.module__panel')).toHaveLength(3);
    expect(card(3).querySelectorAll('.module__fact')).toHaveLength(0);
    expect(card(3).querySelectorAll('.module__policy-lead')).toHaveLength(1);
    const names = card(3).querySelectorAll('.module__policy-list .module__link-item');
    expect(names).toHaveLength(2);
    // A name with a page worth opening is the link; the rest are named without.
    expect(names[0].querySelector('.module__link')).not.toBeNull();
  });

  it('names the recommendations in a column and opens them in the slot', () => {
    open();
    expect(card(3).querySelectorAll('.module__toggle-title')).toHaveLength(2);
    expect(card(3).querySelectorAll('details')).toHaveLength(0);
    expect(card(3).querySelectorAll('.module__toggle-lead')).toHaveLength(0);

    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: adoption,
      activeModule: 'politics',
    });
    const opened = region().querySelector('.widget-detail__card.is-expanded');
    expect(opened.querySelectorAll('details')).toHaveLength(2);
    expect(opened.querySelectorAll('.module__toggle-lead')).toHaveLength(2);
    expect(opened.querySelector('details').hasAttribute('open')).toBe(false);
  });

  // One at a time. Five recommendations of two paragraphs each on the tallest
  // card in the criterion: left free, opening a third pushed the arrangement
  // past the region and the reader lost the one they had come for.
  it('closes the open recommendation when another is opened', () => {
    open();
    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: adoption,
      activeModule: 'politics',
    });
    const [first, second] = region().querySelectorAll('.widget-detail__card.is-expanded details');
    first.open = true;
    first.dispatchEvent(new Event('toggle'));
    expect(first.open).toBe(true);

    second.open = true;
    second.dispatchEvent(new Event('toggle'));
    expect(second.open).toBe(true);
    expect(first.open).toBe(false);
  });

  // The one card with no closing block: its recommendations already are what one
  // would hold, so a "Sources" heading under them would promise a document none
  // of it comes from.
  it('gives the politics card no in-depth block, even opened', () => {
    open();
    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: adoption,
      activeModule: 'politics',
    });
    const opened = region().querySelector('.widget-detail__card.is-expanded');
    expect(opened.querySelector('.module__in-depth')).toBeNull();
  });

  // The card is the published sum, what it bought, and the rate under it. What
  // the sum covered and the costs never published separately are the info
  // point's and the Quellen block's account now, not a list on the card.
  it('states the published sum and nothing it did not publish', () => {
    open();
    expect(card(0).querySelector('.module__value b').textContent).toContain('2.9M');
    expect(card(0).querySelectorAll('.module__cost-item')).toHaveLength(0);
  });

  // The rate is arithmetic over the card's own two figures, so it is filled in
  // at render — a translator should never be the one holding a number.
  it('fills the derived rate into the cost disclaimer', () => {
    open();
    expect(card(0).querySelector('.module__note').textContent).toContain('322,000');
  });

  // A card built from several rows carries a chip per row: one document, one
  // chip, and the derived figure adds none of its own.
  it('chips every row the context card was built from', () => {
    open();
    expect(card(2).querySelectorAll('.source-chip')).toHaveLength(2);
  });

  // The whole point of these cards is that they lead somewhere: a link that
  // rendered as text is a dead end wearing the right clothes.
  it('keeps every link an outbound link', () => {
    open();
    // The politics card's names, and the arrow beside a funding route.
    const links = [...region().querySelectorAll('.module__link, .module__programme-link')];
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute('rel') === 'noopener noreferrer')).toBe(true);
    expect(links.map((link) => link.getAttribute('href'))).toContain('https://example.org/life');
  });

  // A funding route opens into its terms where they have been written down, and
  // is its name alone where they have not. Which of the two it is comes from the
  // bundle rather than from a flag: a route gains its disclosure the moment its
  // Details / Förderquote / Zugang are added.
  it('opens a funding route into its terms, or names it and nothing more', () => {
    open();
    // LIFE has its terms; the private-partner routes do not.
    const routes = card(1).querySelectorAll('details.module__toggle');
    expect(routes).toHaveLength(1);
    expect(routes[0].querySelectorAll('.module__toggle-field')).toHaveLength(3);
    // The page sits beside the name as an arrow, in the summary rather than on
    // the name or down among the paragraphs: the name opens the terms, the arrow
    // opens the page, and neither does the other's job.
    expect(routes[0].querySelector('summary .module__programme-link')).not.toBeNull();
    expect(routes[0].querySelector('summary .module__toggle-title a')).toBeNull();
  });

  // Following the arrow must not also open the terms it sits beside.
  it('does not toggle the terms when the programme page is followed', () => {
    open();
    stack.update({
      ...props,
      activeCriterion: 'adoption',
      adoptionModules: adoption,
      activeModule: 'funding',
    });
    const route = region().querySelector('.widget-detail__card.is-expanded details.module__toggle');
    const link = route.querySelector('summary .module__programme-link');
    link.addEventListener('click', (event) => event.preventDefault());
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(route.open).toBe(false);
  });

  // "Sponsorship" is a route, not a programme with a page — so it is named
  // rather than given a link that points at nothing in particular.
  it('names a funding route that has nowhere to point without linking it', () => {
    open();
    const [, privateGroup] = card(1).querySelectorAll('.module__link-group');
    expect(privateGroup.querySelectorAll('.module__link-item')).toHaveLength(1);
    expect(privateGroup.querySelector('.module__link')).toBeNull();
  });

  // The L1 widget stands on the cost card: the sum and what it bought, without
  // the itemised lines or the disclaimer that belong to the reading below it.
  it('stands the adoption widget on its cost card', () => {
    stack.update({ ...props, adoptionModules: adoption });
    const widget = container.querySelector('.widget--adoption');
    expect(widget.querySelector('.widget__bar--empty')).toBeNull();
    expect(widget.querySelector('.module__value b').textContent).toContain('2.9M');
    expect(widget.querySelectorAll('.module__cost-item')).toHaveLength(0);
    expect(widget.querySelector('.module__note')).toBeNull();
  });

  it('keeps the empty bar for a city with no adoption content', () => {
    stack.update({ ...props, adoptionModules: [] });
    const widget = container.querySelector('.widget--adoption');
    expect(widget.querySelector('.widget__bar--empty')).not.toBeNull();
  });
});
