import { describe, it, expect } from 'vitest';
import {
  cityIndicatorsForCity,
  cityIndicatorValue,
  populationDensityForCity,
  widgetMetricsForProject,
  carDensitySeriesForCity,
  modalSplitForCity,
  modalSplitTargetForCity,
  problemFitForCity,
  cityHasResearchedContent,
  cycleNetworkForCity,
  impactSubMetrics,
  impactModules,
  problemFitModules,
  adoptionModules,
} from './selectors.js';

// Real Cologne figures (population / area = 2539, matching the research table)
// plus one Lisbon row with no area, to exercise the null path.
const indicators = [
  { citySlug: 'koeln', indicatorKey: 'population', value: 1028273 },
  { citySlug: 'koeln', indicatorKey: 'area_km2', value: 405 },
  { citySlug: 'lisboa', indicatorKey: 'population', value: 596952 },
];

// Real Cologne Pkw-Dichte figures (Stadt Köln, "Kraftfahrzeuge in Köln im
// Überblick"), listed out of year order to exercise the sort.
const CAR_DENSITY_SOURCE = {
  url: 'https://www.stadt-koeln.de/artikel/73904/index.html',
  label: 'Stadt Köln – Kraftfahrzeuge in Köln im Überblick',
  accessed: '2026-07-30',
};
const carDensityIndicators = [
  {
    citySlug: 'koeln',
    indicatorKey: 'car_density',
    value: 373,
    unit: 'per 1000 residents',
    year: 2025,
    sourceUrl: CAR_DENSITY_SOURCE.url,
    sourceLabel: CAR_DENSITY_SOURCE.label,
    sourceAccessed: CAR_DENSITY_SOURCE.accessed,
  },
  {
    citySlug: 'koeln',
    indicatorKey: 'car_density',
    value: 378,
    unit: 'per 1000 residents',
    year: 2021,
    sourceUrl: CAR_DENSITY_SOURCE.url,
    sourceLabel: CAR_DENSITY_SOURCE.label,
    sourceAccessed: CAR_DENSITY_SOURCE.accessed,
  },
];

// Real Paris car-ownership figures (Insee LOG T12, % of households with ≥1 car)
// — a different indicator than Cologne's density, keyed `car_ownership`.
const CAR_OWNERSHIP_SOURCE = {
  url: 'https://www.insee.fr/en/statistiques/6457611?geo=DEP-75#chiffre-cle-2',
  label: 'Insee – Household automotive equipment (LOG T12) Département de Paris',
  accessed: '2026-07-31',
};
const carOwnershipIndicators = [
  {
    citySlug: 'paris-marne-la-vallee',
    indicatorKey: 'car_ownership',
    value: 34.4,
    unit: '% of households',
    year: 2017,
    sourceUrl: CAR_OWNERSHIP_SOURCE.url,
    sourceLabel: CAR_OWNERSHIP_SOURCE.label,
    sourceAccessed: CAR_OWNERSHIP_SOURCE.accessed,
  },
  {
    citySlug: 'paris-marne-la-vallee',
    indicatorKey: 'car_ownership',
    value: 31.2,
    unit: '% of households',
    year: 2023,
    sourceUrl: CAR_OWNERSHIP_SOURCE.url,
    sourceLabel: CAR_OWNERSHIP_SOURCE.label,
    sourceAccessed: CAR_OWNERSHIP_SOURCE.accessed,
  },
];

describe('cityIndicatorsForCity', () => {
  it('returns only the rows for the given city', () => {
    expect(cityIndicatorsForCity(indicators, 'koeln')).toHaveLength(2);
    expect(cityIndicatorsForCity(indicators, 'lisboa')).toHaveLength(1);
  });
});

describe('cityIndicatorValue', () => {
  it('returns the value for a city + indicator', () => {
    expect(cityIndicatorValue(indicators, 'koeln', 'population')).toBe(1028273);
  });

  it('returns null when the indicator is absent', () => {
    expect(cityIndicatorValue(indicators, 'lisboa', 'area_km2')).toBeNull();
  });
});

