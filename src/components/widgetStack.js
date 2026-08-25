// The three Exploration-layer widgets (Problem Fit, Impact, Adoption
// Requirements) shown while a city is focused (L1). Problem Fit sits top-left;
// Impact + Adoption stack top-right. Clicking one enters its L2: a data panel
// opens on that widget's side (the map cuts to the opposite half — see mapView
// and europeMap), and the widgets dim in place.
//
// The L2 does not replace the widget so much as unpack it: the modules start
// stacked on the card that was clicked and fly out to their own places, so what
// stood on the deck at L1 is what is standing in the region afterwards. See
// setFlightOrigin for the measurement that ties the two together.
//
// Clicking one of those modules enters L3: that card opens into a focus slot
// taking most of the region, and the other five step aside into a rail down the
// side the widget is on, scaled down together rather than pushed off screen. The
// region keeps its L2 share of the stage — the room comes from inside the
// arrangement, which is mostly air. See applyFocusLayout, and buildDetail for
// why the movement is measured rather than declared.
//
// render(container, { project, activeCriterion, activeModule, metrics,
// impactModules, problemFitModules, adoptionModules, problemFit, comingSoon,
// onSelectCriterion, onSelectModule }) and the component never reads the store —
// data comes down, the clicked widget goes up via
// onSelectCriterion('problemFit'|'impact'|'adoption') and the clicked module via
// onSelectModule(moduleKey|null).
//
// `metrics` is keyed by widget (`selectors.js#widgetMetricsForProject`): each
// value is `{ key, value, unit }` or null. This component decides nothing about
// *which* figure a city shows — it renders what it is handed, and an empty shell
// for null, so no fabricated number can appear for anything unsourced
// (Neutrality/Honesty — see docs/DESIGN_RATIONALE.md).
// Problem Fit carries its own content per city (selectors.js#problemFitForCity):
// the SDG 11 targets at L1, and at L2 the same narrative one block per module
// (selectors.js#problemFitModules). Impact's L2 modules are the city's sourced
// data topics (selectors.js#impactModules) — Cologne fills all six, Paris the
// three it has rows for, Lisbon and Helsinki none. Adoption's are what another
// city needs in order to run the project itself (selectors.js#adoptionModules).
//
// Neither Problem Fit nor Adoption has a headline *figure*, so at L1 both list
// what their L2 holds instead of showing a bar: for Problem Fit the SDG targets
// it addresses, for Adoption the cards that are filled. That is the honest
// stand-in — it names real content rather than inventing a number for it — and
// it is why an empty bar now means "nothing here", not "no figure here".

import { t, getLocale } from '../lib/i18n.js';
import { formatNumber } from '../lib/format.js';
import { motionMs } from '../lib/a11y.js';
import * as connector from './connector.js';
import { moduleHtml, modulePreviewHtml, mountModuleExtras, mountModule } from './detailContent.js';

const WIDGETS = ['problemFit', 'impact', 'adoption'];

// Problem Fit is anchored top-left; Impact + Adoption stack down the top-right.
// STACK_TOP clears the corner controls; STACK_STEP is the rhythm between the two
// right-hand widgets; STACK_MARGIN insets each column from its edge.
const STACK_TOP = 72;
const STACK_MARGIN = 16;
// The rhythm between the two right-hand widgets, and the clear space kept below
// the first of them. STACK_STEP is where Adoption starts before anything has
// been measured; once Impact has been laid out, Adoption follows its actual
// height instead — Impact now stands on a card whose content decides how tall it
// is, and a step written down here would either overlap it or leave a hole
// (see restackRightColumn).
const STACK_STEP = 140;
const STACK_GAP = 16;
const WIDGET_WIDTH = '320px';
// Problem Fit carries the SDG explanations as prose, so rather than a fixed width
// it sizes to its content (fit-content) clamped between a min and max: a short
// entry hugs its text, a long one caps at the max and wraps taller. The value
// widgets (Impact/Adoption) keep the fixed width and ignore the min/max.
const PROBLEM_FIT_WIDTH = 'fit-content';
const PROBLEM_FIT_MIN_WIDTH = '260px';
const PROBLEM_FIT_MAX_WIDTH = '380px';
const WIDGET_PADDING = '16px 18px';
// At L2 the widgets left standing on the map's side are context, not content:
// already inert and dimmed, they also step down in size so the modules have the
// attention. Scaled rather than re-sized, so the whole card shrinks together
// instead of its text reflowing into a different shape.
const L2_BYSTANDER_SCALE = '0.78';

// Which widgets stand on a deck of cards at L1 (see .widget--deck): the ones
// whose L2 the deck is a preview of. All three open into six modules, so all
// three carry one — a widget that looked like a plain card while its neighbour
// looked like a deck was saying the two behaved differently, and they do not.
const DECK_WIDGETS = new Set(['problemFit', 'impact', 'adoption']);

