import { describe, it, expect } from 'vitest';
import {
  cityIndicatorsForCity,
  cityIndicatorValue,
  populationDensityForCity,
  widgetMetricsForProject,
  carDensitySeriesForCity,
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

describe('impactSubMetrics', () => {
  it('exposes modal split and cycle network as null until content is sourced', () => {
    // Same Neutrality/Honesty contract as widgetMetricsForProject — the keys
    // are what widgetStack.js relies on, the nulls keep any fabricated figure
    // from rendering (see docs/DATA_TODO.md).
    expect(impactSubMetrics(carDensityIndicators, 'lisboa')).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null },
      { key: 'carDensity', value: null, unit: null, source: null },
      { key: 'cycleNetwork', value: null, unit: null, source: null },
    ]);
  });

  it('defaults to all null when called with no city (e.g. no focused project)', () => {
    expect(impactSubMetrics()).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null },
      { key: 'carDensity', value: null, unit: null, source: null },
      { key: 'cycleNetwork', value: null, unit: null, source: null },
    ]);
  });

  it("exposes Cologne's car density as its sourced series, unit and source", () => {
    expect(impactSubMetrics(carDensityIndicators, 'koeln')).toEqual([
      { key: 'modalSplit', value: null, unit: null, source: null },
      {
        key: 'carDensity',
        value: [
          { year: 2021, value: 378 },
          { year: 2025, value: 373 },
        ],
        unit: 'per 1000 residents',
        source: CAR_DENSITY_SOURCE,
      },
      { key: 'cycleNetwork', value: null, unit: null, source: null },
    ]);
  });
});
