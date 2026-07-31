// The three Exploration-layer widgets (Problem Fit, Impact, Adoption
// Requirements) shown while a city is focused (L1). Problem Fit sits top-left;
// Impact + Adoption stack top-right. Clicking one enters its L2: a data panel
// opens on that widget's side (the map cuts to the opposite half — see mapView
// and europeMap), and the widgets dim in place.
//
// render(container, { project, activeCriterion, metrics, impactSubMetrics,
// onSelectCriterion }) and the component never reads the store — data comes
// down, the clicked widget goes up via
// onSelectCriterion('problemFit'|'impact'|'adoption').
// TODO(data): mostly placeholder content still — no fabricated number is shown
// for anything unsourced (Neutrality/Honesty — see docs/DESIGN_RATIONALE.md).
// Impact → car density and cycle network are the first sourced exceptions (see
// selectors.js#impactSubMetrics): Cologne and Paris both render a real chart,
// not a stub, while Lisbon and Helsinki remain honest placeholders.

import { t, getLocale } from '../lib/i18n.js';
import { formatNumber } from '../lib/format.js';
import * as lineChart from './lineChart.js';
import * as modalSplitChart from './modalSplitChart.js';
import * as sourceChip from './sourceChip.js';

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
    detail.sync(active, next.metrics, next.impactSubMetrics);
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

  // Sub-metrics with real (sourced) data mount their own components — a chart,
  // a source chip — into slots left by detailContent's innerHTML. Track them so
  // they're torn down before the next sync rewrites that innerHTML, rather than
  // left as orphaned DOM/listeners.
  const children = [];
  function clearChildren() {
    for (const child of children.splice(0)) child.destroy();
  }

  function sync(activeCriterion, metrics, impactSubMetrics) {
    clearChildren();
    if (!activeCriterion) {
      node.hidden = true;
      node.replaceChildren();
      return;
    }
    const wide = activeCriterion === 'impact' ? ' widget-detail--wide' : '';
    node.className = `widget-detail widget-detail--${widgetSide(activeCriterion)}${wide}`;
    node.setAttribute('aria-label', t(`criteria.${activeCriterion}`));
    node.innerHTML = detailContent(activeCriterion, metrics, impactSubMetrics);
    node.hidden = false;
    if (activeCriterion === 'impact') mountSubmetricExtras(node, impactSubMetrics, children);
  }

  return { node, sync };
}

/** Mounts each Impact sub-metric's live pieces once its markup is in the DOM:
 * the modal-split donut, the car-density sparkline, and a source chip for any
 * sourced metric (including the single-figure cycle network). */
function mountSubmetricExtras(node, impactSubMetrics, children) {
  const locale = getLocale();
  for (const submetric of impactSubMetrics) {
    if (submetric.key === 'modalSplit' && submetric.value) {
      const donutSlot = node.querySelector(`[data-donut="${submetric.key}"]`);
      if (donutSlot) {
        children.push(
          modalSplitChart.render(donutSlot, {
            modes: submetric.value.modes,
            labels: submetric.value.modes.map((mode) => t(`impact.mode.${mode}`)),
            rings: submetric.value.rings,
            ariaLabel: modalSplitAriaLabel(submetric.value),
          }),
        );
      }
    } else if (Array.isArray(submetric.value)) {
      const chartSlot = node.querySelector(`[data-chart="${submetric.key}"]`);
      if (chartSlot) {
        children.push(
          lineChart.render(chartSlot, {
            series: submetric.value,
            unit: submetric.unit,
            locale,
            compact: true,
          }),
        );
      }
    }
    const chipSlot = node.querySelector(`[data-chip="${submetric.key}"]`);
    if (chipSlot && submetric.source) {
      children.push(sourceChip.render(chipSlot, { ...submetric.source, locale }));
    }
  }
}

/** Spoken summary of the modal-split donut — the latest ring, per mode. */
function modalSplitAriaLabel({ modes, rings, latestYear }) {
  const latest = rings[rings.length - 1];
  if (!latest) return t('impact.modalSplit');
  const parts = modes.map((mode, i) => `${t(`impact.mode.${mode}`)} ${latest.values[i]}%`);
  return `${t('impact.modalSplit')} ${latestYear}: ${parts.join(', ')}`;
}

