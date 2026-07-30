import { describe, it, expect } from 'vitest';
import {
  cityIndicatorsForCity,
  cityIndicatorValue,
  populationDensityForCity,
  widgetMetricsForProject,
  impactSubMetrics,
} from './selectors.js';

// Real Cologne figures (population / area = 2539, matching the research table)
// plus one Lisbon row with no area, to exercise the null path.
const indicators = [
  { citySlug: 'koeln', indicatorKey: 'population', value: 1028273 },
  { citySlug: 'koeln', indicatorKey: 'area_km2', value: 405 },
  { citySlug: 'lisboa', indicatorKey: 'population', value: 596952 },
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

describe('impactSubMetrics', () => {
  it('exposes the three Impact sub-metrics, all null until content is sourced', () => {
    // Same Neutrality/Honesty contract as widgetMetricsForProject — the keys
    // are what widgetStack.js relies on, the nulls keep any fabricated figure
    // from rendering (see docs/DATA_TODO.md).
    expect(impactSubMetrics()).toEqual([
      { key: 'modalSplit', value: null },
      { key: 'carDensity', value: null },
      { key: 'cycleNetwork', value: null },
    ]);
  });
});