const BASE_LAYOUT = {
  problemFit: {
    top: `${STACK_TOP}px`,
    left: `${STACK_MARGIN}px`,
    width: PROBLEM_FIT_WIDTH,
    minWidth: PROBLEM_FIT_MIN_WIDTH,
    maxWidth: PROBLEM_FIT_MAX_WIDTH,
    padding: WIDGET_PADDING,
    opacity: '1',
    z: '10',
  },
  impact: {
    top: `${STACK_TOP}px`,
    right: `${STACK_MARGIN}px`,
    width: WIDGET_WIDTH,
    padding: WIDGET_PADDING,
    opacity: '1',
    z: '10',
  },
  adoption: {
    top: `${STACK_TOP + STACK_STEP}px`,
    right: `${STACK_MARGIN}px`,
    width: WIDGET_WIDTH,
    padding: WIDGET_PADDING,
    opacity: '1',
    z: '10',
  },
};

/** Which side of the screen a widget — and its L2 data panel — sits on. */
export function widgetSide(criterion) {
  return 'left' in BASE_LAYOUT[criterion] ? 'left' : 'right';
}

/** At L2 the clicked widget hands off to its modules. All positions hold; only
 * opacity changes.
 *
 * The modules stand on the canvas with no panel behind them, so a widget on the
 * side they occupy would show through the gaps between them — it steps out of
 * the way entirely. The widgets on the map's side have nothing over them and
 * dim in place, as before. */
function widgetLayout(activeCriterion) {
  const layout = Object.fromEntries(WIDGETS.map((key) => [key, { ...BASE_LAYOUT[key] }]));
  if (!activeCriterion) return layout;

  const detailSide = widgetSide(activeCriterion);
  for (const key of WIDGETS) {
    const covered = widgetSide(key) === detailSide;
    layout[key].opacity = covered ? '0' : '0.35';
    layout[key].scale = covered ? '1' : L2_BYSTANDER_SCALE;
  }
  return layout;
}

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'widget-stack';
  root.hidden = true;

  const widgets = WIDGETS.map((key) => buildWidget(key, props.onSelectCriterion));
  // The region needs the widget it was opened from, not just which one it was:
  // the modules fly out of that card, so its position and width are the start
  // of the entrance (see setFlightOrigin).
  const detail = buildDetail(
    (kind) => widgets.find((widget) => widget.kind === kind)?.node ?? null,
    props.onSelectModule ?? (() => {}),
  );
  root.append(...widgets.map((w) => w.node), detail.node);
  container.append(root);

  function update(next) {
    if (!next.project) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const active = next.activeCriterion ?? null;
    const layout = widgetLayout(active);
    // Inert when a panel is open (widgets are decorative) or when the coming-soon
    // overlay covers them — either way not click or focus targets.
    const inert = Boolean(active) || Boolean(next.comingSoon);
    for (const widget of widgets) {
      applyWidget(
        widget,
        layout[widget.kind],
        widgetContent(
          widget.kind,
          next.metrics[widget.kind],
          next.problemFit ?? null,
          modulesFor(widget.kind, next),
        ),
      );
      widget.node.tabIndex = inert ? -1 : 0;
      widget.node.style.pointerEvents = inert ? 'none' : 'auto';
      widget.node.setAttribute('aria-hidden', String(inert));
    }
    restackRightColumn(widgets);
    detail.sync(active, modulesFor(active, next), next.activeModule ?? null);
  }

  update(props);

  return {
    update,
    destroy() {
      detail.destroy();
      root.remove();
    },
  };
}

/** Put Adoption below Impact, by however tall Impact has turned out.
 *
 * Impact stands on its cycle-network card, so its height is that card's content
 * — three legend rows for a city that has them, an empty shell for one that does
 * not. Measured rather than declared, for the same reason every other distance
 * in this file is: what it depends on is a fact about the running page. Nothing
 * laid out yet (jsdom, or the stack still hidden) leaves the fallback step in
 * place, which is what the stylesheet already put there. */
function restackRightColumn(widgets) {
  const impact = widgets.find((widget) => widget.kind === 'impact')?.node;
  const adoption = widgets.find((widget) => widget.kind === 'adoption')?.node;
  if (!impact || !adoption || impact.offsetHeight === 0) return;
  adoption.style.top = `${STACK_TOP + impact.offsetHeight + STACK_GAP}px`;
}

function buildWidget(kind, onSelectCriterion) {
  const node = document.createElement('div');
  // The deck leans the way its side does. A right-hand widget sits
  // STACK_MARGIN from the edge of the screen, which is narrower than the deck
  // is deep, so a deck fanning right would hang off the edge; it also wants to
  // point the way the modules will travel, like --fan-x in the L2 arrangement.
  const deck = DECK_WIDGETS.has(kind) ? ` widget--deck widget--deck-${widgetSide(kind)}` : '';
  node.className = `widget widget--${kind}${deck}`;
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.addEventListener('click', () => onSelectCriterion(kind));
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectCriterion(kind);
    }
  });
  return { node, kind };
}

