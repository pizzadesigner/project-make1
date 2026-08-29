// Pure lookups over the loaded dataset. Views use these to pull the slice they
// need; nothing here touches the store or the DOM.

// The first year the L2 modules show. `cities.csv` keeps every sourced year it
// ever had — Cologne's modal split reaches back to 1982 — but a module is a
// ~310x230px card, and a chart that spans forty years spends most of its width
// on a period no reader is deciding anything about. 2015 is where the decade
// this project is being judged over starts (project decision 2026-08-23,
// `newDes/txtModel.odt`), and it is the same cut for every series so two
// modules side by side always cover the same span. One constant rather than a
// filter written into each selector: moving the window is one edit, and no
// sourced row is ever deleted to make it happen.
const SERIES_START_YEAR = 2015;

/** Rows inside the display window, oldest year first. A row with no year (a
 * standing figure like the cycle network's length) is kept — the window is
 * about series, not about dropping undated facts. */
function withinWindow(rows) {
  return rows
    .filter((row) => row.year == null || row.year >= SERIES_START_YEAR)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

// Which Impact sub-metric a city surfaces as its L1 headline figure, by
// sub-metric key: Cologne → its cycle network, Paris → its car-ownership share.
// A city absent from this map shows an empty widget rather than a fabricated
// number. This mapping lives in the data layer, not in `widgetStack.js`, because
// "which indicator stands for this city" is a data decision — the widget renders
// whatever it is handed and knows nothing about city slugs.
const IMPACT_HEADLINE_METRIC = {
  koeln: 'cycleNetwork',
  'paris-marne-la-vallee': 'carOwnership',
};

/**
 * Headline figure for each of the three Exploration widgets (Problem Fit /
 * Impact / Adoption Requirements) — the single seam feeding the L1 widget stack.
 *
 * Each field is either null (the widget renders an empty shell — never a
 * fabricated number, see docs/DESIGN_RATIONALE.md) or `{ key, value, unit }`,
 * where `key` names the figure for the label (resolved by the view, `impact.<key>`
 * for Impact's sub-metrics) and may be null when the widget's own title says it.
 *
 * TODO(data): Problem Fit and Adoption have no researched backing field at any
 * city yet, so both are still null everywhere — see docs/research.md §5.4. Impact
 * is wired for the two cities that have a sourced sub-metric.
 * @param {import('./types.js').Project|null} project
 * @param {ReturnType<typeof impactSubMetrics>} [subMetrics] as built for the same city
 * @returns {{ problemFit: WidgetMetric, impact: WidgetMetric, adoption: WidgetMetric }}
 * @typedef {{ key: string|null, value: number, unit: string|null }|null} WidgetMetric
 */
export function widgetMetricsForProject(project = null, subMetrics = []) {
  return {
    problemFit: null,
    impact: impactHeadline(project?.citySlug ?? null, subMetrics),
    adoption: null,
  };
}

/** The figure for a city's L1 Impact widget, or null when the city has none
 * configured or the metric isn't sourced. A year series (car ownership)
 * headlines with its latest value; a single figure (cycle network) as-is. */
function impactHeadline(citySlug, subMetrics) {
  const key = IMPACT_HEADLINE_METRIC[citySlug];
  if (!key) return null;
  const metric = subMetrics.find((entry) => entry.key === key);
  if (!metric || metric.value == null) return null;
  const value = Array.isArray(metric.value)
    ? metric.value[metric.value.length - 1].value
    : metric.value;
  return { key, value, unit: metric.unit };
}

/**
 * Every researched indicator for one city (population, area, green-space share,
 * …), in file order. Keyed by citySlug so a focused city can pull its own
 * context regardless of whether its project row is real or a placeholder.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {import('./types.js').CityIndicator[]}
 */
export function cityIndicatorsForCity(cityIndicators, citySlug) {
  return cityIndicators.filter((indicator) => indicator.citySlug === citySlug);
}

/**
 * The value of a single indicator for a city, or null if it is absent.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @param {string} indicatorKey
 * @returns {number|null}
 */
export function cityIndicatorValue(cityIndicators, citySlug, indicatorKey) {
  const match = cityIndicators.find(
    (indicator) => indicator.citySlug === citySlug && indicator.indicatorKey === indicatorKey,
  );
  return match ? match.value : null;
}

/**
 * Population density (people/km²), derived from the population and area
 * indicators. The research source computes it the same way ("Population /
 * Area"), so it is not stored as its own sourced row — it inherits the
 * provenance of population and area. Returns null if either input is missing or
 * the area is zero.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {number|null}
 */
export function populationDensityForCity(cityIndicators, citySlug) {
  const population = cityIndicatorValue(cityIndicators, citySlug, 'population');
  const area = cityIndicatorValue(cityIndicators, citySlug, 'area_km2');
  if (population === null || area === null || area === 0) return null;
  return population / area;
}

// The Impact widget's L2 sub-metrics are Modal split, Car density and Cycle
// network (per `designWidgets.png`; Lisbon's different trio is not modelled
// yet). Labels resolve via `impact.<key>` in the i18n bundles.
//
// Modal-split transport modes, in the donut's segment order (matches the
// `modal_split_<mode>` indicator keys in cities.csv). Labels: `impact.mode.<mode>`.
// `moto` (motorized two-wheelers) only has rows for Paris so far — missing
// modes default to 0 (see `valueAt` below), so Cologne's rings are unaffected.
const MODAL_SPLIT_MODES = ['transit', 'bike', 'walk', 'car', 'moto'];

/**
 * A city's sourced year series for one indicator key, oldest year first. Used
 * for the Impact "car" slot, which is a different indicator per city — Cologne
 * has `car_density` (vehicles per 1000 residents), Paris `car_ownership`
 * (% of households with a car) — so each city's own `unit` travels with its
 * series rather than being assumed. Empty series and null source when absent.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @param {string} [indicatorKey]
 * @returns {{ series: {year: number, value: number}[], unit: string|null, source: {url: string, label: string, accessed: string|null}|null }}
 */
export function carDensitySeriesForCity(cityIndicators, citySlug, indicatorKey = 'car_density') {
  const rows = withinWindow(
    cityIndicatorsForCity(cityIndicators, citySlug).filter(
      (indicator) => indicator.indicatorKey === indicatorKey,
    ),
  );
  const [first, ...rest] = rows;
  return {
    series: rows.map((row) => ({ year: row.year, value: row.value })),
    unit: first?.unit ?? null,
    source: first ? sourceOfRow(first) : null,
    // Every other document the line is drawn from. A series is one row per year
    // and the years need not share a source — Cologne's car density is the
    // statistical yearbook up to 2023 and the registration page after it — so
    // citing the earliest row alone would leave the newest points, the ones the
    // figure at the top of the card is taken from, resting on a document the
    // card never names.
    sources: distinctSources(rest, first),
  };
}

function sourceOfRow(row) {
  return { url: row.sourceUrl, label: row.sourceLabel, accessed: row.sourceAccessed };
}

/** The sources among `rows` that `first` does not already stand for, once each.
 * A chip per row would be eleven chips for one line. */
function distinctSources(rows, first) {
  const seen = new Set([first?.sourceUrl]);
  const sources = [];
  for (const row of rows) {
    if (seen.has(row.sourceUrl)) continue;
    seen.add(row.sourceUrl);
    sources.push(sourceOfRow(row));
  }
  return sources;
}

// The Impact "car" slot is one of two genuinely different indicators depending
// on the city: car density (vehicles per 1000 residents) or car ownership
// (% of households with a car). Each keeps its own sub-metric key so it carries
// the right, non-misleading label. First one with rows wins.
const CAR_SLOT_INDICATORS = [
  { indicatorKey: 'car_density', metric: 'carDensity' },
  { indicatorKey: 'car_ownership', metric: 'carOwnership' },
];

/** The car sub-metric for a city — density or ownership, whichever it has —
 * tagged with the metric key that names it. Null when the city has neither. */
function carSlotForCity(cityIndicators, citySlug) {
  for (const { indicatorKey, metric } of CAR_SLOT_INDICATORS) {
    const { series, unit, source, sources } = carDensitySeriesForCity(
      cityIndicators,
      citySlug,
      indicatorKey,
    );
    if (series.length > 0) return { metric, series, unit, source, sources };
  }
  return null;
}

/**
 * A city's modal split as concentric rings (one per year, oldest first), for the
 * donut. Pivots the long-format `modal_split_<mode>` rows into per-year values in
 * fixed mode order. Null for cities without modal-split rows.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {{ modes: string[], rings: {year: number, values: number[]}[], latestYear: number|null, source: {url: string, label: string, accessed: string|null} } | null}
 */
export function modalSplitForCity(cityIndicators, citySlug) {
  const rows = withinWindow(
    cityIndicatorsForCity(cityIndicators, citySlug).filter((indicator) =>
      indicator.indicatorKey.startsWith('modal_split_'),
    ),
  );
  if (rows.length === 0) return null;
  const years = [...new Set(rows.map((row) => row.year).filter((year) => year != null))].sort(
    (a, b) => a - b,
  );
  const valueAt = (year, mode) =>
    rows.find((row) => row.year === year && row.indicatorKey === `modal_split_${mode}`)?.value ?? 0;
  const [first] = rows;
  return {
    modes: MODAL_SPLIT_MODES,
    rings: years.map((year) => ({
      year,
      values: MODAL_SPLIT_MODES.map((mode) => valueAt(year, mode)),
    })),
    latestYear: years[years.length - 1] ?? null,
    source: { url: first.sourceUrl, label: first.sourceLabel, accessed: first.sourceAccessed },
  };
}

// A single, hand-picked lookup, not CSV-driven like the year-series
// indicators above — a strategic target is a one-off goal statement, not a
// repeated measurement. Only a city whose target has actually been opened and
// read (see docs/DATA_TODO.md) gets a row; every other city stays out rather
// than get a guessed number. This is the modal-split-specific edge of the gap
// benchmarkForIndicator / reductionPathwayForCity describe generally above —
// narrower, but sourced, so it doesn't wait on those.
//
// `segments` is the target ring's own two slices (always sums to 100 — that's
// a donut, not an extra claim). Each may carry `actualModes`: which of this
// city's real MODAL_SPLIT_MODES to sum from the latest actual ring for the
// progress line. `comparable: false` means that sum isn't measuring the same
// thing as the target (different survey/population) — widgetStack.js then
// shows a methodology caveat instead of a percentage comparison.
//
// `shareKey` is how the source itself words the target, as an i18n suffix
// (`impact.modalSplitTarget.<key>`). Cologne's strategy paper sets the goal as
// a fraction — „ein Anteil des Umweltverbunds von 2/3" — and a card that
// answered it with "67 %" would be quoting a number the document never wrote.
// `share` stays the rounded percentage because the gap arithmetic needs one;
// only the wording comes from here, and a target without a `shareKey` is
// stated as its percentage.
const MODAL_SPLIT_TARGETS = {
  koeln: {
    year: 2025,
    comparable: true,
    segments: [
      {
        mode: 'umweltverbund',
        share: 67,
        shareKey: 'twoThirds',
        actualModes: ['transit', 'bike', 'walk'],
      },
      { mode: 'car', share: 33 },
    ],
    // How the strategy names its own goal. The share is a number and comes from
    // the data above; the period it runs over and the plan it belongs to are
    // wording, and belong to the document rather than to a translator — the same
    // split `shareKey` already makes for "two-thirds" against 67.
    periodKey: 'impact.modalSplitTarget.period',
    strategyKey: 'impact.modalSplitTarget.strategy',
    source: {
      url: 'https://www.stadt-koeln.de/mediaasset/content/pdf66/dritter-nahverkehrsplan-12-2017.pdf',
      label: 'Stadt Köln – 3. Nahverkehrsplan (2017), zitiert „Köln mobil 2025“',
      accessed: '2026-08-18',
    },
  },
  // Paris has no full-split target — only one absolute, city-official share
  // (bike) is ever stated; car/transit are described as relative shifts
  // ("50% less road traffic"), never as target shares, so they can't be
  // recorded without inventing a number the source doesn't give. And the
  // 13% itself is benchmarked against an all-trips survey (EGT 2020), not
  // the home-to-work-commute survey behind this city's actual donut
  // (Insee RP2022) — comparable: false so the panel says so instead of
  // implying a clean percentage-point gap.
  'paris-marne-la-vallee': {
    year: 2030,
    comparable: false,
    segments: [
      { mode: 'bike', share: 13, actualModes: ['bike'] },
      { mode: 'other', share: 87 },
    ],
    source: {
      url: 'https://cdn.paris.fr/paris/2024/03/29/partie-3-scenario-prospectif-2030-vf-7ukO.pdf',
      label: 'Ville de Paris – Plan Local de Mobilité, Scénario prospectif 2030',
      accessed: '2026-08-18',
    },
  },
};

/**
 * A city's *target* modal split — the "how it should look" companion to
 * modalSplitForCity's "how it looks now" — as a two-segment ring (see
 * MODAL_SPLIT_TARGETS above for what each city's segments mean and whether
 * they're comparable to the real data). Null for every city without a
 * sourced, city-official target; widgetStack.js renders nothing extra in
 * that case — the same graceful-null pattern as every other sub-metric here.
 *
 * Rendered as a sentence rather than a second donut (detailContent.js#targetHtml):
 * an L2 module is ~310px wide, which fits one ring stack, and "3 points short of
 * the 2025 target" is a comparison — it reads better stated than as two shapes to
 * eyeball against each other.
 *
 * To remove this feature: delete this constant + function, the `target` field
 * impactModules puts on the modal-split module, `targetHtml` and its
 * `.module__target` rule in widgets.css, and the `impact.modalSplitProgress.*`
 * i18n keys. Nothing else depends on any of it.
 * @param {string|null} citySlug
 * @returns {{ year: number, comparable: boolean, segments: { mode: string, share: number, shareKey?: string, actualModes?: string[] }[], source: { url: string, label: string, accessed: string } } | null}
 */
export function modalSplitTargetForCity(citySlug) {
  return (citySlug && MODAL_SPLIT_TARGETS[citySlug]) ?? null;
}

// The Problem Fit widget's content, per city. Only structure lives here; the
// prose is translated copy in i18n keyed by slug (`problemFit.<slug>.*`), the
// same division modalSplitProgress keeps between data and text. Two pieces:
//  - `targets`: the SDG 11 codes the project addresses, each with a one-line
//    explanation keyed `problemFit.<slug>.target.<code>`.
//  - `summary`: the block ids of the Problem Fit card's paragraphs, in reading
//    order, each keyed `problemFit.<slug>.summary.<id>`. Ids rather than a
//    count, so a paragraph can be reordered or dropped without silently
//    renumbering the three after it — and so the key says what it holds.
//  - `planPoints`: how many points the city's plan has. A count here, where the
//    summary takes ids, and for the opposite reason: these points are numbered
//    on the card — "10-Punkte-Plan" is what the thing is called — so the number
//    is content, and it is what names the key.
// Cities absent here show an empty Problem Fit widget and the L2 placeholder —
// the same graceful-null pattern as MODAL_SPLIT_TARGETS.
// The #RingFrei plan the Ringe project came out of. One document behind all ten
// points, so it is the card's source rather than ten repeats of the same link.
const PLAN_SOURCE = {
  url: 'https://koeln.adfc.de/artikel/uebersicht-zum-projekt-ringfrei',
  label: 'ADFC Köln — Übersicht zum Projekt #RingFrei',
  accessed: '2026-08-25',
};

// Where the official wording of an SDG 11 target is quoted from. One source for
// every city and every target: the targets are the UN's, not a measurement any
// city made, so this is a constant rather than a row in a CSV.
const SDG_TARGET_SOURCE = {
  url: 'https://know-sdgs.jrc.ec.europa.eu/sdg/11',
  label: 'European Commission, Joint Research Centre — Knowledge base on the SDGs: SDG 11',
  accessed: '2026-08-25',
};

const PROBLEM_FIT = {
  koeln: {
    targets: ['11.2', '11.6'],
    summary: ['intro', 'completion', 'counts', 'ebertplatz'],
    planPoints: 10,
  },
  'paris-marne-la-vallee': { targets: ['11.2', '11.6'] },
};

/**
 * A city's Problem Fit content: its SDG 11 target list, its summary block ids,
 * and the slug keying the prose in i18n (`problemFit.<slug>.*`). Null for every city
 * without researched Problem Fit content, so widgetStack.js renders its empty
 * widget and L2 placeholder unchanged.
 * @param {string|null} citySlug
 * @returns {{ slug: string, targets: string[], summary?: string[] } | null}
 */
export function problemFitForCity(citySlug) {
  if (!citySlug || !PROBLEM_FIT[citySlug]) return null;
  return { slug: citySlug, ...PROBLEM_FIT[citySlug] };
}

/**
 * Whether a city has any researched widget content — a Problem Fit entry or at
 * least one sourced Impact sub-metric. Cities without it (Lisbon and Helsinki
 * carry only context rows, no project figures) get a "coming soon" overlay at L1
 * (see mapView.js). Derived, not listed: it flips to true the moment a city's
 * data lands, so the overlay clears itself with nothing to maintain.
 * @param {string|null} citySlug
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @returns {boolean}
 */
export function cityHasResearchedContent(citySlug, cityIndicators = []) {
  if (!citySlug) return false;
  if (problemFitForCity(citySlug)) return true;
  return impactSubMetrics(cityIndicators, citySlug).some((metric) => metric.value != null);
}

/**
 * A city's single cycle-network figure (km per 1000 residents), or null.
 * @param {import('./types.js').CityIndicator[]} cityIndicators
 * @param {string} citySlug
 * @returns {{ value: number, unit: string|null, source: {url: string, label: string, accessed: string|null} } | null}
 */
export function cycleNetworkForCity(cityIndicators, citySlug) {
  const row = cityIndicatorsForCity(cityIndicators, citySlug).find(
    (indicator) => indicator.indicatorKey === 'cycle_network',
  );
  if (!row) return null;
  return {
    value: row.value,
    unit: row.unit,
    source: { url: row.sourceUrl, label: row.sourceLabel, accessed: row.sourceAccessed },
  };
}

/**
 * The Impact widget's three L2 sub-metrics for a city, in display order. Each
 * carries its own value shape (modal split → rings object, car density → year
 * series, cycle network → single figure) and its own source; an unsourced one
 * stays null and renders an honest placeholder — never a fabricated number.
 *
 * `benchmark` and `sdgTarget` ride along on every entry so the widget can show
 * what a figure should be read against and which SDG-11 target it serves. Both
 * are null today (see benchmarkForIndicator / sdgTargetForIndicator) and render
 * as "to follow" notes; wiring them up needs only those two stubs.
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @param {string|null} [citySlug]
 * @returns {{ key: string, value: unknown, unit: string|null, source: {url: string, label: string, accessed: string|null}|null, benchmark: null, sdgTarget: null }[]}
 */
export function impactSubMetrics(cityIndicators = [], citySlug = null) {
  const modalSplit = citySlug ? modalSplitForCity(cityIndicators, citySlug) : null;
  const car = citySlug ? carSlotForCity(cityIndicators, citySlug) : null;
  const cycleNetwork = citySlug ? cycleNetworkForCity(cityIndicators, citySlug) : null;
  return [
    modalSplit
      ? subMetric('modalSplit', modalSplit, '%', modalSplit.source)
      : subMetric('modalSplit', null, null, null),
    car
      ? subMetric(car.metric, car.series, car.unit, car.source)
      : subMetric('carDensity', null, null, null),
    cycleNetwork
      ? subMetric('cycleNetwork', cycleNetwork.value, cycleNetwork.unit, cycleNetwork.source)
      : subMetric('cycleNetwork', null, null, null),
  ];
}

/** One Impact sub-metric entry. The single place the entry shape is built, so
 * the two pending seams stay attached to every key. */
function subMetric(key, value, unit, source) {
  return {
    key,
    value,
    unit,
    source,
    benchmark: null,
    sdgTarget: null,
  };
}

// --- The six L2 modules ---------------------------------------------------
//
// The Impact L2 stands six modules on the canvas (widgetStack.js#moduleScaffold)
// and this is what goes in them, in the order they fly out. The six topics and
// their order come from `newDes/txtModel.odt` + `newDes/picModel.png`, whose six
// columns map one-to-one onto the six boxes.
//
// A module is a ~310x230px card, which is the whole reason this is a selector
// and not a component decision: what fits is one figure, one chart of the
// series behind it, a legend, one sentence, and the source. So each module is
// built as exactly that shape and nothing larger, and a topic a city has no
// sourced rows for comes back as an empty shell rather than a padded one.
//
// `kind` is what the module *is*, and it is what detailContent.js renders from:
//   'donut'     concentric rings, one per year (modal split)
//   'lines'     one to three year series on one axis, same unit (see the
//               one-axis rule — three pollutants in µg/m³ is one axis, a count
//               and a share would be two charts)
//   'breakdown' parts of one whole, as a stacked bar
//   'trend'     two or three sourced points, shown as figures rather than a
//               chart that would draw a line through almost nothing
//   null        no sourced rows for this city — an empty card
const MODULE_ORDER = ['modalSplit', 'car', 'airQuality', 'cycleNetwork', 'cyclists', 'roadSafety'];

/** The three pieces of copy a card carries besides its own data, keyed by the
 * module they belong to: the info point beside its title (`impact.info.car`),
 * the block the opened card ends on (`impact.detail.car`) and that block's
 * heading (`impact.detailTitle.car`).
 *
 * Assigned in one place rather than in each builder: they are the same facts
 * about every card — what this one is, and what stands behind it — and a builder
 * that forgot them would be a card that quietly lost half its explanation. An
 * empty shell gets none, because a topic with no rows has nothing to explain.
 *
 * Only the keys are attached, never the copy: which of them have anything
 * written behind them is a question for the bundles, and a card whose key is
 * empty says so (detailContent.js). That is what lets copy arrive one card at a
 * time with no change here.
 * @param {{ key: string, kind: string|null }[]} modules
 * @param {string} prefix
 */
function withCardCopy(modules, prefix) {
  return modules.map((module) => {
    if (!module.kind) return module;
    // A card can also say it wants no info point (`info: false`): the SDGs card
    // carries one inside each of its two boxes, naming the target that box is
    // about, and a third on the card title would have nothing left to explain.
    const withInfo =
      module.info === false
        ? { ...module }
        : { ...module, infoKey: `${prefix}.info.${module.key}` };
    // A card can say it has no closing block to fill (`detail: false`): the
    // Politik card's recommendations already are what such a block would hold,
    // and a "Sources" heading under them would promise a document none of it
    // comes from.
    if (module.detail === false) return withInfo;
    return {
      ...withInfo,
      detailKey: `${prefix}.detail.${module.key}`,
      detailTitleKey: `${prefix}.detailTitle.${module.key}`,
    };
  });
}

/** A city's year series for one indicator, inside the display window. */
function indicatorSeries(cityIndicators, citySlug, indicatorKey) {
  const rows = withinWindow(
    cityIndicatorsForCity(cityIndicators, citySlug).filter(
      (indicator) => indicator.indicatorKey === indicatorKey,
    ),
  );
  const [first] = rows;
  return {
    points: rows.map((row) => ({ year: row.year, value: row.value })),
    unit: first?.unit ?? null,
    source: first
      ? { url: first.sourceUrl, label: first.sourceLabel, accessed: first.sourceAccessed }
      : null,
  };
}

// A module's note is a sentence about the figures, not a figure — so it cannot
// live in cities.csv, and the sentence itself is translated copy
// (`impact.note.<slug>.<key>` in i18n). What lives here is which modules of
// which city have a note at all, and the document each one comes from. Same
// hand-picked, sourced-or-absent shape as MODAL_SPLIT_TARGETS above: a city
// with no entry gets no note rather than an unattributed claim — and, since a
// missing i18n key renders as the key itself, no half-written sentence either.
//
// OWN_SOURCE marks a note the module's own data source already covers (it is
// read off the same document as the figures), so it gets a sentence but no
// second chip.
const OWN_SOURCE = 'own-source';
const NOTE_SOURCES = {
  koeln: {
    cycleNetwork: OWN_SOURCE,
    roadSafety: OWN_SOURCE,
    car: OWN_SOURCE,
    airQuality: OWN_SOURCE,
    cyclists: {
      url: 'https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/mobilitaetswende-auf-den-ringen',
      label: 'Stadt Köln – Mobilitätswende auf den Ringen',
      accessed: '2026-08-23',
    },
  },
};

/** The note for one module of one city: the i18n suffix naming the sentence,
 * plus the source it needs its own chip for (null when the module's own chip
 * already points at the right document). No entry in NOTE_SOURCES → no note. */
function noteFor(citySlug, key) {
  const source = citySlug ? NOTE_SOURCES[citySlug]?.[key] : null;
  if (!source) return null;
  return { key: `${citySlug}.${key}`, source: source === OWN_SOURCE ? null : source };
}

/**
 * The six L2 modules for a city, in display order. Every entry carries its own
 * `kind`, its own source and — where the topic has something to say beyond the
 * numbers — one note with the document that note comes from. An unsourced topic
 * comes back as `{ key, kind: null }`, which renders an empty card.
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @param {string|null} [citySlug]
 * @returns {{ key: string, kind: string|null }[]}
 */
export function impactModules(cityIndicators = [], citySlug = null) {
  const builders = {
    modalSplit: modalSplitModule,
    car: carModule,
    airQuality: airQualityModule,
    cycleNetwork: cycleNetworkModule,
    cyclists: cyclistsModule,
    roadSafety: roadSafetyModule,
  };
  return withCardCopy(
    MODULE_ORDER.map((key) =>
      citySlug ? builders[key](cityIndicators, citySlug) : { key, kind: null },
    ),
    'impact',
  );
}

/** Modal split as concentric rings. Modes that are zero in every ring are
 * dropped from both the ring and the legend — Cologne has no motorized
 * two-wheeler rows, and a legend entry for a wedge that isn't drawn is a
 * question the card can't answer at this size. */
function modalSplitModule(cityIndicators, citySlug) {
  const split = modalSplitForCity(cityIndicators, citySlug);
  if (!split) return { key: 'modalSplit', kind: null };
  const shown = split.modes
    .map((mode, index) => index)
    .filter((index) => split.rings.some((ring) => ring.values[index] > 0));
  return {
    key: 'modalSplit',
    kind: 'donut',
    labelKey: 'impact.modalSplit',
    modes: shown.map((index) => split.modes[index]),
    rings: split.rings.map((ring) => ({
      year: ring.year,
      values: shown.map((index) => ring.values[index]),
    })),
    latestYear: split.latestYear,
    source: split.source,
    target: modalSplitTargetForCity(citySlug),
  };
}

/** The car slot — density or ownership, whichever this city has (see
 * CAR_SLOT_INDICATORS). One line: the second definition of "car" the sources
 * offer (all registered vehicles, not just private ones) tells the same story
 * at half the legibility on a card this size. */
function carModule(cityIndicators, citySlug) {
  const car = carSlotForCity(cityIndicators, citySlug);
  if (!car || car.series.length === 0) return { key: 'car', kind: null };
  return {
    key: 'car',
    kind: 'lines',
    labelKey: `impact.${car.metric}`,
    lines: [{ key: 'car', points: car.series }],
    unit: car.unit,
    latest: car.series[car.series.length - 1],
    // How far the line has travelled, and from when. Derived rather than
    // written down (CLAUDE.md), so the sentence that quotes it cannot drift
    // from the series it is quoting.
    change: seriesChange(car.series),
    source: car.source,
    sources: car.sources,
    note: noteFor(citySlug, 'car'),
  };
}

/** A series' move from its first year to its last, as a whole percent and the
 * year it is counted from. Null for a series with nothing to compare — one
 * point has not moved, and a first value of zero has no percentage. */
function seriesChange(series) {
  const [first] = series;
  const last = series[series.length - 1];
  if (!first || first === last || !first.value) return null;
  return {
    percent: Math.round(((last.value - first.value) / first.value) * 100),
    since: first.year,
  };
}

// The three pollutants the air module draws, in legend order — fine particles
// first because they are the ones the WHO counts deaths from. All three are
// annual means in µg/m³, which is what lets them share one axis.
const AIR_POLLUTANTS = ['pm25', 'pm10', 'no2'];

function airQualityModule(cityIndicators, citySlug) {
  const THRESHOLDS = {
    pm25: {
      eu: { value: 25, label: 'EU-Grenzwert (25 µg/m³)' },
      who: { value: 5, label: 'WHO-Empfehlung (5 µg/m³)' },
    },
    pm10: {
      eu: { value: 40, label: 'EU-Grenzwert (40 µg/m³)' },
      who: { value: 15, label: 'WHO-Empfehlung (15 µg/m³)' },
    },
    no2: {
      eu: { value: 40, label: 'EU-Grenzwert (40 µg/m³)' },
      who: { value: 10, label: 'WHO-Empfehlung (10 µg/m³)' },
    },
  };
  const series = AIR_POLLUTANTS.map((key) => ({
    key,
    ...indicatorSeries(cityIndicators, citySlug, `air_${key}`),
  }));
  const drawn = series.filter((entry) => entry.points.length > 0);
  if (drawn.length === 0) return { key: 'airQuality', kind: null };
  return {
    key: 'airQuality',
    kind: 'lines',
    labelKey: 'impact.airQuality',
    lines: drawn.map(({ key, points }) => ({ key, points })),
    unit: drawn[0].unit,
    // The chart carries three series and so has no headline figure to hang a
    // unit off. `unitKey` is the sentence that spells the symbol out above the
    // chart; the symbol itself still comes from the rows (`unit`), so the copy
    // cannot drift from what the data says it is measuring.
    unitKey: 'impact.unit.airQuality',
    thresholds: drawn.map(({ key }) => ({
      key,
      eu: THRESHOLDS[key].eu,
      who: THRESHOLDS[key].who,
    })),
    source: drawn[0].source,
    note: noteFor(citySlug, 'airQuality'),
  };
}

// The cycle network's parts, from least protected to most — the order the
// stacked bar is drawn in, and the order its green ramp steps through.
const CYCLE_NETWORK_PARTS = ['mixed', 'separated', 'offstreet'];

/** The cycle network: the per-resident figure the L1 widget headlines with,
 * broken into the three kinds of route behind it. */
function cycleNetworkModule(cityIndicators, citySlug) {
  const headline = cycleNetworkForCity(cityIndicators, citySlug);
  if (!headline) return { key: 'cycleNetwork', kind: null };
  const parts = CYCLE_NETWORK_PARTS.map((key) => ({
    key,
    value: cityIndicatorValue(cityIndicators, citySlug, `cycle_network_${key}`),
  })).filter((part) => part.value != null);
  return {
    key: 'cycleNetwork',
    kind: 'breakdown',
    labelKey: 'impact.cycleNetwork',
    headline,
    parts,
    total: parts.reduce((sum, part) => sum + part.value, 0),
    planned: cityIndicatorValue(cityIndicators, citySlug, 'cycle_network_planned'),
    source: headline.source,
    note: parts.length > 0 ? noteFor(citySlug, 'cycleNetwork') : null,
  };
}

function cyclistsModule(cityIndicators, citySlug) {
  const { points, unit, source } = indicatorSeries(cityIndicators, citySlug, 'cyclists_daily');
  if (points.length === 0) return { key: 'cyclists', kind: null };
  return {
    key: 'cyclists',
    kind: 'lines',
    labelKey: 'impact.cyclists',
    lines: [{ key: 'cyclists', points }],
    unit,
    latest: points[points.length - 1],
    source,
    note: noteFor(citySlug, 'cyclists'),
  };
}

/** Road safety. Three sourced points at five-year steps, two of them inside the
 * display window — too few to draw a line through without implying a shape the
 * data doesn't have, so the module states them as figures instead. */
function roadSafetyModule(cityIndicators, citySlug) {
  const { points, unit, source } = indicatorSeries(cityIndicators, citySlug, 'traffic_casualties');
  if (points.length === 0) return { key: 'roadSafety', kind: null };
  return {
    key: 'roadSafety',
    kind: 'trend',
    labelKey: 'impact.roadSafety',
    points,
    unit,
    latest: points[points.length - 1],
    source,
    note: noteFor(citySlug, 'roadSafety'),
  };
}

/**
 * Problem Fit's L2 modules — the same narrative `PROBLEM_FIT` already holds,
 * one block per card: first the SDG 11 targets the project addresses (the two
 * the L1 widget headlines with), then the body blocks describing how.
 *
 * The copy is untouched i18n (`problemFit.<slug>.*`); this only decides which
 * block goes in which box, so the cards a city gets follow that city's own
 * shape — Cologne breaks into two named network components plus a goal, Paris
 * is a single overview paragraph, and the boxes it does not fill stay empty.
 * @param {{ slug: string, targets: string[], body: { term?: string, text: string }[] } | null} problemFit
 * @returns {{ key: string, kind: string|null }[]}
 */
/** The milestone card: the city's dated steps, grouped into the years they fall
 * in. Grouped here rather than in the chart because which events share a mark is
 * a question about the data — two things happened in 2019, and a line drawn to
 * scale has one place to put them both. The chart is handed the answer.
 * @param {import('./types.js').Milestone[]} milestones
 * @param {string|null} citySlug
 */
function milestonesModule(milestones, citySlug) {
  const rows = milestones.filter((milestone) => milestone.citySlug === citySlug);
  if (rows.length === 0) {
    return { key: 'milestones', kind: 'placeholder', labelKey: 'problemFit.card.milestones' };
  }
  const byYear = new Map();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year).push(row.event);
  }
  return {
    key: 'milestones',
    kind: 'milestones',
    labelKey: 'problemFit.card.milestones',
    // The line is the whole card, and the rows carry no document of their own —
    // so there is nothing a closing block would hold. See docs/DATA_TODO.md.
    detail: false,
    years: [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, events]) => ({ year, events })),
  };
}