describe('populationDensityForCity', () => {
  it('derives density from population / area', () => {
    // 1_028_273 / 405 = 2539.0 — the figure the research table reports.
    expect(populationDensityForCity(indicators, 'koeln')).toBeCloseTo(2539, 0);
  });

  it('returns null when a required input is missing', () => {
    expect(populationDensityForCity(indicators, 'lisboa')).toBeNull();
  });
});

describe('widgetMetricsForProject', () => {
  it('exposes the three Exploration widgets, all null with no city and no data', () => {
    // The keys are the contract the widget stack relies on; the nulls keep any
    // fabricated figure from rendering (docs/DESIGN_RATIONALE.md).
    expect(widgetMetricsForProject()).toEqual({
      problemFit: null,
      impact: null,
      adoption: null,
    });
  });

  it("headlines Cologne's Impact widget with its cycle network", () => {
    // Which indicator stands for a city is decided here, in the data layer — the
    // widget renders what it is handed and knows nothing about city slugs.
    const subMetrics = impactSubMetrics(
      [
        {
          citySlug: 'koeln',
          indicatorKey: 'cycle_network',
          value: 1.75,
          unit: 'km per 1000 residents',
          sourceUrl: 'https://example.test/cycle',
          sourceLabel: 'Stadt Köln',
          sourceAccessed: '2026-07-30',
        },
      ],
      'koeln',
    );
    expect(widgetMetricsForProject({ citySlug: 'koeln' }, subMetrics)).toEqual({
      problemFit: null,
      impact: { key: 'cycleNetwork', value: 1.75, unit: 'km per 1000 residents' },
      adoption: null,
    });
  });

  it("headlines Paris's Impact widget with the latest year of its car-ownership series", () => {
    // A year series headlines with its most recent value, not its first.
    const subMetrics = impactSubMetrics(carOwnershipIndicators, 'paris-marne-la-vallee');
    expect(
      widgetMetricsForProject({ citySlug: 'paris-marne-la-vallee' }, subMetrics).impact,
    ).toEqual({
      key: 'carOwnership',
      value: 31.2,
      unit: '% of households',
    });
  });

  it('leaves Impact null for a city with no headline metric configured', () => {
    // Lisbon and Helsinki have no sourced sub-metric — an empty widget, never a
    // borrowed or fabricated figure.
    const subMetrics = impactSubMetrics(carDensityIndicators, 'lisboa');
    expect(widgetMetricsForProject({ citySlug: 'lisboa' }, subMetrics).impact).toBeNull();
  });

  it('leaves Impact null when the configured metric has no sourced value', () => {
    // Cologne is configured for cycle network, but if the row is absent the
    // widget stays empty rather than falling back to another indicator.
    const subMetrics = impactSubMetrics(carDensityIndicators, 'koeln');
    expect(widgetMetricsForProject({ citySlug: 'koeln' }, subMetrics).impact).toBeNull();
  });
});