/** The L2 region: one reused element, shown on the active widget's side while
 * the map cuts to the other half. It carries no back control of its own — the
 * screen's Back button (and Escape) already step back one layer from anywhere,
 * and a second one inside the region was a duplicate of that.
 *
 * It is also where L3 happens: one module opens into a focus slot and the other
 * five stand aside in a rail (see applyFocusLayout). That movement is measured
 * rather than declared, for the same reason the L1→L2 flight is — where a card
 * has to travel to depends on where the six of them happen to be standing, which
 * is a fact about the running page and not something a stylesheet knows. */
function buildDetail(sourceNodeFor, onSelectModule) {
  const node = document.createElement('section');
  node.className = 'widget-detail';
  node.hidden = true;
  node.setAttribute('aria-live', 'polite');
  node.addEventListener('click', (event) => {
    const target = clickTarget(event, focusedKey);
    if (target !== undefined) onSelectModule(target);
  });

  let leaveTimer = null;
  let focusTimer = null;
  let openCriterion = null;
  // The module standing in the focus slot (its `key`), and the payload list it
  // was picked out of — a re-render of one card needs the module behind it.
  let focusedKey = null;
  let shownModules = [];
  let arrows = null;
  let contents = [];
  // The six resting boxes, measured the moment before the first of them moves,
  // and the area they stand in. Null whenever no module is pinned: the boxes are
  // only true while the arrangement they were read off is untouched.
  let resting = null;

  /** Empty the region: nothing left in the DOM, no pending timer, and every
   * chart and chip the modules mounted destroyed rather than orphaned — the
   * region is rebuilt from innerHTML, so anything not torn down here leaks its
   * listeners and its tooltip node. */
  function teardown() {
    clearTimeout(leaveTimer);
    clearTimeout(focusTimer);
    leaveTimer = null;
    focusTimer = null;
    arrows?.destroy();
    arrows = null;
    for (const child of contents) child.handle.destroy();
    contents = [];
    resting = null;
    shownModules = [];
    node.classList.remove('is-leaving');
    node.hidden = true;
    node.replaceChildren();
  }

  /** L2→L1: the modules fade back the way they came in, then the region clears.
   * Held on a timer read from the token rather than driven by animationend, so
   * a dropped frame can never strand the region open — and so reduced motion
   * (0ms) clears it in this same tick. */
  function leave() {
    if (node.hidden) return;
    node.classList.add('is-leaving');
    const hold = motionMs('--module-leave-duration');
    if (hold === 0) teardown();
    else leaveTimer = setTimeout(teardown, hold);
  }

  function sync(activeCriterion, modules, activeModule) {
    if (!activeCriterion) {
      openCriterion = null;
      focusedKey = null;
      return leave();
    }
    const nextFocus = focusableKey(modules, activeModule ?? null);
    // Opening or closing the focus slot is a move *within* the region: the six
    // modules are already standing, and rebuilding them would throw away the
    // boxes the movement has to be measured from. Only the card that changes
    // reading is re-rendered (changeFocus).
    const settled = activeCriterion === openCriterion;
    if (settled && !node.hidden && nextFocus !== focusedKey) return changeFocus(nextFocus);
    // Re-syncing a region that is already open (a locale switch, new data) must
    // not replay the entrance: these modules have already flown out once.
    openCriterion = activeCriterion;
    teardown();
    shownModules = modules;
    focusedKey = nextFocus;
    node.className = detailClass(activeCriterion, settled, nextFocus);
    node.setAttribute('aria-label', t(`criteria.${activeCriterion}`));
    node.innerHTML = detailHeader(activeCriterion) + moduleScaffold(modules, activeCriterion);
    node.hidden = false;
    mountModuleExtras(node, modules, contents);
    setFlightOrigin(node, sourceNodeFor(activeCriterion));
    arrows = mountArrows(node, activeCriterion);
    // Rebuilt while a module was open: it goes straight back to the focus slot
    // rather than flying there a second time. The scaffold above is built small
    // either way, so the boxes measured here are the arrangement's own — a card
    // rendered large first would grow inside its column and hand the layout a
    // resting place it never actually had, which is the one it returns to.
    if (focusedKey) {
      resting = measureArrangement(node);
      renderCard(focusedKey, true);
      applyFocusLayout(false);
    }
    return undefined;
  }

  /** L2↔L3: swap which card is read large, then move the six to match.
   *
   * Both readings of a card are the same module rendered twice, so the swap is
   * two re-renders and nothing else — no chart survives being resized, and one
   * that was mounted compact has to be built again to draw its axes. */
  function changeFocus(nextKey) {
    // Measure before anything changes shape. Opening a card grows it where it
    // stands, so a measurement taken afterwards describes a layout that was
    // never on screen — and it is the one the five would fly back to.
    if (nextKey && !resting) resting = measureArrangement(node);
    const previous = focusedKey;
    focusedKey = nextKey;
    if (previous) renderCard(previous, false);
    if (nextKey) renderCard(nextKey, true);
    // Toggled, never rewritten. Rewriting the class list would take .is-pinned
    // with it, and that class is what holds the six out of their columns and
    // carries the transition — dropped here, they would arrive back in the
    // arrangement in the same tick instead of travelling to it.
    node.classList.toggle('has-focus', Boolean(nextKey));
    if (nextKey) applyFocusLayout(true);
    else releaseFocusLayout();
    return undefined;
  }

  /** Re-render one card at the size it is about to be read at, destroying only
   * that card's own mounted pieces — the other five are untouched, which is what
   * keeps the movement smooth and their charts from being rebuilt for nothing. */
  function renderCard(key, expanded) {
    const index = indexOfKey(shownModules, key);
    const card = node.querySelector(`.widget-detail__card[data-module="${key}"]`);
    if (index === -1 || !card) return;
    for (const child of contents.filter((entry) => entry.index === index)) child.handle.destroy();
    contents = contents.filter((entry) => entry.index !== index);
    card.innerHTML = moduleHtml(shownModules[index], index, expanded);
    card.classList.toggle('is-expanded', expanded);
    mountModule(node, shownModules[index], index, contents, expanded);
  }

  /** The focus arrangement: the opened module in the slot, the other five in the
   * rail beside it. `animate` is false when the region has just been rebuilt
   * under an already-open module — there is no movement to show, only a state to
   * restore.
   *
   * Pinning first is what makes this a movement rather than a jump: every module
   * is written back to the box it is already standing in, so the layout it flies
   * from is the one the user is looking at. */
  function applyFocusLayout(animate) {
    if (!resting) resting = measureArrangement(node);
    if (!resting) return;
    const modules = moduleNodes(node);
    if (!resting.pinned) pinModules(node, modules, resting, animate);
    const places = focusPlaces(resting, indexOfKey(shownModules, focusedKey), detailSide(node));
    if (!places) return;
    clearTimeout(focusTimer);
    modules.forEach((module, index) => placeModule(module, places[index]));
    node.style.setProperty('--modules-height', `${round(places.height)}px`);
  }

  /** L3→L2: the six travel back to the boxes they were pinned from, and once
   * they are there the inline geometry comes off, which is what hands them back
   * to the columns — and to the idle drift the pinning suspended.
   *
   * All six on one clock, with nothing staggered. The five in the rail are one
   * column, not five separate cards: dealing them back a beat apart made one
   * thing read as five things happening, and the card coming out of the slot
   * had already finished by the time the last of them set off. So the slot
   * shrinks while the column travels, and the movement is over at once.
   *
   * Held on the token's own clock rather than driven by transitionend — a
   * dropped frame can never strand the six out of their columns — and so
   * reduced motion (0ms) releases them in this same tick. */
  function releaseFocusLayout() {
    if (!resting?.pinned) return;
    const modules = moduleNodes(node);
    modules.forEach((module, index) => placeModule(module, resting.boxes[index]));
    const hold = motionMs('--module-focus-duration');
    const unpin = () => {
      for (const module of modules) module.removeAttribute('style');
      node.style.removeProperty('--modules-height');
      // Settled before unpinned, and the order matters. While the six are
      // pinned their entrance is switched off outright (`animation: none`);
      // handing them back to the columns re-applies it, and an animation that
      // was not running starts from its first frame — which is opacity 0, held
      // through a stagger of up to half a second. The six would blink out and
      // fade back in one at a time, having just arrived. .is-settled is the flag
      // that already means "these have flown out once": it starts the entrance
      // at its last frame instead. Cleared by the next real open, which
      // recomputes the class list from scratch (detailClass).
      node.classList.add('is-settled');
      node.classList.remove('is-pinned');
      resting = null;
    };
    clearTimeout(focusTimer);
    if (hold === 0) unpin();
    else focusTimer = setTimeout(unpin, hold);
  }

  return { node, sync, destroy: teardown };
}