export function problemFitModules(problemFit, milestones = []) {
  const named = (key, kind, extra = {}) => ({
    key,
    kind,
    labelKey: `problemFit.card.${key}`,
    ...extra,
  });
  // Two keys per target, and they are keyed differently on purpose: what the
  // project does about a target is this city's (`<slug>.target.<code>`), while
  // the target's own wording is the UN's and the same everywhere
  // (`targetDefinition.<code>`).
  const targets = (problemFit?.targets ?? []).map((code) => ({
    code,
    textKey: `problemFit.${problemFit.slug}.target.${code}`,
    infoKey: `problemFit.targetDefinition.${code}`,
  }));
  // Two keys per point: the short line the card shows in a column, and the full
  // demand it shows opened. Objects rather than bare keys, so the per-point
  // delivery status the info text alludes to can be added later as a third
  // field without the layout changing — see docs/DATA_TODO.md.
  const points = Array.from({ length: problemFit?.planPoints ?? 0 }, (unused, at) => ({
    number: at + 1,
    shortKey: `problemFit.${problemFit.slug}.plan.${at + 1}.short`,
    textKey: `problemFit.${problemFit.slug}.plan.${at + 1}.text`,
  }));
  const summary = (problemFit?.summary ?? []).map(
    (block) => `problemFit.${problemFit.slug}.summary.${block}`,
  );
  return withCardCopy(
    [
      // The card is the project in four paragraphs and is nothing but them: it is
      // already the overview a closing block would summarise (`detail: false`)
      // and already the explanation an ⓘ would give (`info: false`), so it
      // carries neither rather than a heading and a hint with nothing left to
      // say under them.
      summary.length > 0
        ? named('problemFit', 'prose', { paragraphs: summary, info: false, detail: false })
        : named('problemFit', 'placeholder'),
      targets.length > 0
        ? named('sdgs', 'targets', {
            targets,
            info: false,
            detail: false,
            leadKey: `problemFit.${problemFit.slug}.sdgsLead`,
            sources: [SDG_TARGET_SOURCE],
          })
        : { key: 'sdgs', kind: null },
      points.length > 0
        ? named('plan', 'points', { points, detail: false, sources: [PLAN_SOURCE] })
        : named('plan', 'placeholder'),
      milestonesModule(milestones, problemFit?.slug ?? null),
    ],
    'problemFit',
  );
}

