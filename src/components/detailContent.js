// The L2 content builders: the markup for a criterion's detail (Impact's three
// sub-metrics, Problem Fit's prose) and the live pieces mounted into it — the
// modal-split donuts, the car-density sparkline, and a source chip for every
// sourced figure.
//
// Lifted out of widgetStack.js while the L2 layout is reworked: the modules are
// being positioned first and filled second, so nothing here is called for the
// moment. It is the content half of that rework rather than dead weight —
// `detailContent` and `mountSubmetricExtras` are what the boxes get filled
// from, and they still carry the rules that matter (no fabricated numbers, and
// every figure with its own source).

import { t, getLocale } from '../lib/i18n.js';
import { formatNumber } from '../lib/format.js';
import * as lineChart from './lineChart.js';
import * as modalSplitChart from './modalSplitChart.js';
import * as sourceChip from './sourceChip.js';

/** Mounts each Impact sub-metric's live pieces once its markup is in the DOM:
 * the modal-split donut(s), the car-density sparkline, and a source chip for
 * any sourced metric (including the single-figure cycle network). */
export function mountSubmetricExtras(node, impactSubMetrics, children, modalSplitTarget) {
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
export function detailContent(criterion, impactSubMetrics, modalSplitTarget, problemFit) {
  let body;
  if (criterion === 'impact') {
    body = submetricsHtml(impactSubMetrics, modalSplitTarget);
  } else if (criterion === 'problemFit' && problemFit) {
    body = problemFitHtml(problemFit);
  } else {
    body = `<div class="widget-detail__diagram" data-thread-block aria-hidden="true"></div>`;
  }
  return body;
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
      return `<p${cls} data-thread-block>${content}</p>`;
    })
    .join('');
  return `<div class="widget-detail__problem-fit">${blocks}</div>`;
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
      <div class="${cls} widget-detail__submetric--span" data-thread-block>
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
      <div class="${cls}" data-thread-block>
        <span class="widget-detail__submetric-label">${label}</span>
        <span class="widget-detail__submetric-value">${formatNumber(latest.value, getLocale(), unit)}</span>
        <div class="widget-detail__submetric-chart" data-chart="${key}"></div>
        ${context}
        <span class="widget-detail__submetric-chip" data-chip="${key}"></span>
      </div>`;
  }
  if (value == null) {
    return `
      <div class="${cls}" data-thread-block>
        <span class="widget-detail__submetric-label">${label}</span>
        <div class="widget-detail__submetric-stub" aria-hidden="true"></div>
      </div>`;
  }
  // Cycle network — a single sourced figure (with its unit + source chip).
  return `
    <div class="${cls}" data-thread-block>
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