/** What a click inside the region means, as the module key to open — null to
 * close the one that is open, and undefined for a click that means nothing here.
 *
 * A card answers a click on its own background, which is the mouse affordance;
 * a link or a control inside it is doing its own job and is left alone. Closing
 * is the button's alone: a reader half way down an opened card should not lose
 * it by clicking to place the cursor. */
function clickTarget(event, focusedKey) {
  const card = event.target.closest('.widget-detail__card[data-module]');
  if (!card) return undefined;
  const key = card.dataset.module;
  if (event.target.closest('[data-expand]')) return key === focusedKey ? null : key;
  if (event.target.closest('a, button')) return undefined;
  return key === focusedKey ? undefined : key;
}

/** The key of the module to open, or null. Guarded rather than trusted: a key
 * belongs to one city's list of six, and the layer above it can hold one while
 * the city underneath changes to a list that has no such card. */
function focusableKey(modules, activeModule) {
  if (!activeModule) return null;
  return modules.some((module) => module?.kind && module.key === activeModule)
    ? activeModule
    : null;
}

function indexOfKey(modules, key) {
  return key ? modules.findIndex((module) => module?.key === key) : -1;
}

function moduleNodes(node) {
  return [...node.querySelectorAll('.widget-detail__module')];
}

/** Which side of the stage this region opened on, read off its own class rather
 * than passed down — the rail stands on the side the modules came from, and that
 * is the one fact the arrangement needs about the screen around it. */