// --- Adoption Requirements ------------------------------------------------
//
// What another city needs to know to run this project itself, as the six cards
// `newDes/ubernahmeVoraussetzung.png` lays out: what it costs, the city it was
// built in, who in the administration owns it, who else was at the table, what
// the planners would tell the next city, and where the money can come from.
//
// The same split this file already keeps everywhere else: structure here,
// prose in i18n (`adoption.*`), figures in `cities.csv`. What is genuinely
// per-city — which department, which funding programme, which document a
// recommendation is quoted from — is a hand-picked, sourced lookup like
// MODAL_SPLIT_TARGETS, because none of it is a repeated measurement. A city
// with no entry gets six empty cards rather than another city's answers.
//
// `kind` again says what a card *is* (detailContent.js renders from it):
//   'facts'      a small grid of sourced figures about the city itself
//   'links'      an optional lead sentence and a list of outbound links
//   'linkGroups' the same, grouped under headings (the funding levels)
//   'prose'      one or more paragraphs of plain copy
//   null         not researched for this city — an empty card
// Down the near column first, then the far one, then the card spanning both:
// what it costs and where the money comes from together, the city it was built
// in and the politics that built it together, and the timeline under both.
const ADOPTION_ORDER = ['cost', 'funding', 'context', 'politics', 'timeline'];

