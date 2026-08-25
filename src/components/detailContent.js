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
//
// A module renders twice over its life: small, in the L2 arrangement, and again
// large once it is opened into the L3 focus slot. `expanded` is that second
// reading — the same content with the room to state itself (charts drawn with
// their axes rather than as sparklines), plus the in-depth block underneath.
// That block is a placeholder shell today, tracked in docs/DATA_TODO.md: the
// extended text is not written yet, and a card that invented some would be
// exactly the fabricated content the empty-shell rule exists to prevent.

import { t, getLocale, hasString } from '../lib/i18n.js';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatHostname,
} from '../lib/format.js';
import * as lineChart from './lineChart.js';
import * as timelineChart from './timelineChart.js';
import * as milestoneChart from './milestoneChart.js';
import * as modalSplitChart from './modalSplitChart.js';
import * as sourceChip from './sourceChip.js';

// What each kind of module draws. Hoisted out of moduleHtml so that the widget
// standing on a card at L1 can draw the same body without the frame around it
// (modulePreviewHtml).
const BODIES = {
  cost: costBody,
  donut: donutBody,
  lines: linesBody,
  breakdown: breakdownBody,
  trend: trendBody,
  prose: proseBody,
  facts: factsBody,
  linkGroups: linkGroupsBody,
  policy: policyBody,
  timeline: timelineBody,
  milestones: milestonesBody,
  targets: targetsBody,
  points: pointsBody,
  placeholder: placeholderBody,
};

/** What a widget shows when it stands on a card, where the whole card is too
 * much for it. Only the cost card needs one so far: its body is a figure, four
 * itemised lines and a disclaimer, and the lines scroll inside a 320px widget.
 * Anything without an entry here shows its body unchanged. */
const PREVIEWS = {
  cost: costPreview,
};

/** A module's body alone: its figure, its chart, its legend, and nothing around
 * them — no label, no closing sentence, no source chips, no controls. This is
 * what an L1 widget stands on, so that opening it reads as the same card given
 * more room rather than as a second, different thing.
 *
 * `index` names the module's chart and chip slots. A preview is drawn once, in
 * one widget, so it takes the slot no card uses. */
export function modulePreviewHtml(module, index = -1) {
  if (!module?.kind) return '';
  const body = PREVIEWS[module.kind] ?? BODIES[module.kind];
  return body ? body(module, index, false) : '';
}

/** One module's card. `index` names its slots (`data-chart="3"`), so the
 * mounting pass below can find them without the module knowing where it sits.
 * `expanded` is the L3 reading of the same module — see the note at the top of
 * this file. */
export function moduleHtml(module, index, expanded = false) {
  if (!module || !module.kind) return '';
  const body = BODIES[module.kind];
  if (!body) return '';
  return `
    ${expandHtml(module, index, expanded)}
    ${labelHtml(module, index)}
    ${body(module, index, expanded)}
    ${noteHtml(module)}
    ${expanded && module.detailKey ? inDepthHtml(module) : ''}
    ${sourcesHtml(module, index)}`;
}

/** The control that opens a module into the focus slot, and closes it again.
 *
 * A real button rather than a role on the card: a card holds links and a chart
 * that answers the pointer, and interactive content inside something announcing
 * itself as a button is both invalid and unusable with a screen reader. The card
 * still answers a click on its own background (widgetStack.js) — that is the
 * mouse affordance; this is the one a keyboard and a screen reader can reach.
 *
 * The glyph is decorative and hidden: what is spoken is the label, which names
 * the card it acts on, because "Expand" on its own says nothing about which of
 * six cards is about to open. */
function expandHtml(module, index, expanded) {
  const label = t(expanded ? 'module.collapse' : 'module.expand').replace(
    '{label}',
    moduleLabel(module, index),
  );
  return `
    <button type="button" class="module__expand" data-expand aria-expanded="${expanded}" aria-label="${label}">
      <span aria-hidden="true">${expanded ? '\u2921' : '\u2922'}</span>
    </button>`;
}

