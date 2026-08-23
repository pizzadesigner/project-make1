// What goes inside the six L2 modules: the markup for one module's card, and
// the live pieces mounted into it once that markup is in the DOM — the
// modal-split donut, the line charts, and a source chip for every sourced claim.
//
// widgetStack.js places and animates the boxes; this fills them. The split is
// deliberate: the flight is measured geometry and the content is data, and
// neither needs to know how the other works. Nothing here reads the store or
// reaches outside the node it is handed.
//
// The shape of a module is decided in the data layer (selectors.js#impactModules
// for Impact, #problemFitModules and #adoptionModules for the other two) and
// arrives as `kind` — 'cost', 'donut', 'lines', 'breakdown', 'trend', 'prose',
// 'facts', 'links', 'linkGroups', or null for a topic this city has nothing
// sourced for.
// A null module renders an empty card: the rule that no figure appears without
// its source cuts both ways, and an empty box is the honest version of "we have
// not researched this yet" (docs/DESIGN_RATIONALE.md, Neutrality/Honesty).

import { t, getLocale } from '../lib/i18n.js';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '../lib/format.js';
import * as lineChart from './lineChart.js';
import * as modalSplitChart from './modalSplitChart.js';
import * as sourceChip from './sourceChip.js';

/** One module's card. `index` names its slots (`data-chart="3"`), so the
 * mounting pass below can find them without the module knowing where it sits. */
export function moduleHtml(module, index) {
  if (!module || !module.kind) return '';
  const body = {
    cost: costBody,
    donut: donutBody,
    lines: linesBody,
    breakdown: breakdownBody,
    trend: trendBody,
    prose: proseBody,
    facts: factsBody,
    links: linksBody,
    linkGroups: linkGroupsBody,
  }[module.kind];
  if (!body) return '';
  return `
    ${labelHtml(module)}
    ${body(module, index)}
    ${noteHtml(module)}
    ${sourcesHtml(module, index)}`;
}

/** The card's own heading. `labelCode` fills the `{code}` an SDG-target heading
 * carries; a block that leads with its own text (an intro paragraph) has no
 * label at all rather than a repeated one. */
function labelHtml({ labelKey, labelCode }) {
  if (!labelKey) return '';
  return `<span class="module__label">${t(labelKey).replace('{code}', labelCode ?? '')}</span>`;
}

/** Mount every module's live pieces. Called once the scaffold's markup is in
 * the DOM; pushes each child handle so the region can destroy them together. */
export function mountModuleExtras(root, modules, children) {
  const locale = getLocale();
  modules.forEach((module, index) => {
    if (!module || !module.kind) return;
    mountChart(root, module, index, children);
    for (const [slot, source] of sourcesOf(module).entries()) {
      const node = root.querySelector(`[data-chip="${index}-${slot}"]`);
      if (node) children.push(sourceChip.render(node, { ...source, locale }));
    }
  });
}

/** The one chart a module carries, if it carries one. */
function mountChart(root, module, index, children) {
  const slot = root.querySelector(`[data-chart="${index}"]`);
  if (!slot) return;
  if (module.kind === 'donut') {
    children.push(
      modalSplitChart.render(slot, {
        modes: module.modes,
        labels: module.modes.map((mode) => t(`impact.mode.${mode}`)),
        rings: module.rings,
        ariaLabel: donutAriaLabel(module),
        compact: true,
      }),
    );
    return;
  }
  children.push(
    lineChart.render(slot, {
      lines: module.lines,
      unit: module.unit,
      locale: getLocale(),
      compact: true,
    }),
  );
}

/** Spoken summary of the donut — the newest ring, per mode. */
function donutAriaLabel({ labelKey, modes, rings, latestYear }) {
  const latest = rings[rings.length - 1];
  if (!latest) return t(labelKey);
  const parts = modes.map((mode, i) => `${t(`impact.mode.${mode}`)} ${latest.values[i]}%`);
  return `${t(labelKey)} ${latestYear}: ${parts.join(', ')}`;
}

// --- bodies, one per kind --------------------------------------------------