// The context card's four figures. The first three are sourced rows in
// `cities.csv`; density is derived from two of them the way the research source
// derives it (see populationDensityForCity), so it carries no chip of its own —
// the two it is computed from are already in the card's footer.
const ADOPTION_CONTEXT_FACTS = [
  { key: 'population', indicatorKey: 'population' },
  { key: 'ringCorridor', indicatorKey: 'ring_cycle_lanes_km' },
  { key: 'area', indicatorKey: 'area_km2' },
  { key: 'density', derived: 'density' },
];

const ADOPTION = {
  koeln: {
    // What the city itself published, and — just as much the point — what it
    // did not. `indicatorKey` names the row in `cities.csv` carrying the
    // figure; an item without one is a cost the source states no number for,
    // and renders as the em dash a missing figure always renders as. Leaving
    // those three lines out would make the €2.9M read as the whole bill.
    cost: {
      headlineKey: 'ringe_cost_build',
      lengthKey: 'ringe_converted_km',
      items: [
        { key: 'signals', indicatorKey: 'ringe_cost_signals' },
        { key: 'planning' },
        { key: 'gapClosures' },
        { key: 'ebertplatz' },
      ],
    },
  },
};

// Where the money can come from, by level of government. Not per-city: every
// German city can apply to all of these, which is exactly why they belong on a
// card headed "what you need to adopt this" rather than in `cities.csv`. The
// last group carries no links because "sponsorship" and "an agreement with the
// transit authority" are routes, not programmes with a page to open.
// Who steered the project, and what the people who did it would tell the next
// city. The names and the recommendations are copy (`adoption.<slug>.politics.*`);
// what is here is which of them there are, in what order, and which have a page
// worth opening — three of the seven do, and the rest are named without a link
// rather than given one that points nowhere in particular.
const ADOPTION_POLICY = {
  koeln: {
    authorities: [
      { key: 'mobilitaet', url: 'https://www.stadt-koeln.de/service/adressen/10704/index.html' },
      {
        key: 'verkehrsmanagement',
        url: 'https://www.stadt-koeln.de/service/adressen/amt-fuer-verkehrsmanagement',
      },
    ],
    alliance: { key: 'ringfrei', url: 'https://nationaler-radverkehrsplan.de/de/praxis/ringfrei' },
    members: [
      { key: 'adfc', url: 'https://koeln.adfc.de/artikel/uebersicht-zum-projekt-ringfrei' },
      { key: 'agora' },
      { key: 'einrichtungsmeile' },
      { key: 'radkomm' },
      { key: 'vcd', url: 'https://nrw.vcd.org/der-vcd-in-nrw/koeln/' },
    ],
    // Each opens into what Cologne did and what another city should take from
    // it — see policyModule for the four strings a recommendation carries.
    recommendations: ['movement', 'phased', 'reallocation', 'safety', 'structure'],
  },
};