/** Placeholder L2 content — a heading, a body (Impact's three sub-metric
 * slots, or a single empty diagram slot for the others) and a note. No
 * fabricated numbers until researched data lands (see widgetContent). */
function detailContent(criterion, metrics, impactSubMetrics) {
  const chip =
    metrics[criterion] == null
      ? `<span class="widget__chip">${t('widget.placeholder')}</span>`
      : '';
  const body =
    criterion === 'impact'
      ? submetricsHtml(impactSubMetrics)
      : `<div class="widget-detail__diagram" aria-hidden="true"></div>`;
  return `
    <header class="widget-detail__header">
      <button type="button" class="widget-detail__back" aria-label="${t('detail.back')}">
        <span aria-hidden="true">←</span>
      </button>
      <h2 class="widget-detail__title">${t(`criteria.${criterion}`)}</h2>
      ${chip}
    </header>
    ${body}
    <p class="widget-detail__note">${t('widget.placeholderNote')}</p>`;
}

/** Impact's three sub-metrics (modal split, car density, cycle network — see
 * selectors.js#impactSubMetrics), side by side. Each is an honest placeholder
 * slot until its figure is sourced — car density and cycle network already
 * render real charts for Cologne and Paris (mounted by mountSubmetricExtras
 * once this markup is in the DOM). */
function submetricsHtml(impactSubMetrics) {
  return `
    <div class="widget-detail__submetrics">
      ${impactSubMetrics.map(submetricHtml).join('')}
    </div>`;
}

function submetricHtml({ key, value, unit }) {
  const label = t(`impact.${key}`);
  const cls = 'widget-detail__submetric';
  // Modal split — a donut plus a per-mode legend (with the latest-year share).
  if (key === 'modalSplit' && value) {
    return `
      <div class="${cls} widget-detail__submetric--span">
        <span class="widget-detail__submetric-label">${label}</span>
        <div class="widget-detail__donut" data-donut="${key}"></div>
        ${modalSplitLegendHtml(value)}
        <span class="widget-detail__submetric-chip" data-chip="${key}"></span>
      </div>`;
  }
  // Car density — a sparkline of the year series (latest value shown big).
  if (Array.isArray(value)) {
    const latest = value[value.length - 1];
    return `
      <div class="${cls}">
        <span class="widget-detail__submetric-label">${label}</span>
        <span class="widget-detail__submetric-value">${formatNumber(latest.value, getLocale(), unit)}</span>
        <div class="widget-detail__submetric-chart" data-chart="${key}"></div>
        <span class="widget-detail__submetric-chip" data-chip="${key}"></span>
      </div>`;
  }
  if (value == null) {
    return `
      <div class="${cls}">
        <span class="widget-detail__submetric-label">${label}</span>
        <div class="widget-detail__submetric-stub" aria-hidden="true"></div>
      </div>`;
  }
  // Cycle network — a single sourced figure (with its unit + source chip).
  return `
    <div class="${cls}">
      <span class="widget-detail__submetric-label">${label}</span>
      <span class="widget-detail__submetric-value">${formatNumber(value, getLocale(), unit)}</span>
      <span class="widget-detail__submetric-chip" data-chip="${key}"></span>
    </div>`;
}

/** Legend for the modal-split donut: a colour swatch, mode label and the
 * latest-year share for each mode, in the donut's segment order. */
function modalSplitLegendHtml({ modes, rings }) {
  const latest = rings[rings.length - 1]?.values ?? [];
  const items = modes
    .map(
      (mode, i) => `
      <li class="widget-detail__legend-item">
        <span class="widget-detail__legend-swatch widget-detail__legend-swatch--${mode}"></span>
        <span>${t(`impact.mode.${mode}`)}</span>
        <b>${latest[i] ?? 0}%</b>
      </li>`,
    )
    .join('');
  return `<ul class="widget-detail__legend">${items}</ul>`;
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
