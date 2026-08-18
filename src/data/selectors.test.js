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
    });
  });

  it('returns an empty series and null source for a city with no car_density rows', () => {
    expect(carDensitySeriesForCity(carDensityIndicators, 'lisboa')).toEqual({
      series: [],
      unit: null,
      source: null,
    });
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
    // 0 so ring segments always align.
    expect(modalSplitForCity(modalRows, 'koeln')).toEqual({
      modes: ['transit', 'bike', 'walk', 'car', 'moto'],
      rings: [
        { year: 1982, values: [0, 9, 0, 48, 0] },
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
        { mode: 'umweltverbund', share: 67, actualModes: ['transit', 'bike', 'walk'] },
        { mode: 'car', share: 33 },
      ],
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
