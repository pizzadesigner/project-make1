// The three Exploration-layer widgets (Problem Fit, Impact, Adoption
// Requirements) shown while a city is focused (L1). Problem Fit sits top-left;
// Impact + Adoption stack top-right. Clicking one enters its L2: a data panel
// opens on that widget's side (the map cuts to the opposite half — see mapView
// and europeMap), and the widgets dim in place.
//
// render(container, { project, activeCriterion, metrics, onSelectCriterion })
// and the component never reads the store — data comes down, the clicked
// widget goes up via onSelectCriterion('problemFit'|'impact'|'adoption').
// TODO(data): placeholder content only — no researched figures yet, so no
// fabricated number is shown (Neutrality/Honesty — see docs/DESIGN_RATIONALE.md).

import { t } from '../lib/i18n.js';

const WIDGETS = ['problemFit', 'impact', 'adoption'];

// Problem Fit is anchored top-left; Impact + Adoption stack down the top-right.
// STACK_TOP clears the corner controls; STACK_STEP is the rhythm between the two
// right-hand widgets; STACK_MARGIN insets each column from its edge.
const STACK_TOP = 72;
const STACK_MARGIN = 16;
const STACK_STEP = 128;
const WIDGET_WIDTH = '248px';
const WIDGET_PADDING = '16px 18px';

const BASE_LAYOUT = {
  problemFit: {
    top: `${STACK_TOP}px`,
    left: `${STACK_MARGIN}px`,
    width: WIDGET_WIDTH,
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

/** At L2 the clicked widget hands off to its data panel (hidden here); the
 * others dim in place. All positions hold. */
function widgetLayout(activeCriterion) {
  const layout = Object.fromEntries(WIDGETS.map((key) => [key, { ...BASE_LAYOUT[key] }]));
  if (!activeCriterion) return layout;

  for (const key of WIDGETS) {
    layout[key].opacity = key === activeCriterion ? '0' : '0.35';
  }
  return layout;
}

export function render(container, props) {
  const root = document.createElement('div');
  root.className = 'widget-stack';
  root.hidden = true;

  const widgets = WIDGETS.map((key) => buildWidget(key, props.onSelectCriterion));
  const detail = buildDetail(props.onSelectCriterion);
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
    for (const widget of widgets) {
      applyWidget(widget, layout[widget.kind], widgetContent(widget.kind, next.metrics));
      // With a panel open the small widgets are decorative — not click or focus
      // targets.
      widget.node.tabIndex = active ? -1 : 0;
      widget.node.style.pointerEvents = active ? 'none' : 'auto';
      widget.node.setAttribute('aria-hidden', String(Boolean(active)));
    }
    detail.sync(active, next.metrics);
  }

  update(props);

  return {
    update,
    destroy() {
      root.remove();
    },
  };
}

function buildWidget(kind, onSelectCriterion) {
  const node = document.createElement('div');
  node.className = `widget widget--${kind}`;
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

/** The L2 data panel: one reused element, shown on the active widget's side
 * with that dimension's (placeholder) content. A back arrow in its header
 * steps back to L1 — the same action as the screen's Back button/Escape —
 * since once the panel is open it's what the user is actually looking at, not
 * the far corner where the global Back control sits. Delegated on `node`
 * (rather than attached in detailContent's markup) so the listener survives
 * the innerHTML rewrite on every sync. */
function buildDetail(onSelectCriterion) {
  const node = document.createElement('section');
  node.className = 'widget-detail';
  node.hidden = true;
  node.setAttribute('aria-live', 'polite');
  node.addEventListener('click', (event) => {
    if (event.target.closest('.widget-detail__back')) onSelectCriterion(null);
  });

  function sync(activeCriterion, metrics) {
    if (!activeCriterion) {
      node.hidden = true;
      node.replaceChildren();
      return;
    }
    const wide = activeCriterion === 'impact' ? ' widget-detail--wide' : '';
    node.className = `widget-detail widget-detail--${widgetSide(activeCriterion)}${wide}`;
    node.setAttribute('aria-label', t(`criteria.${activeCriterion}`));
    node.innerHTML = detailContent(activeCriterion, metrics);
    node.hidden = false;
  }

  return { node, sync };
}

/** Placeholder L2 content — a heading, an empty diagram slot and a note. No
 * fabricated numbers until researched data lands (see widgetContent). */
function detailContent(criterion, metrics) {
  const chip =
    metrics[criterion] == null
      ? `<span class="widget__chip">${t('widget.placeholder')}</span>`
      : '';
  return `
    <header class="widget-detail__header">
      <button type="button" class="widget-detail__back" aria-label="${t('detail.back')}">
        <span aria-hidden="true">←</span>
      </button>
      <h2 class="widget-detail__title">${t(`criteria.${criterion}`)}</h2>
      ${chip}
    </header>
    <div class="widget-detail__diagram" aria-hidden="true"></div>
    <p class="widget-detail__note">${t('widget.placeholderNote')}</p>`;
}

function applyWidget(widget, layout, contentHtml) {
  Object.assign(widget.node.style, {
    top: layout.top,
    left: layout.left ?? 'auto',
    right: layout.right ?? 'auto',
    width: layout.width,
    padding: layout.padding,
    opacity: layout.opacity,
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

/** A widget's body. Until a real headline figure exists the widget is an
 * intentional placeholder shell (marked as such), never a fabricated number. */
function widgetContent(criterion, metrics) {
  const label = t(`criteria.${criterion}`);
  const value = metrics[criterion];
  if (value == null) {
    return (
      widgetHeader(label, t('widget.placeholder')) +
      `<div class="widget__bar widget__bar--empty"></div>
       <div class="widget__note">${t('widget.placeholderNote')}</div>`
    );
  }
  return (
    widgetHeader(label, null) +
    `<div class="widget__value-row"><span class="widget__value">${value}</span></div>`
  );
}