const ADOPTION_FUNDING = [
  {
    key: 'eu',
    links: [
      {
        key: 'cef',
        url: 'https://cinea.ec.europa.eu/programmes/connecting-europe-facility/transport-infrastructure_en',
      },
      { key: 'interreg', url: 'https://interreg.eu/' },
      { key: 'erdf', url: 'https://ec.europa.eu/regional_policy/funding/erdf_en' },
      { key: 'life', url: 'https://cinea.ec.europa.eu/programmes/life_en' },
      {
        key: 'horizon',
        url: 'https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en',
      },
    ],
  },
  {
    key: 'federal',
    links: [
      {
        key: 'ktf',
        url: 'https://www.bundeshaushalt.de/DE/SVIK/KTF/klima-und-transformationsfonds.html',
      },
      {
        key: 'kommunalrichtlinie',
        url: 'https://www.klimaschutz.de/de/foerderung-der-nki/foerderprogramme/kommunalrichtlinie',
      },
      {
        key: 'jungeGeneration',
        url: 'https://www.mobilitaetsforum.bund.de/DE/Foerderungen/Foerderaufruf-Junge-Generation-Fahrrad/foerderaufruf-junge-generation-fahrrad_node.html',
      },
      {
        key: 'bundesstrassen',
        url: 'https://www.bmv.de/SharedDocs/DE/Artikel/StV/Radverkehr/finanzielle-foerderung-des-radverkehrs.html',
      },
    ],
  },
  {
    key: 'civic',
    links: [{ key: 'startnext', url: 'https://www.startnext.com/' }],
    plain: ['crowdfunding'],
  },
  { key: 'private', links: [], plain: ['sponsorship', 'transitAuthorities'] },
];