/** The block the opened card ends on: what stands behind its figures — how they
 * were collected, what the numbers do and do not say.
 *
 * Both halves are the card's own (`impact.detail.modalSplit` and its heading),
 * and both fall back: a card with nothing written yet keeps the generic heading
 * and says so in as many words, rather than leaving a blank half-card that reads
 * as a rendering fault. An empty shell is honest; an accidental-looking one is
 * not (docs/DATA_TODO.md). */
function inDepthHtml(module) {
  const heading =
    module.detailTitleKey && hasString(module.detailTitleKey)
      ? t(module.detailTitleKey)
      : t('module.inDepth');
  const written = module.detailKey && hasString(module.detailKey);
  const body = written
    ? `<p class="module__in-depth-text">${t(module.detailKey)}</p>`
    : `<p class="module__in-depth-empty">${t('module.inDepth.pending')}</p>`;
  return `
    <section class="module__in-depth">
      <h3 class="module__in-depth-heading">${heading}</h3>
      ${body}
    </section>`;
}

/** The card's own heading, and the info point that explains it. `labelCode`
 * fills the `{code}` an SDG-target heading carries; a block that leads with its
 * own text (an intro paragraph) has no label at all rather than a repeated one —
 * but it still carries its info point, on a heading row with nothing else in
 * it, because a card is no less in need of explaining for having no title. */
function labelHtml(module, index) {
  const info = infoHtml(module, index);
  if (!module.labelKey) {
    return info ? `<span class="module__label module__label--bare">${info}</span>` : '';
  }
  return `<span class="module__label">${moduleLabel(module, index)}${info}</span>`;
}

/** What this card is, and how to read it — behind an ⓘ beside the title, opened
 * by hovering it or by reaching it with a keyboard (.link-hint, base.css: the
 * same mechanism the source chips use for their citation).
 *
 * The copy is per card (`impact.info.car`, `adoption.info.cost`, …) and most of
 * it is not written yet, so a card whose key has nothing behind it says exactly
 * that rather than showing the raw key — and gains its real text the moment the
 * entry is added, with nothing here to change. */
function infoHtml(module, index) {
  if (!module.infoKey) return '';
  return infoPoint(`module-info-${index}`, module.infoKey, moduleLabel(module, index));
}

/** One ⓘ. A card's title carries one, and so does each box on the SDGs card —
 * same control, same floating hint, different thing being named, so the id and
 * the accessible name are passed in rather than derived from a card.
 * @param {string} id unique on the page; the hint's id, which aria-describedby points at
 * @param {string} key i18n key of the text; unwritten keys show the pending line
 * @param {string} label what the ⓘ is about, for the accessible name
 */
function infoPoint(id, key, label) {
  const text = hasString(key) ? t(key) : t('module.info.pending');
  const about = t('module.info.about').replace('{label}', label);
  return `<button type="button" class="module__info" data-hint aria-label="${about}" aria-describedby="${id}">
      <span class="module__info-mark" aria-hidden="true">i</span>
      <span class="link-hint" role="tooltip" id="${id}">${text}</span>
    </button>`;
}

/** What this card is called, for a heading or for a control that names it. The
 * cards that lead with their own prose carry no label of their own, so a control
 * that has to name one falls back to the card's place in the reading order —
 * "Expand" alone would not say which of six is about to open. */
function moduleLabel({ labelKey, labelCode }, index) {
  if (!labelKey) return t('module.card').replace('{n}', String(index + 1));
  return t(labelKey).replace('{code}', labelCode ?? '');
}

/** Mount every module's live pieces. Called once the scaffold's markup is in
 * the DOM; pushes each child handle so the region can destroy them together.
 * `expandedIndex` is the module standing in the focus slot, or -1 for none. */