/** What the project cost: the one figure the city published, what that figure
 * covers, and the lines it does not. A cost with no number is as much the point
 * of the card as the headline is — it renders as the em dash any missing value
 * renders as, so "not published" never reads as "nothing". The closing sentence
 * carries the derived per-km rate, filled in here rather than written into the
 * copy: a translator should never be the one holding a number. */
function costBody(module) {
  const locale = getLocale();
  const rows = module.items
    .map(
      (item) => `
      <li class="module__cost-item">
        <span class="module__cost-label">${t(item.labelKey)}</span>
        <b class="module__cost-value">${formatCurrencyCompact(item.value, locale)}</b>
      </li>`,
    )
    .join('');
  // The list is the part that gives, not the disclaimer: a card whose whole
  // argument is "this is not the full bill" must never scroll that sentence out
  // of sight. Same escape valve the funding card uses, one element lower.
  return `
    <p class="module__value">
      <b>${formatCurrencyCompact(module.headline.value, locale)}</b>
      ${costScope(module, locale)}
      ${module.headline.year ? `<span class="module__year">${module.headline.year}</span>` : ''}
    </p>
    <div class="module__scroll">
      <p class="module__lead">${t(module.coversKey)}</p>
      <ul class="module__cost-items">${rows}</ul>
    </div>
    <p class="module__note">${costDisclaimer(module, locale)}</p>`;
}

/** What the headline sum was spent on, in the unit slot beside it — the length
 * comes from the row next to it in the same document, and a card without that
 * row states the sum alone rather than an unqualified scope. */
function costScope(module, locale) {
  if (!module.length) return '';
  const text = t(module.scopeKey).replace(
    '{length}',
    formatNumber(module.length.value, locale, module.length.unit),
  );
  return `<span class="module__unit">${text}</span>`;
}

/** The disclaimer, led by the derived rate where there is one. The rate is its
 * own sentence precisely so a card whose length row is missing drops it and
 * still reads — "About — per km" would be worse than saying nothing. */
function costDisclaimer(module, locale) {
  const note = t(module.disclaimerKey);
  if (module.perKm == null) return note;
  const rate = t(module.rateKey).replace('{perKm}', formatCurrency(module.perKm, locale));
  return `${rate} ${note}`;
}

/** Modal split: the donut with a legend under it, and — where the city has a
 * sourced strategic target — one line saying how far off it is. The target is a
 * sentence rather than the second donut it used to be: at ~310px wide a module
 * fits one ring stack, and the target's content is a comparison, which reads
 * better as the comparison than as a shape to eyeball against another shape. */
function donutBody(module, index) {
  return `
    <div class="module__split">
      <div class="module__donut" data-chart="${index}"></div>
      ${matrixHtml(module)}
    </div>
    ${targetHtml(module)}`;
}

/** The donut's legend, as the table it wants to be: a row per mode, a column
 * per ring. It does the legend's job — swatch and name beside every colour, so
 * nothing is told by hue alone — and, because there are only two rings inside
 * the display window, it also shows each mode's move between them, which is the
 * thing the rings themselves are hardest to read off. */