describe('carDensitySeriesForCity', () => {
  it('returns the series oldest-year-first, with unit and source', () => {
    expect(carDensitySeriesForCity(carDensityIndicators, 'koeln')).toEqual({
      series: [
        { year: 2021, value: 378 },
        { year: 2025, value: 373 },
      ],
      unit: 'per 1000 residents',
      source: CAR_DENSITY_SOURCE,
      // Both rows are the same document, so there is no second one to name.
      sources: [],
    });
  });

  it('returns an empty series and null source for a city with no car_density rows', () => {
    expect(carDensitySeriesForCity(carDensityIndicators, 'lisboa')).toEqual({
      series: [],
      unit: null,
      source: null,
      sources: [],
    });
  });

  // A series is one row per year and the years need not share a document:
  // Cologne's car density is the statistical yearbook up to 2023 and the
  // registration page after it. Citing the earliest row alone would leave the
  // newest points — the ones the figure at the top of the card is taken from —
  // resting on a document the card never names.
  it('names every document the line is drawn from, once each', () => {
    const yearbook = {
      url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-jahrbuch/jahrbuch.pdf',
      label: 'Stadt Köln – Statistisches Jahrbuch',
      accessed: '2026-08-23',
    };
    const mixed = [
      {
        citySlug: 'koeln',
        indicatorKey: 'car_density',
        value: 356,
        year: 2016,
        unit: 'x',
        sourceUrl: yearbook.url,
        sourceLabel: yearbook.label,
        sourceAccessed: yearbook.accessed,
      },
      {
        citySlug: 'koeln',
        indicatorKey: 'car_density',
        value: 370,
        year: 2023,
        unit: 'x',
        sourceUrl: yearbook.url,
        sourceLabel: yearbook.label,
        sourceAccessed: yearbook.accessed,
      },
      {
        citySlug: 'koeln',
        indicatorKey: 'car_density',
        value: 373,
        year: 2025,
        unit: 'x',
        sourceUrl: CAR_DENSITY_SOURCE.url,
        sourceLabel: CAR_DENSITY_SOURCE.label,
        sourceAccessed: CAR_DENSITY_SOURCE.accessed,
      },
    ];
    const { source, sources } = carDensitySeriesForCity(mixed, 'koeln');
    expect(source).toEqual(yearbook);
    expect(sources).toEqual([CAR_DENSITY_SOURCE]);
  });
});

// The two seams every sub-metric carries but nothing fills yet (benchmark =
// "is this a lot or a little?", sdgTarget = "which SDG-11 target does it
// serve?"). Spread into each expectation so wiring either one up fails these
// tests loudly rather than silently changing the widget contract.
const PENDING = { benchmark: null, sdgTarget: null };

describe('impactSubMetrics', () => {
  it('exposes modal split and cycle network as null until content is sourced', () => {
    // Same Neutrality/Honesty contract as widgetMetricsForProject — the keys
    // are what widgetStack.js relies on, the nulls keep any fabricated figure
    // from rendering (see docs/DATA_TODO.md).
    expect(impactSubMetrics(carDensityIndicators, 'lisboa')).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null, ...PENDING },
      { key: 'carDensity', value: null, unit: null, source: null, ...PENDING },
      { key: 'cycleNetwork', value: null, unit: null, source: null, ...PENDING },
    ]);
  });

  it('defaults to all null when called with no city (e.g. no focused project)', () => {
    expect(impactSubMetrics()).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null, ...PENDING },
      { key: 'carDensity', value: null, unit: null, source: null, ...PENDING },
      { key: 'cycleNetwork', value: null, unit: null, source: null, ...PENDING },
    ]);
  });

  it("exposes Cologne's car density as its sourced series, unit and source", () => {
    expect(impactSubMetrics(carDensityIndicators, 'koeln')).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null, ...PENDING },
      {
        key: 'carDensity',
        value: [
          { year: 2021, value: 378 },
          { year: 2025, value: 373 },
        ],
        unit: 'per 1000 residents',
        source: CAR_DENSITY_SOURCE,
        ...PENDING,
      },
      { key: 'cycleNetwork', value: null, unit: null, source: null, ...PENDING },
    ]);
  });

  it("exposes Paris's car ownership under its own key, not car density", () => {
    // Different indicator, different (non-misleading) label — the car slot picks
    // car_ownership and keys it 'carOwnership' so it never reads as "Car density".
    const [, car] = impactSubMetrics(carOwnershipIndicators, 'paris-marne-la-vallee');
    expect(car).toEqual({
      key: 'carOwnership',
      value: [
        { year: 2017, value: 34.4 },
        { year: 2023, value: 31.2 },
      ],
      unit: '% of households',
      source: CAR_OWNERSHIP_SOURCE,
      ...PENDING,
    });
  });

  it('attaches the benchmark and SDG-11 target seams to a sourced sub-metric too', () => {
    // A real figure is still uninterpretable without them, so they ride along
    // whether or not the sub-metric itself is sourced.
    const carDensity = impactSubMetrics(carDensityIndicators, 'koeln')[1];
    expect(carDensity.value).not.toBeNull();
    expect(carDensity.benchmark).toBeNull();
    expect(carDensity.sdgTarget).toBeNull();
  });
});