/**
 * The six Adoption Requirements modules for a city, in display order. Same
 * contract as impactModules: every card carries its own kind and its own
 * sources, and a topic this city has nothing researched for comes back as
 * `{ key, kind: null }` and renders an empty card.
 * @param {import('./types.js').CityIndicator[]} [cityIndicators]
 * @param {string|null} [citySlug]
 * @returns {{ key: string, kind: string|null }[]}
 */
export function adoptionModules(cityIndicators = [], citySlug = null, timeline = []) {
  const entry = citySlug ? ADOPTION[citySlug] : null;
  const builders = {
    cost: () => costModule(cityIndicators, citySlug, entry?.cost),
    context: () => contextModule(cityIndicators, citySlug),
    // Named, and empty until researched. A placeholder differs from an empty
    // shell: a shell is a topic this city has no rows for, and stays blank; this
    // is a topic nobody has looked into for any city yet, and says so under its
    // own name so the set of six reads as five deliberate cards.
    politics: () => policyModule(citySlug),
    funding: () => fundingModule(entry),
    timeline: () => timelineModule(timeline, citySlug),
  };
  return withCardCopy(
    ADOPTION_ORDER.map((key) => (entry ? builders[key]() : { key, kind: null })),
    'adoption',
  );
}

/** What it cost, and — the reason this card needs a disclaimer rather than a
 * total — what the published figure leaves out. The headline is the one sum
 * Stadt Köln actually states; every other line is either a second sourced
 * figure or an em dash saying the source names no number for it. The per-km
 * rate is arithmetic over two figures from the same document on the same day
 * (spend ÷ converted length), which is the form another city can price its own
 * corridor from; the sentence under the card says so, the way the context
 * card's derived density does. */