function matrixHtml({ modes, rings }) {
  const head = rings.map((ring) => `<th scope="col">${ring.year}</th>`).join('');
  const body = modes
    .map(
      (mode, i) => `
      <tr>
        <th scope="row">
          <span class="module__swatch module__swatch--${mode}"></span>
          <span class="module__legend-label">${t(`impact.mode.${mode}`)}</span>
        </th>
        ${rings.map((ring) => `<td>${ring.values[i]}%</td>`).join('')}
      </tr>`,
    )
    .join('');
  return `
    <table class="module__matrix">
      <thead><tr><td></td>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

/** One to three year series on one axis, with the legend naming them. A single
 * line needs no legend — the module's own label says what it is — and gets the
 * latest value as a figure instead. */
function linesBody(module, index) {
  const single = module.lines.length === 1;
  const items = module.lines.map((line) => ({
    key: line.key,
    label: t(`impact.series.${line.key}`),
    value: formatNumber(line.points[line.points.length - 1].value, getLocale()),
  }));
  return `
    ${single ? headlineHtml(module.latest.value, module.unit, module.latest.year) : ''}
    <div class="module__chart" data-chart="${index}"></div>
    ${single ? '' : legendHtml(items)}`;
}

/** Parts of one whole, as a stacked bar sized by the parts themselves. The
 * figure above it is the per-resident one, because that is the number another
 * city can compare itself against; the kilometres are what it is made of. */
function breakdownBody(module) {
  const locale = getLocale();
  const figure = headlineHtml(module.headline.value, module.headline.unit, null);
  // A city with the headline but no breakdown behind it (Paris) shows the
  // figure alone rather than an empty bar — the same graceful-null rule the
  // whole module list follows, one level down.
  if (module.parts.length === 0) return figure;
  const segments = module.parts
    .map(
      (part) =>
        `<span class="module__bar-part module__bar-part--${part.key}" style="flex-grow: ${part.value}"></span>`,
    )
    .join('');
  const items = module.parts.map((part) => ({
    key: part.key,
    label: t(`impact.cycleNetwork.${part.key}`),
    value: formatNumber(part.value, locale, 'km'),
  }));
  return `
    ${figure}
    <div class="module__bar" role="presentation">${segments}</div>
    ${legendHtml(items)}`;
}

/** Two or three sourced points, stated rather than drawn: a line through two
 * measurements five years apart would describe a shape the data does not have. */
function trendBody(module) {
  const locale = getLocale();
  const points = module.points
    .map(
      (point, i) => `
      <div class="module__trend-point${i === module.points.length - 1 ? ' is-latest' : ''}">
        <b>${formatNumber(point.value, locale)}</b>
        <span>${point.year}</span>
      </div>`,
    )
    .join('<span class="module__trend-step" aria-hidden="true"></span>');
  return `
    <p class="module__trend-unit">${module.unit}</p>
    <div class="module__trend">${points}</div>`;
}

/** A Problem Fit block. The block's lead-in term — "The Rings", "Goal" — is the
 * card's own label, so what is left here is the paragraph under it; the copy is
 * the same i18n entries the L1 widget's targets already use. */
function proseBody(module) {
  return `<p class="module__prose">${t(module.text)}</p>`;
}

/** A small grid of the figures that describe the city itself — what another
 * city reads to judge whether its own situation is close enough for this
 * project to transfer. A fact with no sourced row behind it never reaches
 * here (selectors.js#contextModule drops it), so every tile has a number. */
function factsBody(module) {
  const locale = getLocale();
  const tiles = module.facts
    .map(
      (fact) => `
      <div class="module__fact">
        <span class="module__fact-label">${t(`adoption.context.${fact.key}`)}</span>
        <span class="module__fact-value">
          <b>${formatNumber(fact.value, locale)}</b>${fact.unit ? `<span class="module__unit">${fact.unit}</span>` : ''}
        </span>
      </div>`,
    )
    .join('');
  return `<div class="module__facts">${tiles}</div>`;
}

/** A list of places to go next: the departments that own the project, or the
 * organisations that were at the table. Each row is an outbound link, and the
 * lead sentence above them — when the card has one — says what the list is. */
function linksBody(module) {
  return `
    ${module.lead ? `<p class="module__lead">${t(module.lead)}</p>` : ''}
    <div class="module__scroll"><ul class="module__links">${linkItems(module.links)}</ul></div>`;
}

/** The funding routes, grouped by the level of government that offers them. A
 * group's `plain` entries are routes rather than programmes — "sponsorship" has
 * no page to open — so they are named without a link rather than given one that
 * points nowhere in particular. */
function linkGroupsBody(module) {
  const groups = module.groups
    .map(
      (group) => `
      <li class="module__link-group">
        <h3 class="module__link-heading">${t(group.headingKey)}</h3>
        <ul class="module__links">
          ${linkItems(group.links)}
          ${group.plain.map((key) => `<li class="module__link-item">${t(key)}</li>`).join('')}
        </ul>
      </li>`,
    )
    .join('');
  return `<div class="module__scroll"><ul class="module__link-groups">${groups}</ul></div>`;
}

/** One row per link. The text is translated copy and the URL is not, so the two
 * travel separately all the way down to here. */
function linkItems(links) {
  return links
    .map(
      (link) => `
      <li class="module__link-item">
        <a class="module__link" href="${encodeURI(link.url)}" target="_blank" rel="noopener noreferrer">${t(link.textKey)}</a>
      </li>`,
    )
    .join('');
}

// --- shared pieces ---------------------------------------------------------

/** The module's own figure: value, unit, and the year it was measured. */
function headlineHtml(value, unit, year) {
  const suffix = unit ? `<span class="module__unit">${unit}</span>` : '';
  const when = year ? `<span class="module__year">${year}</span>` : '';
  return `
    <p class="module__value">
      <b>${formatNumber(value, getLocale())}</b>${suffix}${when}
    </p>`;
}

/** Colour is never the only thing telling two series apart: every legend row
 * carries the swatch, the name and that row's own number. */
function legendHtml(items) {
  const rows = items
    .map(
      (item) => `
      <li class="module__legend-item">
        <span class="module__swatch module__swatch--${item.key}"></span>
        <span class="module__legend-label">${item.label}</span>
        <b>${item.value}</b>
      </li>`,
    )
    .join('');
  return `<ul class="module__legend">${rows}</ul>`;
}

/** The sentence a module ends on, when it has one (selectors.js#noteFor). A
 * figure inside it comes from the module, not from the copy — a translator
 * should never be the one holding a number. */
function noteHtml(module) {
  if (!module.note) return '';
  const text = t(`impact.note.${module.note.key}`).replace(
    '{planned}',
    formatNumber(module.planned ?? null, getLocale()),
  );
  return `<p class="module__note">${text}</p>`;
}

/** Every document this module's claims rest on, as chips in one row: its data,
 * and — when the note came from somewhere else — the note's own. `sources` is
 * for a card built from several rows at once (the Adoption context grid), where
 * one chip per row is the only honest count. */
function sourcesOf(module) {
  return [
    module.source,
    ...(module.sources ?? []),
    module.note?.source,
    module.target?.source,
  ].filter(Boolean);
}

function sourcesHtml(module, index) {
  const chips = sourcesOf(module)
    .map((source, slot) => `<span data-chip="${index}-${slot}"></span>`)
    .join('');
  return chips ? `<div class="module__sources">${chips}</div>` : '';
}

/** How close the newest ring already is to the city's sourced target — pure
 * arithmetic over two sourced figures (never a guessed target, see
 * selectors.js#modalSplitTargetForCity), stated as "already met" or the points
 * still to close. When the target is not measuring the same thing as the actual
 * data (`comparable: false`, e.g. Paris's different survey population), it says
 * so instead of a gap that would imply a comparison the sources do not support. */
function targetHtml(module) {
  const { target, modes, rings } = module;
  const latest = rings[rings.length - 1];
  const primary = target?.segments[0];
  if (!latest || !primary?.actualModes) return '';
  const actual = primary.actualModes.reduce((sum, mode) => {
    const i = modes.indexOf(mode);
    return sum + (i === -1 ? 0 : latest.values[i]);
  }, 0);
  if (target.comparable === false) {
    const text = t('impact.modalSplitProgress.notComparable').replace('{actual}', String(actual));
    return `<p class="module__target">${text}</p>`;
  }
  const gap = primary.share - actual;
  const key = gap <= 0 ? 'impact.modalSplitProgress.met' : 'impact.modalSplitProgress.gap';
  const text = t(key)
    .replace('{actual}', String(actual))
    .replace('{target}', targetShare(primary))
    .replace('{year}', String(target.year))
    .replace('{gap}', String(Math.abs(gap)));
  return `<p class="module__target">${text}</p>`;
}

/** How the target's own source words it. Cologne's strategy paper sets the goal
 * as a fraction — two-thirds of all trips — so that is what the card says; the
 * rounded 67 behind it is what the gap is worked out from, not what is quoted.
 * A target with no wording of its own is stated as its percentage. */
function targetShare(segment) {
  if (segment.shareKey) return t(`impact.modalSplitTarget.${segment.shareKey}`);
  return t('impact.modalSplitTarget.share').replace('{share}', String(segment.share));
}