const MODAL_SOURCE = {
  url: 'https://www.stadt-koeln.de/mediaasset/content/pdf15/vlr_koeln_de_2023.pdf',
  label: 'Stadt Köln – Verkehrsentwicklung (VLR 2023)',
  accessed: '2026-07-30',
};
// Two modes across two years, out of order, to exercise the pivot + sort.
const modalRows = [
  {
    citySlug: 'koeln',
    indicatorKey: 'modal_split_car',
    value: 25,
    year: 2022,
    sourceUrl: MODAL_SOURCE.url,
    sourceLabel: MODAL_SOURCE.label,
    sourceAccessed: MODAL_SOURCE.accessed,
  },
  {
    citySlug: 'koeln',
    indicatorKey: 'modal_split_bike',
    value: 9,
    year: 1982,
    sourceUrl: MODAL_SOURCE.url,
    sourceLabel: MODAL_SOURCE.label,
    sourceAccessed: MODAL_SOURCE.accessed,
  },
  {
    citySlug: 'koeln',
    indicatorKey: 'modal_split_car',
    value: 48,
    year: 1982,
    sourceUrl: MODAL_SOURCE.url,
    sourceLabel: MODAL_SOURCE.label,
    sourceAccessed: MODAL_SOURCE.accessed,
  },
  {
    citySlug: 'koeln',
    indicatorKey: 'modal_split_bike',
    value: 18,
    year: 2017,
    sourceUrl: MODAL_SOURCE.url,
    sourceLabel: MODAL_SOURCE.label,
    sourceAccessed: MODAL_SOURCE.accessed,
  },
  {
    citySlug: 'koeln',
    indicatorKey: 'modal_split_bike',
    value: 25,
    year: 2022,
    sourceUrl: MODAL_SOURCE.url,
    sourceLabel: MODAL_SOURCE.label,
    sourceAccessed: MODAL_SOURCE.accessed,
  },
];

describe('modalSplitForCity', () => {
  it('pivots long-format rows into per-year rings, oldest first, in mode order', () => {
    // Missing modes (transit/walk here, and moto for every Cologne row) fill as
    // 0 so ring segments always align. 1982 is in the fixture and not in the
    // result: the modules show 2015 onwards, and the rows behind the older
    // rings stay in cities.csv rather than being deleted to make that true.
    expect(modalSplitForCity(modalRows, 'koeln')).toEqual({
      modes: ['transit', 'bike', 'walk', 'car', 'moto'],
      rings: [
        { year: 2017, values: [0, 18, 0, 0, 0] },
        { year: 2022, values: [0, 25, 0, 25, 0] },
      ],
      latestYear: 2022,
      source: MODAL_SOURCE,
    });
  });

  it('is null for a city with no modal-split rows', () => {
    expect(modalSplitForCity(modalRows, 'lisboa')).toBeNull();
  });
});

describe('modalSplitTargetForCity', () => {
  it("exposes Cologne's sourced Umweltverbund-vs-car target, comparable to the actual ring", () => {
    expect(modalSplitTargetForCity('koeln')).toEqual({
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
      // How the strategy words its own goal, for the sentence the opened card
      // states in full. The share stays a number; the period and the plan's name
      // are the document's wording and are resolved through i18n.
      periodKey: 'impact.modalSplitTarget.period',
      strategyKey: 'impact.modalSplitTarget.strategy',
      source: {
        url: 'https://www.stadt-koeln.de/mediaasset/content/pdf66/dritter-nahverkehrsplan-12-2017.pdf',
        label: 'Stadt Köln – 3. Nahverkehrsplan (2017), zitiert „Köln mobil 2025“',
        accessed: '2026-08-18',
      },
    });
  });

  it("exposes Paris's sourced bike-only target, flagged as not comparable to the actual ring", () => {
    // Paris's actual donut is Insee RP2022 commute trips; this target is
    // benchmarked against an all-trips survey (EGT 2020) — different
    // populations, so comparable: false rather than a false percentage gap.
    expect(modalSplitTargetForCity('paris-marne-la-vallee')).toEqual({
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
    });
  });

  it('is null for a city with no sourced target', () => {
    expect(modalSplitTargetForCity('lisboa')).toBeNull();
  });

  it('is null with no city (e.g. no focused project)', () => {
    expect(modalSplitTargetForCity(null)).toBeNull();
  });
});