function costModule(cityIndicators, citySlug, cost) {
  if (!cost) return { key: 'cost', kind: null };
  const rows = cityIndicatorsForCity(cityIndicators, citySlug);
  const rowFor = (key) => rows.find((row) => row.indicatorKey === key && row.value != null) ?? null;
  const headline = rowFor(cost.headlineKey);
  if (!headline) return { key: 'cost', kind: null };
  const length = rowFor(cost.lengthKey);
  // The rows the itemised lines were read from. The card no longer lists them —
  // what the sum covers is the info point's job now, and what was never
  // published separately the Quellen block's — but a row that the figure rests
  // on is still a row the card has to cite.
  const itemRows = cost.items.map((item) => (item.indicatorKey ? rowFor(item.indicatorKey) : null));
  return {
    key: 'cost',
    kind: 'cost',
    labelKey: 'adoption.cost',
    headline: { value: headline.value, year: headline.year },
    scopeKey: `adoption.${citySlug}.costScope`,
    length: length ? { value: length.value, unit: length.unit } : null,
    perKm: length ? roundToThousand(headline.value / length.value) : null,
    rateKey: `adoption.${citySlug}.costRate`,
    disclaimerKey: `adoption.${citySlug}.costNote`,
    sources: sourcesOfRows([headline, length, ...itemRows]),
  };
}

