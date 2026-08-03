import { describe, it, expect } from 'vitest';
import {
  cityIndicatorsForCity,
  cityIndicatorValue,
  populationDensityForCity,
  widgetMetricsForProject,
  carDensitySeriesForCity,
  modalSplitForCity,
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
  it('exposes the three Exploration widgets, all null until content is researched', () => {
    // Placeholder shells (see docs/DATA_TODO.md) — the keys are the contract the
    // widget stack relies on; the nulls keep any fabricated figure from rendering.
    expect(widgetMetricsForProject()).toEqual({
      problemFit: null,
      impact: null,
      adoption: null,
    });
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