describe('problemFitForCity', () => {
  it("exposes Cologne's SDG 11 targets, L2 body blocks, and the slug keying its i18n", () => {
    const pf = problemFitForCity('koeln');
    expect(pf.slug).toBe('koeln');
    expect(pf.targets).toEqual(['11.2', '11.6']);
    // Cologne's L2 breaks into named components + a goal block.
    expect(pf.body.length).toBeGreaterThan(1);
    expect(pf.body.at(-1)).toMatchObject({ goal: true });
  });

  it('exposes Paris as a single overview body block', () => {
    expect(problemFitForCity('paris-marne-la-vallee')).toEqual({
      slug: 'paris-marne-la-vallee',
      targets: ['11.2', '11.6'],
      body: [{ text: 'overview' }],
    });
  });

  it('is null for a city with no researched Problem Fit content', () => {
    expect(problemFitForCity('lisboa')).toBeNull();
  });

  it('is null with no city (e.g. no focused project)', () => {
    expect(problemFitForCity(null)).toBeNull();
  });
});

describe('cityHasResearchedContent', () => {
  it('is true for Cologne — a Problem Fit entry alone qualifies', () => {
    expect(cityHasResearchedContent('koeln', indicators)).toBe(true);
  });

  it('is true for Paris via a sourced Impact sub-metric', () => {
    expect(cityHasResearchedContent('paris-marne-la-vallee', carOwnershipIndicators)).toBe(true);
  });

  it('is false for a city with only context rows (Lisbon → coming soon)', () => {
    expect(cityHasResearchedContent('lisboa', indicators)).toBe(false);
  });

  it('is false with no focused city', () => {
    expect(cityHasResearchedContent(null, indicators)).toBe(false);
  });
});

describe('cycleNetworkForCity', () => {
  const cycleRow = {
    citySlug: 'koeln',
    indicatorKey: 'cycle_network',
    value: 1.75,
    unit: 'km per 1000 residents',
    sourceUrl: 'https://example.test/cycle',
    sourceLabel: 'Stadt Köln',
    sourceAccessed: '2026-07-30',
  };

  it('exposes the single figure with its unit and source', () => {
    expect(cycleNetworkForCity([cycleRow], 'koeln')).toEqual({
      value: 1.75,
      unit: 'km per 1000 residents',
      source: { url: 'https://example.test/cycle', label: 'Stadt Köln', accessed: '2026-07-30' },
    });
  });

  it('is null for a city with no cycle-network row', () => {
    expect(cycleNetworkForCity([cycleRow], 'lisboa')).toBeNull();
  });
});