export function mountModuleExtras(root, modules, children, expandedIndex = -1) {
  modules.forEach((module, index) =>
    mountModule(root, module, index, children, index === expandedIndex),
  );
}

/** One module's live pieces. Separate from the loop above because a module can
 * be rebuilt on its own — opening one into the focus slot re-renders that card
 * and nothing else, so its chart is remounted at the size it now has. Every
 * handle is tagged with the module it belongs to, which is what lets the region
 * destroy one card's children without touching the other five. */
export function mountModule(root, module, index, children, expanded = false) {
  if (!module || !module.kind) return;
  const locale = getLocale();
  mountChart(root, module, index, children, expanded);
  if (ACCORDIONS.has(module.kind)) children.push({ index, handle: mountAccordion(root, index) });
  for (const [slot, source] of sourcesOf(module).entries()) {
    const node = root.querySelector(`[data-chip="${index}-${slot}"]`);
    if (node) children.push({ index, handle: sourceChip.render(node, { ...source, locale }) });
  }
}

// The kinds whose cards hold a list of disclosures, and so want one open at a
// time (mountAccordion).
const ACCORDIONS = new Set(['policy', 'linkGroups']);

/** One disclosure open at a time. Five of them, each holding two paragraphs,
 * and a card that is already the tallest in its criterion: left free, opening a
 * third pushed the arrangement well past the region and the reader lost the one
 * they had come for. The <details> keep doing the work; this only closes the
 * others when one is opened.
 * @returns {{ update(): void, destroy(): void }}
 */
function mountAccordion(root, index) {
  const section = root.querySelector(`[data-accordion="${index}"]`);
  const items = section ? [...section.querySelectorAll('details')] : [];
  // `toggle` does not bubble, so each one is listened to rather than the section.
  const onToggle = (event) => {
    if (!event.target.open) return;
    for (const other of items) if (other !== event.target) other.open = false;
  };
  for (const item of items) item.addEventListener('toggle', onToggle);

  // A link inside a summary is still inside a summary: the click would reach it
  // and open the terms as well as the page. Held here rather than on the anchor
  // itself so it is torn down with everything else this mounts.
  const links = section ? [...section.querySelectorAll('summary .module__programme-link')] : [];
  const keepToClick = (event) => event.stopPropagation();
  for (const link of links) link.addEventListener('click', keepToClick);

  return {
    update() {},
    destroy() {
      for (const item of items) item.removeEventListener('toggle', onToggle);
      for (const link of links) link.removeEventListener('click', keepToClick);
    },
  };
}

/** The one chart a module carries, if it carries one. Compact everywhere except
 * the focus slot: `compact` is what drops a line chart's axes and a donut's year
 * pills, which is the right trade in a 300px card and the wrong one in a card
 * with room for them. */
function mountChart(root, module, index, children, expanded) {
  if (module.kind === 'timeline') {
    const slot = root.querySelector(`[data-timeline="${index}"]`);
    if (slot) {
      children.push({
        index,
        handle: timelineChart.render(slot, {
          events: module.events,
          phases: module.phases,
          expanded,
        }),
      });
    }
    return;
  }
  if (module.kind === 'milestones') {
    const slot = root.querySelector(`[data-milestones="${index}"]`);
    if (slot) {
      children.push({
        index,
        handle: milestoneChart.render(slot, { years: module.years, expanded }),
      });
    }
    return;
  }
  const slot = root.querySelector(`[data-chart="${index}"]`);
  if (!slot) return;
  const compact = !expanded;
  if (module.kind === 'donut') {
    children.push({
      index,
      handle: modalSplitChart.render(slot, {
        modes: module.modes,
        labels: module.modes.map((mode) => t(`impact.mode.${mode}`)),
        rings: module.rings,
        ariaLabel: donutAriaLabel(module),
        compact,
      }),
    });
    return;
  }
  children.push({
    index,
    handle: lineChart.render(slot, {
      lines: module.lines,
      unit: module.unit,
      locale: getLocale(),
      compact,
      // The card states the unit over the chart where it has words for it, so
      // the axis does not repeat it as a bare symbol. The chart keeps the unit
      // either way — its tooltips and its spoken summary are built from it.
      unitLabel: !module.unitKey,
    }),
  });
}