function detailSide(node) {
  return node.classList.contains('widget-detail--right') ? 'right' : 'left';
}

/** The arrangement as it stands: every module's resting box, and the area they
 * occupy. Measured in offsets, all of them against the region's padding edge
 * (see moduleRect) — the same box the arrows are drawn in, and immune to the
 * transforms the flight and the idle drift are riding on.
 *
 * Null when nothing is laid out (jsdom, or a region still hidden): with no boxes
 * to move between there is no movement to make, and the modules stay in the
 * columns the stylesheet put them in. */
function measureArrangement(node) {
  const area = node.querySelector('.widget-detail__modules');
  if (!area || area.offsetWidth === 0) return null;
  const boxes = moduleNodes(node).map(moduleRect);
  if (boxes.length === 0 || boxes.some((box) => box.width === 0)) return null;
  return {
    boxes,
    area: {
      x: area.offsetLeft,
      y: area.offsetTop,
      width: area.offsetWidth,
      height: area.offsetHeight,
    },
    pinned: false,
  };
}

/** Take the six out of the columns and stand them exactly where they already
 * are. The columns collapse the moment their contents go absolute, so the space
 * they held is written down as --modules-height and given back to the region —
 * otherwise everything below the arrangement would jump up as it opens. */
function pinModules(node, modules, arrangement, animate) {
  node.classList.add('is-pinning');
  modules.forEach((module, index) => placeModule(module, arrangement.boxes[index]));
  node.style.setProperty('--modules-height', `${round(arrangement.area.height)}px`);
  // Separate from .has-focus on purpose: .has-focus says a card is open, this
  // says the six are out of their columns. The return flight happens after the
  // first is gone and before the second is, and it needs the transitions.
  node.classList.add('is-pinned');
  // Read a layout back before the movement is allowed to start: without it the
  // pinned boxes and the ones below are the same style recalculation, and the
  // browser transitions from wherever the module was in the columns instead.
  if (animate) void node.offsetWidth;
  node.classList.remove('is-pinning');
  arrangement.pinned = true;
}

/** One module's box, written as the four numbers the transition runs on. Scale
 * rather than a narrower width for the rail: a card re-flowed to 176px is a
 * different card — its lines rewrap, its chart redraws — where a scaled one is
 * the same card, smaller, which is what stepping aside should look like. */
function placeModule(module, box) {
  Object.assign(module.style, {
    left: `${round(box.x)}px`,
    top: `${round(box.y)}px`,
    width: `${round(box.width)}px`,
    height: `${round(box.height)}px`,
    transform: box.scale ? `scale(${box.scale})` : 'none',
  });
}

/** Where the six stand at L3: one in the slot, five in the rail.
 *
 * The rail takes the side the modules flew out of, so the opened card sits
 * towards the map rather than against the edge of the screen, and the five that
 * stepped aside are still on the side their widget is. They shrink by one scale,
 * not five — a rail whose cards were each sized to their own content would read
 * as five unrelated things rather than as the set the opened one came out of.
 *
 * The scale is whatever makes them fit both ways, floored: below the floor the
 * rail runs past the bottom instead, and the region scrolls, because a card too
 * small to read is not a card that still belongs to the arrangement. */
function focusPlaces(arrangement, focusIndex, side) {
  if (focusIndex === -1) return null;
  const { boxes, area } = arrangement;
  const railGap = pxToken('--module-rail-gap');
  const focusGap = pxToken('--module-focus-gap');
  const rail = boxes.filter((_, index) => index !== focusIndex);
  const scale = railScale(rail, area.height - railGap * (rail.length - 1));
  // What the rail actually takes, which is not always what it was asked for: a
  // card held at the scale floor stays wider than the nominal width. Measured
  // rather than assumed, so the slot beside it gets the room that is really left.
  const railWidth = Math.max(...rail.map((box) => box.width * scale));

  let y = area.y;
  const places = boxes.map((box, index) => {
    if (index === focusIndex) return null;
    // Aligned to the arrangement's outer edge by the width each card ends up
    // with rather than by the rail's — they differ at the floor, and a card
    // placed on the rail's would hang over the edge of the screen by exactly
    // that difference.
    const x = side === 'right' ? area.x + area.width - box.width * scale : area.x;
    const place = { x, y, width: box.width, height: box.height, scale };
    y += box.height * scale + railGap;
    return place;
  });

  // The slot is as tall as the rail beside it, so the two read as one
  // arrangement rather than as a card with a list running on past it. What is
  // inside the card still takes only the height it needs (.is-expanded).
  const height = Math.max(area.height, y - railGap - area.y);
  places[focusIndex] = {
    x: side === 'right' ? area.x : area.x + railWidth + focusGap,
    y: area.y,
    width: Math.max(area.width - railWidth - focusGap, railWidth),
    height,
  };
  places.height = height;
  return places;
}

