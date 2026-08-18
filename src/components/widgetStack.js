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
//
// `metrics` is keyed by widget (`selectors.js#widgetMetricsForProject`): each
// value is `{ key, value, unit }` or null. This component decides nothing about
// *which* figure a city shows — it renders what it is handed, and an empty shell
// for null, so no fabricated number can appear for anything unsourced
// (Neutrality/Honesty — see docs/DESIGN_RATIONALE.md).
// Problem Fit carries its own content per city (selectors.js#problemFitForCity):
// the SDG 11 targets at L1 and a narrative at L2 — Cologne is wired, other
// cities stay empty. Impact's three sub-metrics (see
// selectors.js#impactSubMetrics) are the sourced figures: Cologne and Paris
// render real charts at L2 — modal split, car density, cycle network — while
// Lisbon and Helsinki remain empty.
// TODO(data): Adoption is null at every city (docs/research.md §5.4).

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
    // Inert when a panel is open (widgets are decorative) or when the coming-soon
    // overlay covers them — either way not click or focus targets.
    const inert = Boolean(active) || Boolean(next.comingSoon);
    for (const widget of widgets) {
      applyWidget(
        widget,
        layout[widget.kind],
        widgetContent(widget.kind, next.metrics[widget.kind], next.problemFit ?? null),
      );
      widget.node.tabIndex = inert ? -1 : 0;
      widget.node.style.pointerEvents = inert ? 'none' : 'auto';
      widget.node.setAttribute('aria-hidden', String(inert));
    }
    detail.sync(
      active,
      next.impactSubMetrics,
      next.modalSplitTarget ?? null,
      next.problemFit ?? null,
    );
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

  function sync(activeCriterion, impactSubMetrics, modalSplitTarget, problemFit) {
    clearChildren();
    if (!activeCriterion) {
      node.hidden = true;
      node.replaceChildren();
      return;
    }
    const wide = activeCriterion === 'impact' ? ' widget-detail--wide' : '';
    node.className = `widget-detail widget-detail--${widgetSide(activeCriterion)}${wide}`;
    node.setAttribute('aria-label', t(`criteria.${activeCriterion}`));
    node.innerHTML = detailContent(activeCriterion, impactSubMetrics, modalSplitTarget, problemFit);
    node.hidden = false;
    if (activeCriterion === 'impact') {
      mountSubmetricExtras(node, impactSubMetrics, children, modalSplitTarget);
    }
  }

  return { node, sync };
}

/** Mounts each Impact sub-metric's live pieces once its markup is in the DOM:
 * the modal-split donut(s), the car-density sparkline, and a source chip for
 * any sourced metric (including the single-figure cycle network). */