/** Spoken summary of the donut — the newest ring, per mode. */
function donutAriaLabel({ labelKey, modes, rings, latestYear }) {
  const latest = rings[rings.length - 1];
  if (!latest) return t(labelKey);
  const parts = modes.map((mode, i) => `${t(`impact.mode.${mode}`)} ${latest.values[i]}%`);
  return `${t(labelKey)} ${latestYear}: ${parts.join(', ')}`;
}

// --- bodies, one per kind --------------------------------------------------

/** What the project cost: the one figure the city published, what it bought, and
 * the derived per-km rate under it.
 *
 * It used to itemise what the sum covered and the three lines nobody published a
 * figure for, each an em dash. That account now lives where it reads better —
 * the info point says what the figure covers, and the card's Quellen block says
 * which costs were never published separately — so the card itself is the figure
 * and its rate. The rate is filled in here rather than written into the copy: a
 * translator should never be the one holding a number. */
function costBody(module) {
  const locale = getLocale();
  return `
    <p class="module__value">
      <b>${formatCurrencyCompact(module.headline.value, locale)}</b>
      ${costScope(module, locale)}
      ${module.headline.year ? `<span class="module__year">${module.headline.year}</span>` : ''}
    </p>
    <p class="module__note">${costDisclaimer(module, locale)}</p>`;
}

/** The cost card's figure and what it covers, without the itemised lines under
 * it or the disclaimer under those. What a widget standing on this card shows:
 * the sum, the length it bought and the year — the part that reads at a glance,
 * with the part that needs reading left to the card itself. */
function costPreview(module) {
  const locale = getLocale();
  return `
    <p class="module__value">
      <b>${formatCurrencyCompact(module.headline.value, locale)}</b>
      ${costScope(module, locale)}
      ${module.headline.year ? `<span class="module__year">${module.headline.year}</span>` : ''}
    </p>`;
}

/** The Politik card: who steered the project and who pushed it, side by side,
 * and under them what the people who ran it would tell the next city.
 *
 * The recommendations are the reason this card exists, and they are long — five
 * of them, each with what Cologne did and what to take from it. In a column
 * they are named and nothing more; opened, each name carries the sentence that
 * summarises it and a disclosure holding the rest. Native <details>, so the
 * keyboard and the screen reader come with it; one at a time, so the card does
 * not grow past the region every time another is opened (mountAccordion). */
function policyBody(module, index, expanded) {
  return `
    <div class="module__policy-who">
      ${namedList('adoption.politics.authorities', module.authorities)}
      ${namedList('adoption.politics.participation', module.members, module.alliance)}
    </div>
    <section class="module__panel module__policy-advice" data-accordion="${index}">
      <h3 class="module__link-heading">${t('adoption.politics.recommendations')}</h3>
      ${module.recommendations.map((item) => recommendationHtml(item, expanded)).join('')}
    </section>`;
}

/** One of the two name panels at the top of the Politik card: a heading and the
 * names under it, in a box of its own. The card's three sections are three
 * boxes — the same surface the Kontext card's tiles use, one to a category
 * rather than one to an entry, so a name is a line and not a box inside a box.
 *
 * `lead` is the alliance the names belong to, which stands above them rather
 * than among them: #RingFrei is not a seventh organisation, it is the six of
 * them together. A name with a page worth opening is the link. */