/** A rate quoted to the nearest thousand euro. The inputs are a rounded "etwa
 * 2,9 Millionen" and a rounded "neun Kilometer", so every digit past this one
 * would be precision the source never had. */
function roundToThousand(value) {
  return Math.round(value / 1000) * 1000;
}

/** One chip per document, in the order the rows were read, skipping the rows
 * that are not there and the second row that cites the same page as the first. */
function sourcesOfRows(rows) {
  const seen = new Set();
  return rows.filter(Boolean).flatMap((row) => {
    if (!row.sourceUrl || seen.has(row.sourceUrl)) return [];
    seen.add(row.sourceUrl);
    return [{ url: row.sourceUrl, label: row.sourceLabel, accessed: row.sourceAccessed }];
  });
}

/** The city itself, as the figures another city compares itself against. Built
 * from whatever `cities.csv` actually has: a fact with no row is dropped rather
 * than shown empty, and a card left with no facts at all is an empty card. */
function contextModule(cityIndicators, citySlug) {
  const read = [];
  const facts = ADOPTION_CONTEXT_FACTS.map((fact) => {
    if (fact.derived === 'density') {
      const value = populationDensityForCity(cityIndicators, citySlug);
      return value == null ? null : { key: fact.key, value: Math.round(value), unit: 'per km²' };
    }
    const row = cityIndicatorsForCity(cityIndicators, citySlug).find(
      (indicator) => indicator.indicatorKey === fact.indicatorKey,
    );
    if (!row || row.value == null) return null;
    read.push(row);
    return { key: fact.key, value: row.value, unit: row.unit, year: row.year };
  }).filter(Boolean);
  if (facts.length === 0) return { key: 'context', kind: null };
  return {
    key: 'context',
    kind: 'facts',
    labelKey: 'adoption.context',
    // No closing block: the figures here are four rows and their chips, and a
    // "Sources" heading under them would name a document where the chips
    // already name three.
    detail: false,
    facts,
    sources: sourcesOfRows(read),
  };
}

/** The funding routes, grouped by level of government. The same list for every
 * German city (see ADOPTION_FUNDING), so it is built once and gated only on the
 * city having researched adoption content at all. */
/** The Politik card: who was responsible, who took part, and what the people
 * who ran it would tell the next city.
 *
 * `detail: false` because this card is the exception that carries no closing
 * block: what would go in one is already here, as the recommendations, and a
 * "Sources" heading under them would promise a document none of it comes from.
 */
function policyModule(citySlug) {
  const entry = citySlug ? ADOPTION_POLICY[citySlug] : null;
  if (!entry) return { key: 'politics', kind: 'placeholder', labelKey: 'adoption.politics' };
  const named = (item) => ({ ...item, textKey: `adoption.${citySlug}.politics.${item.key}` });
  return {
    key: 'politics',
    kind: 'policy',
    labelKey: 'adoption.politics',
    detail: false,
    authorities: entry.authorities.map(named),
    alliance: named(entry.alliance),
    members: entry.members.map(named),
    recommendations: entry.recommendations.map((key) => ({
      key,
      titleKey: `adoption.${citySlug}.politics.rec.${key}.title`,
      claimKey: `adoption.${citySlug}.politics.rec.${key}.claim`,
      exampleKey: `adoption.${citySlug}.politics.rec.${key}.example`,
      lessonKey: `adoption.${citySlug}.politics.rec.${key}.lesson`,
    })),
  };
}

/** The Timeline card: what happened, in order, on one track.
 *
 * Evenly spaced rather than laid on a time axis — "Ab 2018" and "Mai–Aug. 2022"
 * are not points in time, and three events in late 2015 would sit on top of one
 * another. The date is the label; the order is the placement.
 *
 * `detail: false` like the other two written Adoption cards: every event already
 * opens into its own account, and one "Sources" heading under thirteen of them
 * would promise a single document behind all of them.
 */
function timelineModule(timeline, citySlug) {
  const events = timeline.filter((event) => event.citySlug === citySlug);
  if (events.length === 0) {
    return { key: 'timeline', kind: 'placeholder', labelKey: 'adoption.timeline' };
  }
  return {
    key: 'timeline',
    kind: 'timeline',
    labelKey: 'adoption.timeline',
    detail: false,
    events: events.map((event) => ({
      key: `${event.phase}-${event.position}`,
      phase: event.phase,
      // A dated event and one that is still ahead read the same way here: what
      // the source put in its first column, whichever column that was.
      when: event.dateLabel ?? event.status ?? '',
      planned: !event.dateLabel,
      title: event.title,
      details: event.details,
    })),
    // Where each stretch of the story begins, for the labels along the track.
    phases: [...new Set(events.map((event) => event.phase))].map((phase) => ({
      phase,
      labelKey: `adoption.timeline.phase.${phase}`,
      from: events.findIndex((event) => event.phase === phase),
    })),
  };
}

function fundingModule(entry) {
  if (!entry) return { key: 'funding', kind: null };
  return {
    key: 'funding',
    kind: 'linkGroups',
    labelKey: 'adoption.funding',
    // No closing block, for the same reason the Politik card has none: each
    // route already opens into its own terms, and a "Sources" heading under
    // thirteen of them would promise one document behind all of them.
    detail: false,
    groups: ADOPTION_FUNDING.map((group) => ({
      key: group.key,
      headingKey: `adoption.funding.${group.key}`,
      links: group.links.map((link) => ({ ...link, textKey: `adoption.funding.${link.key}` })),
      plain: (group.plain ?? []).map((key) => `adoption.funding.${key}`),
    })),
  };
}