/** The one scale the rail shrinks by: enough to fit the rail's width, enough to
 * stack in the height beside the opened card, and never past the floor or above
 * the size the cards already are. */
function railScale(rail, availableHeight) {
  const widest = Math.max(...rail.map((box) => box.width));
  const stacked = rail.reduce((sum, box) => sum + box.height, 0);
  const fit = Math.min(pxToken('--module-rail-width') / widest, availableHeight / stacked, 1);
  return round(Math.max(fit, pxToken('--module-rail-min-scale')), 3);
}

/** A length token, in px. Geometry lives in tokens.css like every other measure
 * in this project; this is how the layout code reads it rather than restating
 * it. Unitless tokens (the scale floor) come back as the bare number. */
function pxToken(name) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

/** The region's classes: which side it opens on, when it is being re-synced
 * rather than opened — the flag that suppresses the entrance (see .is-settled in
 * widgets.css) — and whether a module is standing in the focus slot. */
function detailClass(criterion, settled, focusedKey) {
  return [
    'widget-detail',
    `widget-detail--${widgetSide(criterion)}`,
    settled ? 'is-settled' : '',
    focusedKey ? 'has-focus' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The region's heading: the criterion's name. */
function detailHeader(criterion) {
  return `
    <header class="widget-detail__header">
      <h2 class="widget-detail__title">${t(`criteria.${criterion}`)}</h2>
    </header>`;
}

// The L2 module scaffold, in three staggered columns: three boxes down the
// first, two down the second sitting between them, and one in the third level
// with the last of the first. The columns exist only to place the boxes — they
// are never drawn. Widths and offsets live in widgets.css; the count and the
// order are here because the order is also the order they fly out in.
const MODULE_SLOTS = 6;

// Which modules the arrows join, as indices into the scaffold: both leave the
// second module of the first column, one into each of the second column's two.
// Pairs rather than a from/to list, so an arrow that points somewhere else later
// is a change here and nowhere else.
const MODULE_ARROWS = [
  [1, 3],
  [1, 4],
];

// Impact's six cards are six separate measurements — a modal split and a count
// of cyclists are not two ends of a line — so an arrow between any two of them
// claims a relationship the data does not have. The other criteria's cards do
// follow on from one another, and keep theirs.
const ARROWLESS = new Set(['impact']);

/** Which module payloads a criterion opens into. Impact unpacks into the city's
 * six data topics, Problem Fit into its narrative blocks, Adoption into what it
 * takes to run the project somewhere else; all three come from the data layer
 * already shaped, so this only picks the list. */
function modulesFor(activeCriterion, props) {
  if (activeCriterion === 'impact') return props.impactModules ?? [];
  if (activeCriterion === 'problemFit') return props.problemFitModules ?? [];
  if (activeCriterion === 'adoption') return props.adoptionModules ?? [];
  return [];
}

/** How the six modules divide into the three columns, in the order they are
 * read: three down the first, two down the second, one in the third. The
 * columns are elements rather than grid tracks because each module is now as
 * tall as its own content, and a grid row would force the modules sharing it to
 * one height (see .widget-detail__modules). Slot numbers stay 1..6 across the
 * whole arrangement — they carry the entrance order and the nudges. */
const MODULE_COLUMNS = [3, 2, 1];

/** Impact stands its six in two columns of three instead. The 3/2/1 stagger
 * leaves the sixth card alone in a column of its own, which reads as a leftover
 * rather than as the last of a set — and with two columns there is room for the
 * cards to be wider, which the charts in this criterion are the ones that want.
 * Only Impact: the other two have not been looked at yet, and an arrangement
 * changed underneath them would be a change nobody asked for. */
const CRITERION_COLUMNS = { impact: [3, 3] };

function columnsFor(criterion) {
  return CRITERION_COLUMNS[criterion] ?? MODULE_COLUMNS;
}

/** The six modules. A module with content gets it; one without stays an empty
 * shell, which is the honest stand-in for a topic this city has no sourced
 * rows for — never a box of invented figures. */
function moduleScaffold(modules = [], criterion = null) {
  let slot = 0;
  const layout = columnsFor(criterion);
  const columns = layout
    .map((count, column) => {
      const boxes = Array.from({ length: Math.min(count, MODULE_SLOTS - slot) }, () => {
        const index = slot;
        slot += 1;
        return `<div class="widget-detail__module widget-detail__module--${index + 1}">
         ${cardHtml(modules[index], index)}
       </div>`;
      }).join('');
      return `<div class="widget-detail__column widget-detail__column--${column + 1}">${boxes}</div>`;
    })
    .join('');
  // The count is on the element because it decides how wide a column may be:
  // two columns have room to be wider than three, and the surplus goes back to
  // the canvas rather than into the cards (see .widget-detail__modules--2).
  return `<div class="widget-detail__modules widget-detail__modules--${layout.length}">${columns}</div>`;
}

/** One card, always at its small reading — a card that opens is re-rendered
 * large afterwards (buildDetail#renderCard), which is what keeps the boxes this
 * scaffold measures out to the ones the arrangement actually rests in.
 *
 * A card with content names itself with `data-module`: that is both what a click
 * is resolved against (clickTarget) and how the one card that opens is found
 * again later. An empty shell carries no key, because there is nothing to open
 * and it must not answer a click as though there were. */
function cardHtml(module, index) {
  if (!module?.kind) return `<div class="widget-detail__card"></div>`;
  return `<div class="widget-detail__card" data-module="${module.key}">
    ${moduleHtml(module, index)}
  </div>`;
}

/** Point every module back at the widget it comes out of.
 *
 * The entrance is one movement from one place: each module starts stacked on
 * the clicked widget, at that widget's width, and travels to its own cell while
 * shrinking to its own size. That is the difference between a deck of cards
 * being dealt out and a second screen sliding in, and it is why the distance is
 * measured here rather than written in the stylesheet — where a module starts
 * depends on where the widget it left is, which is a fact about the running
 * page.
 *
 * Three values per module, read by .widget-detail__module: the offset to the
 * widget's top-left corner, and the widget's width as a multiple of the
 * module's. Uniform scale, from the width alone — a widget is a tall card and a
 * module a wide one, so matching both axes would mean squashing the module and
 * everything that will later sit inside it.
 *
 * Mixed coordinates on purpose, and they agree: the region has no border, so
 * its border box and its padding box share an origin, and offsetLeft/offsetTop
 * are measured from that same padding edge (see moduleRect). The offsets are
 * also the resting places rather than wherever a module is mid-flight, which is
 * what makes this safe to run before the animation starts.
 */
function setFlightOrigin(node, sourceNode) {
  if (!sourceNode) return;
  const source = sourceNode.getBoundingClientRect();
  // Nothing laid out yet (jsdom, or a widget still hidden): leave the fallbacks
  // in place, which put the module on its own cell at its own size.
  if (source.width === 0) return;
  const region = node.getBoundingClientRect();
  for (const module of node.querySelectorAll('.widget-detail__module')) {
    if (module.offsetWidth === 0) continue;
    module.style.setProperty(
      '--from-x',
      `${round(source.left - region.left - module.offsetLeft)}px`,
    );
    module.style.setProperty('--from-y', `${round(source.top - region.top - module.offsetTop)}px`);
    module.style.setProperty('--from-scale', String(round(source.width / module.offsetWidth, 3)));
  }
}

/** Sub-pixel precision buys nothing in a travelling card and makes the inline
 * styles (and any test reading them) unreadable. */
function round(value, places = 0) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Mount the arrows between modules: a layer inside the region carrying one
 * curve per pair in MODULE_ARROWS (connector.js), for the criteria whose cards
 * follow on from one another — see ARROWLESS. The layer is inset to the
 * region's padding box, which is the box every module is measured against, so
 * an arrow can only ever be drawn inside the region and never across the map
 * half beside it.
 * @returns {{ update(props: object): void, destroy(): void } | null}
 */
function mountArrows(node, criterion) {
  if (ARROWLESS.has(criterion)) return null;
  const layer = document.createElement('div');
  layer.className = 'widget-detail__connectors';
  node.append(layer);
  const modules = [...node.querySelectorAll('.widget-detail__module')];
  const links = MODULE_ARROWS.filter(([from, to]) => modules[from] && modules[to]).map(
    ([from, to]) => ({ source: moduleRect(modules[from]), target: moduleRect(modules[to]) }),
  );
  if (links.length === 0) return null;
  return connector.render(layer, { links });
}

/** A module's resting place, in the layer's coordinates.
 *
 * Offsets rather than getBoundingClientRect, and the difference matters: at the
 * moment this runs every module is at the start of its flight, and a transform
 * moves what an element looks like without moving where it is. Offsets give the
 * position the module is flying *to* — which is where it will be by the time
 * the arrow is drawn, and where it stays afterwards apart from a few px of
 * drift. Both are measured from the region's padding edge, which is exactly the
 * box the layer fills. */
function moduleRect(module) {
  return {
    x: module.offsetLeft,
    y: module.offsetTop,
    width: module.offsetWidth,
    height: module.offsetHeight,
  };
}

/** Problem Fit's L1 body: each SDG 11 target the project addresses, with a
 * one-line explanation of how. The explanations live in i18n keyed by slug and
 * target code (`problemFit.<slug>.target.<code>`); this only lays them out. */
function problemFitTargetsHtml({ slug, targets }) {
  const items = targets
    .map((code) => {
      const heading = t('problemFit.targetHeading').replace('{code}', code);
      const text = t(`problemFit.${slug}.target.${code}`);
      return `
        <li class="widget__problem-fit-target">
          <span class="widget__problem-fit-code">${heading}</span>
          <span class="widget__problem-fit-text">${text}</span>
        </li>`;
    })
    .join('');
  return `<ul class="widget__problem-fit-targets">${items}</ul>`;
}

/** Adoption's L1 body: the cards its L2 opens into, named. Driven by the module
 * list itself rather than a second list here, so a card that gains content
 * appears in the widget and one that has none never does. */
function adoptionTopicsHtml(modules) {
  const items = modules
    .map((module) => `<li class="widget__topic">${t(module.labelKey)}</li>`)
    .join('');
  return `<ul class="widget__topics">${items}</ul>`;
}

function applyWidget(widget, layout, contentHtml) {
  Object.assign(widget.node.style, {
    top: layout.top,
    left: layout.left ?? 'auto',
    right: layout.right ?? 'auto',
    width: layout.width,
    // Only Problem Fit's fit-content width is clamped; the fixed-width widgets
    // pass no min/max and fall back to 'none'.
    minWidth: layout.minWidth ?? 'none',
    maxWidth: layout.maxWidth ?? 'none',
    padding: layout.padding,
    opacity: layout.opacity,
    // Shrunk towards the corner it is pinned to, so it stays anchored there
    // rather than drifting inwards as it scales.
    transform: `scale(${layout.scale ?? '1'})`,
    transformOrigin: layout.left ? 'top left' : 'top right',
    zIndex: layout.z,
  });
  widget.node.innerHTML = contentHtml;
}

function widgetHeader(label, chip) {
  return `
    <div class="widget__header">
      <span class="widget__label">${label}</span>
      ${chip ? `<span class="widget__chip">${chip}</span>` : ''}
    </div>`;
}

/** A widget's body: a sourced figure when `metric` is one, otherwise an empty
 * shell — never a fabricated number. `metric` is whatever
 * `selectors.js#widgetMetricsForProject` handed down for this widget:
 * `{ key, value, unit }` or null. `key` names the figure (Impact's sub-metrics
 * resolve via `impact.<key>`) and is null when the widget's own title says it;
 * `unit` is null for a bare count. `modules` is this widget's own L2 payload,
 * which is what Adoption lists in place of a figure. */
function widgetContent(criterion, metric, problemFit, modules) {
  const label = t(`criteria.${criterion}`);
  // Problem Fit headlines with the SDG 11 targets it addresses, each with a
  // one-line explanation of how — not a figure, so it renders text where the
  // other widgets show a bar.
  if (criterion === 'problemFit' && problemFit) {
    return widgetHeader(label, null) + problemFitTargetsHtml(problemFit);
  }
  // Adoption has no single figure either — what it has is a set of topics — so
  // it names the ones this city has content for. An unresearched city has none
  // and falls through to the empty shell below.
  if (criterion === 'adoption') {
    const filled = modules.filter((module) => module?.kind);
    if (filled.length > 0) return widgetHeader(label, null) + adoptionTopicsHtml(filled);
  }
  // Impact stands on the card it opens into: the cycle-network module, drawn
  // exactly as it is at L2 apart from the sentence and the chips underneath it.
  // The widget used to show a bare figure, which read as a separate thing from
  // the card it turned into — this is one card at two sizes.
  if (criterion === 'impact') {
    const preview = modules.find((module) => module?.key === 'cycleNetwork' && module.kind);
    if (preview) {
      return (
        widgetHeader(label, null) +
        `<span class="widget__submetric">${t(preview.labelKey)}</span>` +
        modulePreviewHtml(preview)
      );
    }
  }
  if (!metric) {
    return widgetHeader(label, null) + `<div class="widget__bar widget__bar--empty"></div>`;
  }
  const subLabel = metric.key
    ? `<span class="widget__submetric">${t(`impact.${metric.key}`)}</span>`
    : '';
  const unit = metric.unit ? `<span class="widget__value-unit">${metric.unit}</span>` : '';
  const headline = metric.key ? ' widget__value-row--headline' : '';
  return (
    widgetHeader(label, null) +
    subLabel +
    `<div class="widget__value-row${headline}">
       <span class="widget__value${metric.key ? ' widget__value--headline' : ''}">${formatNumber(metric.value, getLocale())}</span>
       ${unit}
     </div>`
  );
}