function namedList(headingKey, entries, lead = null) {
  const line = (entry) =>
    `<li class="module__link-item">${entry.url ? outboundLink(entry.url, t(entry.textKey)) : t(entry.textKey)}</li>`;
  return `
    <div class="module__panel module__policy-list">
      <h3 class="module__link-heading">${t(headingKey)}</h3>
      ${lead ? `<p class="module__policy-lead">${lead.url ? outboundLink(lead.url, t(lead.textKey)) : t(lead.textKey)}</p>` : ''}
      <ul class="module__links">${entries.map(line).join('')}</ul>
    </div>`;
}

/** One recommendation. Named in a column; opened, the name carries its sentence
 * and a disclosure holding what Cologne did and what to learn from it. */
function recommendationHtml(item, expanded) {
  const title = t(item.titleKey);
  if (!expanded) return `<p class="module__toggle-title">${title}</p>`;
  return `
    <details class="module__toggle">
      <summary class="module__toggle-summary">
        <span class="module__toggle-title">${title}</span>
        <span class="module__toggle-lead">${t(item.claimKey)}</span>
      </summary>
      <p class="module__prose">${t(item.exampleKey)}</p>
      <p class="module__prose">${t(item.lessonKey)}</p>
    </details>`;
}

/** The Timeline card: the chart, and nothing around it. The phases used to be
 * named above the track; they are bands inside it now, which is where they
 * belong — a phase is a stretch of the story, not a key to it. */
function timelineBody(module, index) {
  return `<div class="module__timeline" data-timeline="${index}"></div>`;
}

/** The SDGs card: every SDG 11 target the project addresses, each with the line
 * saying how. The same copy the L1 widget headlines with — one card holding
 * both, rather than a card each, which is what the six-card arrangement used to
 * spend two of its slots on. */
/** The SDG 11 targets a project addresses, one box each: the target's number,
 * an ⓘ carrying its official wording, and what this project does about it.
 *
 * The boxes stand side by side in an opened card and stack in a column, which is
 * the grid's own doing (widgets.css) — two of these paragraphs at a column's
 * width would be two very narrow measures.
 *
 * The lead is guarded rather than assumed: a city whose lead sentence is not
 * written yet gets the boxes with no lead, not the raw i18n key, which is how
 * an unwritten ⓘ behaves too.
 */
function targetsBody(module, index) {
  const lead =
    module.leadKey && hasString(module.leadKey)
      ? `<p class="module__lead">${t(module.leadKey)}</p>`
      : '';
  const items = module.targets
    .map((target, slot) => {
      const heading = t('problemFit.targetHeading').replace('{code}', target.code);
      const info = target.infoKey
        ? infoPoint(`module-info-${index}-target-${slot}`, target.infoKey, heading)
        : '';
      return `
      <li class="module__target-item module__panel">
        <span class="module__target-code">${heading}${info}</span>
        <p class="module__prose">${t(target.textKey)}</p>
      </li>`;
    })
    .join('');
  return `${lead}<ul class="module__targets">${items}</ul>`;
}

/** A numbered plan, at the card's two depths: in a column each point is its one
 * short line, opened each point is the demand in full. One or the other, never
 * both — the short line is a shortening of the long one, so showing the pair
 * together would say everything twice.
 *
 * The number comes from a CSS counter on a real <ol>, so the list is numbered
 * for a screen reader by being a numbered list, not by ten hardcoded digits. */
function pointsBody(module, index, expanded) {
  const items = module.points
    .map((point) =>
      expanded
        ? `<li class="module__point"><p class="module__prose">${t(point.textKey)}</p></li>`
        : `<li class="module__point"><span class="module__point-title">${t(point.shortKey)}</span></li>`,
    )
    .join('');
  return `<ol class="module__points">${items}</ol>`;
}

/** The milestone card: the line, and nothing around it. */
function milestonesBody(module, index) {
  return `<div class="module__milestones" data-milestones="${index}"></div>`;
}