function mountSubmetricExtras(node, impactSubMetrics, children, modalSplitTarget) {
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
      // The target donut only exists in the DOM when submetricHtml decided
      // there's a sourced target for this city (see there) — same slot
      // pattern, one ring, two segments (whatever selectors.js's
      // MODAL_SPLIT_TARGETS defines for this city).
      const targetSlot = node.querySelector('[data-donut="modalSplitTarget"]');
      if (targetSlot && modalSplitTarget) {
        children.push(
          modalSplitChart.render(targetSlot, {
            modes: modalSplitTarget.segments.map((segment) => segment.mode),
            labels: modalSplitTarget.segments.map((segment) => t(`impact.mode.${segment.mode}`)),
            rings: [
              {
                year: modalSplitTarget.year,
                values: modalSplitTarget.segments.map((segment) => segment.share),
              },
            ],
            ariaLabel: modalSplitTargetAriaLabel(modalSplitTarget),
          }),
        );
        // The target's own source — a different document from the actual
        // donut's (submetric.source, chipped separately below) — so it gets
        // its own chip rather than sharing one.
        const targetChipSlot = node.querySelector('[data-chip="modalSplitTarget"]');
        if (targetChipSlot) {
          children.push(sourceChip.render(targetChipSlot, { ...modalSplitTarget.source, locale }));
        }
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

/** Spoken summary of the target donut — a single ring, two segments. */
function modalSplitTargetAriaLabel(target) {
  const label = t('impact.modalSplitTarget').replace('{year}', String(target.year));
  const parts = target.segments.map(
    (segment) => `${t(`impact.mode.${segment.mode}`)} ${segment.share}%`,
  );
  return `${label}: ${parts.join(', ')}`;
}

/** L2 content — a heading and a body (Impact's three sub-metric slots, or a
 * single empty diagram slot for the others). No fabricated numbers until
 * researched data lands (see widgetContent). */
function detailContent(criterion, impactSubMetrics, modalSplitTarget, problemFit) {
  let body;
  if (criterion === 'impact') {
    body = submetricsHtml(impactSubMetrics, modalSplitTarget);
  } else if (criterion === 'problemFit' && problemFit) {
    body = problemFitHtml(problemFit);
  } else {
    body = `<div class="widget-detail__diagram" aria-hidden="true"></div>`;
  }
  return `
    <header class="widget-detail__header">
      <button type="button" class="widget-detail__back" aria-label="${t('detail.back')}">
        <span aria-hidden="true">←</span>
      </button>
      <h2 class="widget-detail__title">${t(`criteria.${criterion}`)}</h2>
    </header>
    ${body}`;
}

/** Problem Fit's L2 prose for a city — the ordered `body` blocks from
 * selectors.js (a plain paragraph, or a bold lead-in term + description, with
 * the closing goal block set off by a divider). Every string lives in i18n keyed
 * by the city slug (`problemFit.<slug>.*`); this only lays the blocks out, so the
 * component stays free of any city-specific copy or shape. */
function problemFitHtml({ slug, body }) {
  const line = (suffix) => t(`problemFit.${slug}.${suffix}`);
  const blocks = body
    .map((block) => {
      const cls = block.goal ? ' class="widget-detail__problem-fit-goal"' : '';
      const content = block.term
        ? `<strong>${line(block.term)}:</strong> ${line(block.text)}`
        : line(block.text);
      return `<p${cls}>${content}</p>`;
    })
    .join('');
  return `<div class="widget-detail__problem-fit">${blocks}</div>`;
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

/** Impact's three sub-metrics (modal split, car density, cycle network — see
 * selectors.js#impactSubMetrics), side by side. Each is an honest placeholder
 * slot until its figure is sourced — car density and cycle network already
 * render real charts for Cologne and Paris (mounted by mountSubmetricExtras
 * once this markup is in the DOM). */
function submetricsHtml(impactSubMetrics, modalSplitTarget) {
  return `
    <div class="widget-detail__submetrics">
      ${impactSubMetrics.map((submetric) => submetricHtml(submetric, modalSplitTarget)).join('')}
    </div>`;
}

function submetricHtml({ key, value, unit, benchmark, sdgTarget }, modalSplitTarget) {
  const label = t(`impact.${key}`);
  const cls = 'widget-detail__submetric';
  const context = contextHtml(benchmark, sdgTarget);
  // Modal split — a donut plus a per-mode legend (with the latest-year share).
  // Cities with a sourced target (selectors.js#modalSplitTargetForCity) get a
  // second, smaller donut beside it: "how it should look" next to "how it
  // looks now". No target for this city → modalSplitTarget is null, the
  // compare row's only child fills it, and it looks the same as before.
  if (key === 'modalSplit' && value) {
    const target = modalSplitTarget ?? null;
    // With a target column beside it, the actual donut's own chip moves into
    // its column too (mirroring the target's) so both chips share one flex
    // column layout with `margin-top: auto` (widgets.css) and land at the
    // same Y regardless of the target column's extra progress/caveat line.
    // No target → single column, chip stays at the card's bottom as before.
    const actualChip = `<span class="widget-detail__submetric-chip" data-chip="${key}"></span>`;
    return `
      <div class="${cls} widget-detail__submetric--span">
        <span class="widget-detail__submetric-label">${label}</span>
        <div class="widget-detail__modal-split-compare">
          <div class="widget-detail__modal-split-actual">
            ${target ? `<span class="widget-detail__modal-split-heading">${t('impact.modalSplitNow')}</span>` : ''}
            <div class="widget-detail__modal-split-body">
              <div class="widget-detail__donut" data-donut="${key}"></div>
              ${modalSplitLegendHtml(value)}
            </div>
            ${target ? actualChip : ''}
          </div>
          ${target ? modalSplitTargetHtml(target, value) : ''}
        </div>
        ${context}
        ${target ? '' : actualChip}
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
        ${context}
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
      ${context}
      <span class="widget-detail__submetric-chip" data-chip="${key}"></span>
    </div>`;
}

/** What a figure should be read against, under the figure itself: the
 * benchmark ("a lot or a little?") and the SDG-11 target it serves ("why does
 * this matter?"). Both are pending seams — see selectors.js#benchmarkForIndicator
 * and #sdgTargetForIndicator — so they render as named placeholders rather than
 * silently missing, and only beside a figure that actually exists. */
function contextHtml(benchmark, sdgTarget) {
  const rows = [
    benchmark == null ? t('widget.benchmarkPending') : null,
    sdgTarget == null ? t('widget.sdgTargetPending') : null,
  ].filter(Boolean);
  if (rows.length === 0) return '';
  return `<p class="widget-detail__submetric-pending">${rows.join(' · ')}</p>`;
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

/** The target donut's own heading, mini donut slot and two-row legend —
 * matching the actual donut's markup shape (donut + `.widget-detail__legend`)
 * so it inherits the same side-by-side donut/legend styling for free. */
function modalSplitTargetHtml(target, value) {
  const legendItems = target.segments
    .map(
      (segment) => `
      <li class="widget-detail__legend-item">
        <span class="widget-detail__legend-swatch widget-detail__legend-swatch--${segment.mode}"></span>
        <span>${t(`impact.mode.${segment.mode}`)}</span>
        <b>${segment.share}%</b>
      </li>`,
    )
    .join('');
  return `
    <div class="widget-detail__modal-split-target">
      <span class="widget-detail__modal-split-heading">${t('impact.modalSplitTarget').replace('{year}', String(target.year))}</span>
      <div class="widget-detail__modal-split-body">
        <div class="widget-detail__donut" data-donut="modalSplitTarget"></div>
        <ul class="widget-detail__legend">${legendItems}</ul>
      </div>
      ${modalSplitProgressHtml(value, target)}
      <span class="widget-detail__submetric-chip" data-chip="modalSplitTarget"></span>
    </div>`;
}

/** How close the latest actual ring already is to the sourced target — pure
 * arithmetic on two sourced figures (never a guessed target, see
 * selectors.js#modalSplitTargetForCity), stated as "goal already met" or the
 * remaining points to close. When the target isn't measuring the same thing
 * as the actual data (`comparable: false`, e.g. Paris's different survey
 * population), states that instead of a percentage-point gap that would
 * imply a comparison that isn't actually valid. */
function modalSplitProgressHtml({ modes, rings }, target) {
  const latest = rings[rings.length - 1];
  const [primary] = target.segments;
  if (!latest || !primary.actualModes) return '';
  const actual = primary.actualModes.reduce((sum, mode) => {
    const i = modes.indexOf(mode);
    return sum + (i === -1 ? 0 : latest.values[i]);
  }, 0);
  if (target.comparable === false) {
    const text = t('impact.modalSplitProgress.notComparable').replace('{actual}', String(actual));
    return `<p class="widget-detail__target-progress">${text}</p>`;
  }
  const gap = primary.share - actual;
  const key = gap <= 0 ? 'impact.modalSplitProgress.met' : 'impact.modalSplitProgress.gap';
  const text = t(key)
    .replace('{actual}', String(actual))
    .replace('{target}', String(primary.share))
    .replace('{year}', String(target.year))
    .replace('{gap}', String(Math.abs(gap)));
  return `<p class="widget-detail__target-progress">${text}</p>`;
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
 * `unit` is null for a bare count. */
function widgetContent(criterion, metric, problemFit) {
  const label = t(`criteria.${criterion}`);
  // Problem Fit headlines with the SDG 11 targets it addresses, each with a
  // one-line explanation of how — not a figure, so it renders text where the
  // other widgets show a bar.
  if (criterion === 'problemFit' && problemFit) {
    return widgetHeader(label, null) + problemFitTargetsHtml(problemFit);
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