// The six L2 modules. What is worth pinning here is the seam, not the copy: a
// module's `kind` is what decides which shape detailContent.js renders, a
// topic without sourced rows has to come back empty rather than half-built, and
// the display window has to cut the same year off every series — two modules
// standing side by side covering different spans is a comparison nobody made.
describe('impactModules', () => {
  const src = (url) => ({
    sourceUrl: url,
    sourceLabel: 'Stadt Köln',
    sourceAccessed: '2026-08-23',
  });
  const rows = [
    // One row on either side of the window, in the same series.
    {
      citySlug: 'koeln',
      indicatorKey: 'air_pm25',
      value: 20,
      unit: 'µg/m³',
      year: 2011,
      ...src('https://example.test/air'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'air_pm25',
      value: 16,
      unit: 'µg/m³',
      year: 2015,
      ...src('https://example.test/air'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'air_no2',
      value: 27,
      unit: 'µg/m³',
      year: 2025,
      ...src('https://example.test/air'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'cycle_network',
      value: 2.48,
      unit: 'km per 1000 residents',
      year: 2025,
      ...src('https://example.test/net'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'cycle_network_mixed',
      value: 780.31,
      unit: 'km',
      year: 2025,
      ...src('https://example.test/net'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'cycle_network_planned',
      value: 198.59,
      unit: 'km',
      year: 2025,
      ...src('https://example.test/net'),
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'traffic_casualties',
      value: 4.8,
      unit: 'per 1000 residents',
      year: 2020,
      ...src('https://example.test/vlr'),
    },
  ];

  it('always returns the six slots, in the order they fly out in', () => {
    expect(impactModules(rows, 'koeln').map((module) => module.key)).toEqual([
      'modalSplit',
      'car',
      'airQuality',
      'cycleNetwork',
      'cyclists',
      'roadSafety',
    ]);
  });

  it('gives each topic the kind its data has, and null where there is none', () => {
    const kinds = Object.fromEntries(
      impactModules(rows, 'koeln').map((module) => [module.key, module.kind]),
    );
    expect(kinds).toEqual({
      modalSplit: null,
      car: null,
      airQuality: 'lines',
      cycleNetwork: 'breakdown',
      cyclists: null,
      roadSafety: 'trend',
    });
  });

  // The info point's copy is keyed off the module it belongs to. Attached in one
  // place for all three criteria (withInfoKeys), so what is worth checking is
  // that it reaches every card that has something to explain and no card that
  // has not — an empty shell would otherwise offer an explanation of nothing.
  it('gives every card with content a key for its own explanation', () => {
    const modules = impactModules(rows, 'koeln');
    const withInfo = modules.filter((module) => module.infoKey);
    expect(withInfo.map((module) => module.infoKey)).toEqual([
      'impact.info.airQuality',
      'impact.info.cycleNetwork',
      'impact.info.roadSafety',
    ]);
    expect(withInfo.every((module) => module.kind)).toBe(true);
    expect(modules.filter((module) => !module.kind).every((module) => !module.infoKey)).toBe(true);
  });

  it('draws only the pollutants it has rows for, from 2015 on', () => {
    const air = impactModules(rows, 'koeln')[2];
    expect(air.lines).toEqual([
      { key: 'pm25', points: [{ year: 2015, value: 16 }] },
      { key: 'no2', points: [{ year: 2025, value: 27 }] },
    ]);
    expect(air.unit).toBe('µg/m³');
  });

  it('carries the planned length beside the parts it is planned on top of', () => {
    const network = impactModules(rows, 'koeln')[3];
    expect(network.parts).toEqual([{ key: 'mixed', value: 780.31 }]);
    expect(network.total).toBe(780.31);
    expect(network.planned).toBe(198.59);
    expect(network.headline.value).toBe(2.48);
  });

  // A sentence about the figures needs a document as much as the figures do.
  // A note that rests on the card's own rows carries no second chip (OWN_SOURCE);
  // one drawn from somewhere else names where it came from. Cologne's three
  // written notes all read off their own figures today, so none of them adds a
  // chip — the card cites the document its numbers came from, once.
  it('gives a note no second chip when it rests on the card\u2019s own figures', () => {
    const modules = impactModules(rows, 'koeln');
    expect(modules[2].note).toEqual({ key: 'koeln.airQuality', source: null });
    expect(modules[3].note).toEqual({ key: 'koeln.cycleNetwork', source: null });
    expect(modules[5].note).toEqual({ key: 'koeln.roadSafety', source: null });
  });

  it('is six empty slots with no city focused', () => {
    expect(impactModules(rows, null).every((module) => module.kind === null)).toBe(true);
  });
});

describe('problemFitModules', () => {
  it("lays a city's targets and narrative out one block per card", () => {
    const modules = problemFitModules(problemFitForCity('koeln'));
    expect(modules.map((module) => module.kind)).toEqual(Array(6).fill('prose'));
    expect(modules[0]).toMatchObject({
      labelKey: 'problemFit.targetHeading',
      labelCode: '11.2',
      text: 'problemFit.koeln.target.11.2',
    });
    // A block with a lead-in term takes it as the card's heading; the intro
    // paragraph has none and leads with its own text instead.
    expect(modules[2].labelKey).toBeNull();
    expect(modules[3]).toMatchObject({
      labelKey: 'problemFit.koeln.ringsTerm',
      text: 'problemFit.koeln.ringsBody',
    });
  });

  it('leaves the cards a shorter city does not fill empty', () => {
    const modules = problemFitModules(problemFitForCity('paris-marne-la-vallee'));
    expect(modules.map((module) => module.kind)).toEqual([
      'prose',
      'prose',
      'prose',
      null,
      null,
      null,
    ]);
  });

  it('is six empty slots for a city with no Problem Fit content', () => {
    expect(problemFitModules(null).every((module) => module.kind === null)).toBe(true);
  });
});

describe('adoptionModules', () => {
  // The three context rows the card is built from, as they sit in cities.csv.
  const contextRows = [
    {
      citySlug: 'koeln',
      indicatorKey: 'population',
      value: 1028273,
      unit: 'people',
      year: 2025,
      sourceUrl: 'https://worldpopulationreview.com/cities',
      sourceLabel: 'World Population Review',
      sourceAccessed: null,
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'area_km2',
      value: 405,
      unit: 'km²',
      year: null,
      sourceUrl: 'https://citypopulation.de/en/',
      sourceLabel: 'citypopulation.de',
      sourceAccessed: null,
    },
    {
      citySlug: 'koeln',
      indicatorKey: 'ring_cycle_lanes_km',
      value: 10,
      unit: 'km',
      year: 2024,
      sourceUrl:
        'https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/mobilitaetswende-auf-den-ringen',
      sourceLabel: 'Stadt Köln – Mobilitätswende auf den Ringen',
      sourceAccessed: '2026-08-23',
    },
    // The cost card's three rows, all read off the one press release.
    ...['ringe_cost_build', 'ringe_cost_signals', 'ringe_converted_km'].map((indicatorKey, i) => ({
      citySlug: 'koeln',
      indicatorKey,
      value: [2900000, 1500000, 9][i],
      unit: ['EUR', 'EUR', 'km'][i],
      year: 2023,
      sourceUrl:
        'https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/neun-kilometer-fahrradinfrastruktur-auf-den-koelner-ringen',
      sourceLabel: 'Stadt Köln – Neun Kilometer Fahrradinfrastruktur auf den Kölner Ringen',
      sourceAccessed: '2026-08-23',
    })),
  ];

  it('lays the six adoption cards out in the order the design puts them in', () => {
    const modules = adoptionModules(contextRows, 'koeln');
    expect(modules.map((module) => module.key)).toEqual([
      'cost',
      'context',
      'departments',
      'partners',
      'recommendation',
      'funding',
    ]);
    expect(modules.map((module) => module.kind)).toEqual([
      'cost',
      'facts',
      'links',
      'links',
      'prose',
      'linkGroups',
    ]);
  });

  // The card's whole point is the one figure the city published set against the
  // three it did not: an item with no row keeps its line and loses its number.
  it('builds the cost card from the published sum and the lines that have none', () => {
    const [cost] = adoptionModules(contextRows, 'koeln');
    expect(cost.headline).toEqual({ value: 2900000, year: 2023 });
    expect(cost.length).toEqual({ value: 9, unit: 'km' });
    expect(cost.coversKey).toBe('adoption.koeln.costCovers');
    expect(cost.items).toEqual([
      {
        key: 'signals',
        labelKey: 'adoption.koeln.cost.signals',
        value: 1500000,
      },
      { key: 'planning', labelKey: 'adoption.koeln.cost.planning', value: null },
      { key: 'gapClosures', labelKey: 'adoption.koeln.cost.gapClosures', value: null },
      { key: 'ebertplatz', labelKey: 'adoption.koeln.cost.ebertplatz', value: null },
    ]);
  });

  // 2,900,000 / 9 = 322,222.2… — quoted to the nearest thousand, because the
  // two figures it divides are themselves "etwa 2,9 Millionen" and "neun
  // Kilometer" and the digits past that are precision the source never had.
  it('derives the per-kilometre rate no finer than its inputs', () => {
    expect(adoptionModules(contextRows, 'koeln')[0].perKm).toBe(322000);
  });

  // Three rows, one document: the card carries one chip, not three.
  it('chips the cost card once per document behind it', () => {
    const [cost] = adoptionModules(contextRows, 'koeln');
    expect(cost.sources).toHaveLength(1);
    expect(cost.sources[0].url).toContain('neun-kilometer-fahrradinfrastruktur');
  });

  // No sourced sum, no card — the same rule the other five follow.
  it('leaves the cost card empty where the sum is not in the data', () => {
    const withoutCost = contextRows.filter((row) => row.indicatorKey !== 'ringe_cost_build');
    expect(adoptionModules(withoutCost, 'koeln')[0]).toEqual({ key: 'cost', kind: null });
  });

  it('builds the context card from the sourced rows, with density derived', () => {
    const [, context] = adoptionModules(contextRows, 'koeln');
    expect(context.facts).toEqual([
      { key: 'population', value: 1028273, unit: 'people', year: 2025 },
      { key: 'ringCorridor', value: 10, unit: 'km', year: 2024 },
      { key: 'area', value: 405, unit: 'km²', year: null },
      { key: 'density', value: 2539, unit: 'per km²' },
    ]);
    // One chip per document behind the card — three rows, three sources, and
    // the derived figure adds none because it is computed from two of them.
    expect(context.sources).toHaveLength(3);
    expect(context.sources.map((source) => source.label)).toContain('citypopulation.de');
  });

  it('drops a context fact the city has no row for', () => {
    const [, context] = adoptionModules(contextRows.slice(0, 1), 'koeln');
    expect(context.facts.map((fact) => fact.key)).toEqual(['population']);
  });

  it('keeps the link text in i18n and the URL out of it', () => {
    const [, , departments, partners] = adoptionModules(contextRows, 'koeln');
    expect(departments.links).toEqual([
      {
        key: 'verkehrsmanagement',
        url: 'https://www.stadt-koeln.de/service/adressen/amt-fuer-verkehrsmanagement',
        textKey: 'adoption.koeln.departments.verkehrsmanagement',
      },
      {
        key: 'mobilitaet',
        url: 'https://www.stadt-koeln.de/service/adressen/10704/index.html',
        textKey: 'adoption.koeln.departments.mobilitaet',
      },
    ]);
    expect(partners.lead).toBe('adoption.koeln.partnersLead');
    expect(partners.links.map((link) => link.key)).toEqual(['ringfrei', 'adfc', 'vcd', 'dvr']);
  });

  // Quoted, not paraphrased — so the card has to be able to say where from.
  it('gives the recommendation the document it is quoted from', () => {
    const recommendation = adoptionModules(contextRows, 'koeln')[4];
    expect(recommendation.text).toBe('adoption.koeln.recommendation');
    expect(recommendation.source.url).toContain('dvr.de');
  });

  it('groups the funding routes by level, and names the ones with no page to open', () => {
    const funding = adoptionModules(contextRows, 'koeln')[5];
    expect(funding.groups.map((group) => group.key)).toEqual(['eu', 'federal', 'civic', 'private']);
    expect(funding.groups[0].links).toHaveLength(5);
    expect(funding.groups[3].links).toEqual([]);
    expect(funding.groups[3].plain).toEqual([
      'adoption.funding.sponsorship',
      'adoption.funding.transitAuthorities',
    ]);
  });

  it('is six empty slots for a city with no researched adoption content', () => {
    expect(adoptionModules(contextRows, 'lisboa').every((module) => module.kind === null)).toBe(
      true,
    );
    expect(adoptionModules(contextRows, null).every((module) => module.kind === null)).toBe(true);
  });
});