/** A card that is named but not yet researched — Politik, Timeline. It says so
 * in as many words rather than standing blank, which is what an *empty shell*
 * does: a shell is a topic this city has no rows for and may never have, while
 * this is one nobody has looked into yet for anywhere. Same dashed outline the
 * unwritten in-depth block uses, so "nothing here yet" reads the same way
 * wherever it appears. */
function placeholderBody() {
  return `<p class="module__in-depth-empty">${t('module.placeholder')}</p>`;
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
function donutBody(module, index, expanded) {
  return `
    <div class="module__split">
      <div class="module__donut" data-chart="${index}"></div>
      ${matrixHtml(module)}
    </div>
    ${targetHtml(module, expanded)}`;
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
  // A single line states its unit beside its own latest figure. Several lines
  // have no such figure — the legend carries one number per series and none of
  // them says what it is measured in — so the unit is stated once, above the
  // chart, for all of them.
  return `
    ${single ? headlineHtml(module.latest.value, module.unit, module.latest.year) : unitHtml(module)}
    <div class="module__chart" data-chart="${index}"></div>
    ${single ? '' : legendHtml(items)}`;
}

/** The unit a chart's values are read in, above the chart. Spelled out where
 * the module names copy for it (`unitKey`) — a symbol is only a reminder to
 * someone who already knows it — with the symbol itself filled in from the
 * data, so the words and what they describe cannot drift apart. */
function unitHtml({ unit, unitKey }) {
  if (!unit) return '';
  const text = unitKey ? t(unitKey).replace('{unit}', unit) : unit;
  return `<p class="module__series-unit">${text}</p>`;
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
    <p class="module__series-unit">${module.unit}</p>
    <div class="module__trend">${points}</div>`;
}

/** A Problem Fit block. The block's lead-in term — "The Rings", "Goal" — is the
 * card's own label, so what is left here is the paragraph under it; the copy is
 * the same i18n entries the L1 widget's targets already use. */
/** Plain copy: one paragraph (`text`) or several (`paragraphs`, in reading
 * order). Kept as separate <p>s rather than one block with breaks, because the
 * measure and the paragraph spacing are what make four paragraphs readable at
 * L3 — and because a screen reader announces them as four things to move
 * between rather than one long run. */
function proseBody(module) {
  const keys = module.paragraphs ?? [module.text];
  return keys.map((key) => `<p class="module__prose">${t(key)}</p>`).join('');
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

/** The funding routes, grouped by the level of government that offers them. A
 * group's `plain` entries are routes rather than programmes — "sponsorship" has
 * no page to open — so they are named without a link rather than given one that
 * points nowhere in particular. */
function linkGroupsBody(module, index) {
  const groups = module.groups
    .map(
      (group) => `
      <li class="module__link-group">
        <h3 class="module__link-heading">${t(group.headingKey)}</h3>
        <ul class="module__links">
          ${group.links.map((link) => programmeHtml(link.textKey, link.url)).join('')}
          ${group.plain.map((key) => programmeHtml(key, null)).join('')}
        </ul>
      </li>`,
    )
    .join('');
  return `<div class="module__scroll" data-accordion="${index}"><ul class="module__link-groups">${groups}</ul></div>`;
}

/** One funding route. Where its terms have been written down it opens into
 * them — what the programme is, what share it pays, and how a city gets at it;
 * where they have not, it is its name and nothing more.
 *
 * The programme's own page goes *inside* the disclosure rather than on the name.
 * A summary that is both a link and a toggle is ambiguous to click and invalid
 * to nest, so the name opens the terms and the page is a line under them. */
function programmeHtml(textKey, url) {
  const name = t(textKey);
  // The page sits beside the name as the same outbound arrow every source on
  // these cards carries, not inside the disclosure and not on the name itself:
  // a summary that is both a link and a toggle is ambiguous to click and invalid
  // to nest, and a link buried three paragraphs down is a link nobody finds.
  const page = url ? programmeLink(url, name) : '';
  if (!hasString(`${textKey}.details`)) {
    return `<li class="module__programme"><span class="module__link-item">${name}</span>${page}</li>`;
  }
  const field = (labelKey, key) => `
    <p class="module__prose">
      <b class="module__toggle-field">${t(labelKey)}</b>
      ${t(`${textKey}.${key}`)}
    </p>`;
  // The arrow rides in the summary, beside the name it belongs to. Outside the
  // disclosure it was pushed to the far edge of the card, because the disclosure
  // has to be full width for the paragraphs inside it — which put the link a
  // long way from the thing it opens. Its click is kept from reaching the
  // summary (mountAccordion), so following it does not also toggle the terms.
  return `
    <li class="module__programme">
      <details class="module__toggle">
        <summary class="module__toggle-summary module__toggle-summary--row">
          <span class="module__toggle-title">${name}</span>
          ${page}
        </summary>
        ${field('adoption.funding.detailsLabel', 'details')}
        ${field('adoption.funding.quoteLabel', 'quote')}
        ${field('adoption.funding.accessLabel', 'access')}
      </details>
    </li>`;
}

/** The arrow beside a programme's name. Named for a screen reader, which gets
 * "Programme page: Interreg" rather than a bare arrow, and carrying the host as
 * its hint like every other outbound link here. */
function programmeLink(url, name) {
  const label = `${t('adoption.funding.programmePage')}: ${name}`;
  return `<a class="source-chip module__programme-link" data-hint href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><span class="link-hint" aria-hidden="true">${formatHostname(url)}</span></a>`;
}

/** An outbound link with the host on it, the way every other one on these cards
 * carries it (hintLayer.js draws the hint). */
function outboundLink(url, text) {
  return `<a class="module__link" data-hint href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${text}<span class="link-hint" aria-hidden="true">${formatHostname(url)}</span></a>`;
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
  const text = t(`impact.note.${module.note.key}`)
    .replace('{planned}', formatNumber(module.planned ?? null, getLocale()))
    // How far the line has moved, and from when (selectors.js#seriesChange).
    // Derived from the series at render time, so a sentence quoting it says what
    // the chart above it shows rather than what it said when it was written.
    .replace('{change}', formatNumber(module.change?.percent ?? null, getLocale()))
    .replace('{since}', String(module.change?.since ?? ''));
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
function targetHtml(module, expanded) {
  const { target, modes, rings, latestYear } = module;
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
  const text = t(progressKey(gap, target, expanded))
    .replace('{actual}', String(actual))
    .replace('{latest}', String(latestYear ?? latest.year))
    .replace('{target}', targetShare(primary))
    .replace('{year}', String(target.year))
    .replace('{gap}', String(Math.abs(gap)))
    .replace('{period}', target.periodKey ? t(target.periodKey) : String(target.year))
    .replace('{strategy}', target.strategyKey ? t(target.strategyKey) : '');
  return `<p class="module__target">${text}</p>`;
}

/** Which reading of the sentence to state. The opened card has room for the one
 * that names the plan the target comes from and the period it runs over, so it
 * gets it — but only where the target says what those are. A city whose target
 * has no such wording keeps the short sentence at both sizes rather than being
 * given a longer one with holes in it. */
function progressKey(gap, target, expanded) {
  if (gap > 0) return 'impact.modalSplitProgress.gap';
  const full = expanded && target.periodKey && target.strategyKey;
  return full ? 'impact.modalSplitProgress.metLong' : 'impact.modalSplitProgress.met';
}

/** How the target's own source words it. Cologne's strategy paper sets the goal
 * as a fraction — two-thirds of all trips — so that is what the card says; the
 * rounded 67 behind it is what the gap is worked out from, not what is quoted.
 * A target with no wording of its own is stated as its percentage. */
function targetShare(segment) {
  if (segment.shareKey) return t(`impact.modalSplitTarget.${segment.shareKey}`);
  return t('impact.modalSplitTarget.share').replace('{share}', String(segment.share));
}
