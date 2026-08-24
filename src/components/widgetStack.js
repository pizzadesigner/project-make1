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
// render(container, { project, activeCriterion, metrics, impactModules,
// problemFitModules, adoptionModules, problemFit, comingSoon,
// onSelectCriterion }) and the component never reads the store — data comes
// down, the clicked widget goes up via
// onSelectCriterion('problemFit'|'impact'|'adoption').
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
import { moduleHtml, mountModuleExtras } from './detailContent.js';

const WIDGETS = ['problemFit', 'impact', 'adoption'];

// Problem Fit is anchored top-left; Impact + Adoption stack down the top-right.
// STACK_TOP clears the corner controls; STACK_STEP is the rhythm between the two
// right-hand widgets; STACK_MARGIN insets each column from its edge.
const STACK_TOP = 72;
const STACK_MARGIN = 16;
const STACK_STEP = 140;
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
    detail.sync(active, modulesFor(active, next));
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
 * and a second one inside the region was a duplicate of that. */
function buildDetail(sourceNodeFor) {
  const node = document.createElement('section');
  node.className = 'widget-detail';
  node.hidden = true;
  node.setAttribute('aria-live', 'polite');

  let leaveTimer = null;
  let openCriterion = null;
  let arrows = null;
  let contents = [];

  /** Empty the region: nothing left in the DOM, no pending timer, and every
   * chart and chip the modules mounted destroyed rather than orphaned — the
   * region is rebuilt from innerHTML, so anything not torn down here leaks its
   * listeners and its tooltip node. */
  function teardown() {
    clearTimeout(leaveTimer);
    leaveTimer = null;
    arrows?.destroy();
    arrows = null;
    for (const child of contents) child.destroy();
    contents = [];
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

  function sync(activeCriterion, modules) {
    if (!activeCriterion) {
      openCriterion = null;
      return leave();
    }
    // Re-syncing a region that is already open (a locale switch, new data) must
    // not replay the entrance: these modules have already flown out once.
    const settled = activeCriterion === openCriterion;
    openCriterion = activeCriterion;
    teardown();
    node.className = detailClass(activeCriterion, settled);
    node.setAttribute('aria-label', t(`criteria.${activeCriterion}`));
    node.innerHTML = detailHeader(activeCriterion) + moduleScaffold(modules);
    node.hidden = false;
    mountModuleExtras(node, modules, contents);
    setFlightOrigin(node, sourceNodeFor(activeCriterion));
    arrows = mountArrows(node);
    return undefined;
  }

  return { node, sync, destroy: teardown };
}

/** The region's classes: which side it opens on, and — when it is being
 * re-synced rather than opened — the flag that suppresses the entrance (see
 * .is-settled in widgets.css). */
function detailClass(criterion, settled) {
  return `widget-detail widget-detail--${widgetSide(criterion)}${settled ? ' is-settled' : ''}`;
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

/** The six modules. A module with content gets it; one without stays an empty
 * shell, which is the honest stand-in for a topic this city has no sourced
 * rows for — never a box of invented figures. */
function moduleScaffold(modules = []) {
  let slot = 0;
  const columns = MODULE_COLUMNS.map((count, column) => {
    const boxes = Array.from({ length: Math.min(count, MODULE_SLOTS - slot) }, () => {
      const index = slot;
      slot += 1;
      return `<div class="widget-detail__module widget-detail__module--${index + 1}">
         <div class="widget-detail__card">${moduleHtml(modules[index], index)}</div>
       </div>`;
    }).join('');
    return `<div class="widget-detail__column widget-detail__column--${column + 1}">${boxes}</div>`;
  }).join('');
  return `<div class="widget-detail__modules">${columns}</div>`;
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
 * curve per pair in MODULE_ARROWS (connector.js). The layer is inset to the
 * region's padding box, which is the box every module is measured against, so
 * an arrow can only ever be drawn inside the region and never across the map
 * half beside it.
 * @returns {{ update(props: object): void, destroy(): void } | null}
 */
function mountArrows(node) {
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
