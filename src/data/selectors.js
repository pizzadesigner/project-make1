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

/**
 * @param {import('./types.js').Project[]} projects
 * @param {string} citySlug
 * @returns {import('./types.js').Project|undefined}
 */
export function projectByCitySlug(projects, citySlug) {
  return projects.find((project) => project.citySlug === citySlug);
}

/**
 * Metric rows for a project, oldest year first.
 * @param {import('./types.js').Metric[]} metrics
 * @param {string} projectId
 * @returns {import('./types.js').Metric[]}
 */
export function metricsForProject(metrics, projectId) {
  return metrics
    .filter((metric) => metric.projectId === projectId)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

/**
 * @param {import('./types.js').PeerCity[]} peers
 * @param {string} projectId
 * @returns {import('./types.js').PeerCity[]}
 */
export function peersForProject(peers, projectId) {
  return peers.filter((peer) => peer.projectId === projectId);
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

/**
 * TODO(data): district-level green-space breakdown, kept for the Analysis-layer
 * drill-in (Phase 3/5). No per-district data exists in the dataset yet, so it
 * always returns null and no district bars render. See docs/DATA_TODO.md. Shape
 * once real data lands: `{ names: string[], greenSpaceHectares: number[] }`.
 * @returns {null}
 */
export function districtsForProject() {
  return null;
}

/**
 * TODO(data): the reference value an indicator should be read against — "is 373
 * cars per 1000 residents a lot or a little?" (Kennzahlen-Bewertung, review of
 * 2026-08-03). A figure with no yardstick cannot be judged, so each widget
 * figure needs its national / EU / global counterpart beside it.
 *
 * Returns null until sourced benchmark rows exist; `widgetStack.js` renders a
 * "benchmark to follow" note in that case rather than an unlabelled number.
 * Shape once real data lands, mirroring a `cities.csv` row so the same source
 * chip renders: `{ scope: 'national'|'eu'|'global', value: number, unit: string,
 * year: number|null, source: { url, label, accessed } }`.
 * @returns {null}
 */
export function benchmarkForIndicator() {
  return null;
}

/**
 * TODO(data): which SDG-11 target an indicator serves, so the dashboard can show
 * *why* a number matters and not just what it is (review of 2026-08-03,
 * "Verbindung Daten zum Ziel"). `projects.csv` carries `sdg11_target` per
 * project; `cities.csv` has no equivalent per indicator, so the link cannot be
 * derived yet.
 *
 * Returns null until an `sdg_target` column exists. Expected mapping once it
 * does: car density / modal split / cycle network → 11.2, green space → 11.7.
 * Shape: an SDG11_TARGET_CODES code (`'11.2'`).
 * @returns {null}
 */
export function sdgTargetForIndicator() {
  return null;
}

/**
 * TODO(data): the gap between a city's current value and the value its SDG-11
 * target implies — "wenn weniger Autos weniger CO2 bedeutet, wie viel muss
 * passieren?" (review of 2026-08-03). This is the seam for the Analysis layer's
 * "what would have to change" panel.
 *
 * Deliberately unimplemented: it needs a per-city target value and a stated
 * reduction pathway, both of which are decisions the team has not taken (see
 * docs/HANDOFF.md §8). Returning a computed gap against a guessed target would
 * fabricate a claim — Neutrality, docs/DESIGN_RATIONALE.md.
 * Shape once decided: `{ current: number, targetValue: number, unit: string,
 * targetYear: number, source: { url, label, accessed } }`.
 * @returns {null}
 */
export function reductionPathwayForCity() {
  return null;
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
  const [first] = rows;
  return {
    series: rows.map((row) => ({ year: row.year, value: row.value })),
    unit: first?.unit ?? null,
    source: first
      ? { url: first.sourceUrl, label: first.sourceLabel, accessed: first.sourceAccessed }
      : null,
  };
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
    const { series, unit, source } = carDensitySeriesForCity(
      cityIndicators,
      citySlug,
      indicatorKey,
    );
    if (series.length > 0) return { metric, series, unit, source };
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
//  - `targets`: the SDG 11 codes (L1), each with a one-line explanation keyed
//    `problemFit.<slug>.target.<code>`.
//  - `body`: the L2 narrative, as ordered blocks. A `{ text }` block is a plain
//    paragraph (i18n suffix in `text`); a `{ term, text }` block is a bold
//    lead-in term + description; `goal: true` marks the closing block for its
//    divider styling. Cities differ in shape — Cologne breaks into two named
//    components + a goal, Paris is a single overview paragraph — so the block
//    list carries that shape rather than the renderer assuming one.
// Cities absent here show an empty Problem Fit widget and the L2 placeholder —
// the same graceful-null pattern as MODAL_SPLIT_TARGETS.
const PROBLEM_FIT = {
  koeln: {
    targets: ['11.2', '11.6'],
    body: [
      { text: 'intro' },
      { term: 'ringsTerm', text: 'ringsBody' },
      { term: 'routesTerm', text: 'routesBody' },
      { term: 'goalTerm', text: 'goalBody', goal: true },
    ],
  },
  'paris-marne-la-vallee': {
    targets: ['11.2', '11.6'],
    body: [{ text: 'overview' }],
  },
};

/**
 * A city's Problem Fit content: its SDG 11 target list, the L2 body blocks, and
 * the slug keying the prose in i18n (`problemFit.<slug>.*`). Null for every city
 * without researched Problem Fit content, so widgetStack.js renders its empty
 * widget and L2 placeholder unchanged.
 * @param {string|null} citySlug
 * @returns {{ slug: string, targets: string[], body: { term?: string, text: string, goal?: boolean }[] } | null}
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
    benchmark: benchmarkForIndicator(),
    sdgTarget: sdgTargetForIndicator(),
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
    car: {
      url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/vlr_koeln_de_2023.pdf',
      label: 'Stadt Köln – Verkehrsentwicklung (VLR 2023)',
      accessed: '2026-08-23',
    },
    airQuality: {
      url: 'https://www.lanuk.nrw.de/article/bilanz-zur-luftqualitaet-2025-in-nordrhein-westfalen',
      label: 'LANUV NRW – Bilanz zur Luftqualität 2025',
      accessed: '2026-08-23',
    },
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
  return MODULE_ORDER.map((key) =>
    citySlug ? builders[key](cityIndicators, citySlug) : { key, kind: null },
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
    source: car.source,
    note: noteFor(citySlug, 'car'),
  };
}

// The three pollutants the air module draws, in legend order — fine particles
// first because they are the ones the WHO counts deaths from. All three are
// annual means in µg/m³, which is what lets them share one axis.
const AIR_POLLUTANTS = ['pm25', 'pm10', 'no2'];

function airQualityModule(cityIndicators, citySlug) {
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
export function problemFitModules(problemFit) {
  if (!problemFit) return MODULE_ORDER.map((key) => ({ key, kind: null }));
  const { slug, targets, body } = problemFit;
  const blocks = [
    ...targets.map((code) => ({
      key: `target-${code}`,
      labelKey: 'problemFit.targetHeading',
      labelCode: code,
      text: `problemFit.${slug}.target.${code}`,
    })),
    ...body.map((block) => ({
      key: block.text,
      labelKey: block.term ? `problemFit.${slug}.${block.term}` : null,
      text: `problemFit.${slug}.${block.text}`,
    })),
  ];
  return MODULE_ORDER.map((key, index) =>
    blocks[index] ? { kind: 'prose', ...blocks[index] } : { key, kind: null },
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
//   'prose'      one quoted paragraph, with the document it is quoted from
//   null         not researched for this city — an empty card
const ADOPTION_ORDER = ['cost', 'context', 'departments', 'partners', 'recommendation', 'funding'];

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
    departments: [
      {
        key: 'verkehrsmanagement',
        url: 'https://www.stadt-koeln.de/service/adressen/amt-fuer-verkehrsmanagement',
      },
      { key: 'mobilitaet', url: 'https://www.stadt-koeln.de/service/adressen/10704/index.html' },
    ],
    partners: [
      { key: 'ringfrei', url: 'https://nationaler-radverkehrsplan.de/de/praxis/ringfrei' },
      { key: 'adfc', url: 'https://koeln.adfc.de/artikel/uebersicht-zum-projekt-ringfrei' },
      { key: 'vcd', url: 'https://nrw.vcd.org/der-vcd-in-nrw/koeln/' },
      {
        key: 'dvr',
        url: 'https://www.dvr.de/pakt-fuer-verkehrssicherheit/projekte/umgestaltung-der-koelner-ringe/',
      },
    ],
    recommendation: {
      url: 'https://www.dvr.de/pakt-fuer-verkehrssicherheit/projekte/umgestaltung-der-koelner-ringe/',
      label: 'Deutscher Verkehrssicherheitsrat – Umgestaltung der Kölner Ringe',
      accessed: '2026-08-23',
    },
  },
};

// Where the money can come from, by level of government. Not per-city: every
// German city can apply to all of these, which is exactly why they belong on a
// card headed "what you need to adopt this" rather than in `cities.csv`. The
// last group carries no links because "sponsorship" and "an agreement with the
// transit authority" are routes, not programmes with a page to open.
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
export function adoptionModules(cityIndicators = [], citySlug = null) {
  const entry = citySlug ? ADOPTION[citySlug] : null;
  const builders = {
    cost: () => costModule(cityIndicators, citySlug, entry?.cost),
    context: () => contextModule(cityIndicators, citySlug),
    departments: () => linksModule('departments', citySlug, entry?.departments),
    partners: () =>
      linksModule('partners', citySlug, entry?.partners, `adoption.${citySlug}.partnersLead`),
    recommendation: () => recommendationModule(citySlug, entry?.recommendation),
    funding: () => fundingModule(entry),
  };
  return ADOPTION_ORDER.map((key) => (entry ? builders[key]() : { key, kind: null }));
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
  const itemRows = cost.items.map((item) => (item.indicatorKey ? rowFor(item.indicatorKey) : null));
  const items = cost.items.map((item, index) => ({
    key: item.key,
    labelKey: `adoption.${citySlug}.cost.${item.key}`,
    value: itemRows[index]?.value ?? null,
  }));
  return {
    key: 'cost',
    kind: 'cost',
    labelKey: 'adoption.cost',
    headline: { value: headline.value, year: headline.year },
    scopeKey: `adoption.${citySlug}.costScope`,
    coversKey: `adoption.${citySlug}.costCovers`,
    length: length ? { value: length.value, unit: length.unit } : null,
    perKm: length ? roundToThousand(headline.value / length.value) : null,
    items,
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
    facts,
    sources: sourcesOfRows(read),
  };
}

/** A list of outbound links — the departments that own the project, or the
 * organisations that were at the table — with an optional sentence above it.
 * The link text is translated copy keyed by city, the URL is not. */
function linksModule(key, citySlug, links, leadKey = null) {
  if (!links || links.length === 0) return { key, kind: null };
  return {
    key,
    kind: 'links',
    labelKey: `adoption.${key}`,
    lead: leadKey,
    links: links.map((link) => ({ ...link, textKey: `adoption.${citySlug}.${key}.${link.key}` })),
  };
}

/** What the planners would tell the next city, quoted rather than paraphrased —
 * so it carries the document it is quoted from as its source. */
function recommendationModule(citySlug, source) {
  if (!source) return { key: 'recommendation', kind: null };
  return {
    key: 'recommendation',
    kind: 'prose',
    labelKey: 'adoption.recommendation',
    text: `adoption.${citySlug}.recommendation`,
    source,
  };
}

/** The funding routes, grouped by level of government. The same list for every
 * German city (see ADOPTION_FUNDING), so it is built once and gated only on the
 * city having researched adoption content at all. */
function fundingModule(entry) {
  if (!entry) return { key: 'funding', kind: null };
  return {
    key: 'funding',
    kind: 'linkGroups',
    labelKey: 'adoption.funding',
    groups: ADOPTION_FUNDING.map((group) => ({
      key: group.key,
      headingKey: `adoption.funding.${group.key}`,
      links: group.links.map((link) => ({ ...link, textKey: `adoption.funding.${link.key}` })),
      plain: (group.plain ?? []).map((key) => `adoption.funding.${key}`),
    })),
  };
}
