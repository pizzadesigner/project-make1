import { describe, it, expect } from 'vitest';
import { validateDataset, DataError } from './validate.js';

// A minimal valid project row; individual tests override single fields.
function projectRow(overrides = {}) {
  return {
    id: 'zilina-cyklochodniky-2023',
    city: 'zilina',
    city_display: 'Žilina',
    country: 'Slovakia',
    country_iso2: 'SK',
    lat: '49.2231',
    lon: '18.7394',
    project_title: 'Žilina Cyklochodníky',
    sdg11_target: '11.2',
    category: 'transport',
    summary: 'Protected cycle paths.',
    description: 'A phased build-out.',
    budget_eur: '1850000',
    budget_year: '2023',
    funding_source: 'EU Cohesion Fund',
    start_year: '2021',
    end_year: '',
    status: 'ongoing',
    transferability_score: '78',
    source_url: 'https://example.org',
    source_label: 'Mesto Žilina',
    source_accessed: '2026-05-14',
    ...overrides,
  };
}

describe('validateDataset — coercion', () => {
  it('coerces numbers and preserves diacritics', () => {
    const { projects } = validateDataset({ projectRows: [projectRow()] });
    expect(projects[0].cityDisplay).toBe('Žilina');
    expect(projects[0].lat).toBe(49.2231);
    expect(projects[0].budgetEur).toBe(1850000);
  });

  it('turns an empty cell into null, not 0', () => {
    const { projects } = validateDataset({ projectRows: [projectRow({ end_year: '' })] });
    expect(projects[0].endYear).toBeNull();
    expect(projects[0].endYear).not.toBe(0);
  });
});

describe('validateDataset — fatal errors', () => {
  it('throws on duplicate project ids', () => {
    expect(() => validateDataset({ projectRows: [projectRow(), projectRow()] })).toThrow(DataError);
  });

  it('throws on missing coordinates', () => {
    expect(() => validateDataset({ projectRows: [projectRow({ lat: '', lon: '' })] })).toThrow(
      /coordinates/,
    );
  });

  it('throws on an unknown sdg11_target', () => {
    expect(() => validateDataset({ projectRows: [projectRow({ sdg11_target: '11.9' })] })).toThrow(
      /unknown sdg11_target/,
    );
  });

  it('throws on an orphan metric project_id', () => {
    expect(() =>
      validateDataset({
        projectRows: [projectRow()],
        metricRows: [
          {
            project_id: 'does-not-exist',
            year: '2023',
            metric_key: 'x',
            metric_label: 'X',
            value: '1',
            unit: 'km',
            source_url: 'https://example.org',
            source_label: 'src',
          },
        ],
      }),
    ).toThrow(/unknown project_id/);
  });

  it('collects every issue in the thrown error', () => {
    try {
      validateDataset({ projectRows: [projectRow({ sdg11_target: '11.9', lat: '' })] });
      throw new Error('expected validateDataset to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect(error.issues.length).toBe(2);
    }
  });
});

describe('validateDataset — a metric without a source does not render', () => {
  it('drops the sourceless row instead of throwing', () => {
    const { metrics } = validateDataset({
      projectRows: [projectRow()],
      metricRows: [
        {
          project_id: 'zilina-cyklochodniky-2023',
          year: '2023',
          metric_key: 'cycle_path_km',
          metric_label: 'Protected cycle paths',
          value: '15',
          unit: 'km',
          source_url: '',
          source_label: '',
        },
      ],
    });
    expect(metrics).toHaveLength(0);
  });
});

// A minimal valid city-indicator row; its city_slug matches projectRow().city.
function cityRow(overrides = {}) {
  return {
    city_slug: 'zilina',
    indicator_key: 'population',
    indicator_label: 'Population (city proper)',
    value: '85000',
    unit: 'people',
    year: '2024',
    source_url: 'https://example.org',
    source_label: 'Source',
    source_accessed: '2026-05-14',
    ...overrides,
  };
}

describe('validateDataset — city indicators', () => {
  it('coerces a city indicator and joins it on citySlug', () => {
    const { cityIndicators } = validateDataset({
      projectRows: [projectRow()],
      cityRows: [cityRow()],
    });
    expect(cityIndicators).toHaveLength(1);
    expect(cityIndicators[0].citySlug).toBe('zilina');
    expect(cityIndicators[0].value).toBe(85000);
    expect(cityIndicators[0].year).toBe(2024);
  });

  it('turns an empty value cell into null, not 0', () => {
    const { cityIndicators } = validateDataset({
      projectRows: [projectRow()],
      cityRows: [cityRow({ value: '' })],
    });
    expect(cityIndicators[0].value).toBeNull();
  });

  it('drops a sourceless indicator instead of throwing', () => {
    const { cityIndicators } = validateDataset({
      projectRows: [projectRow()],
      cityRows: [cityRow({ source_url: '' })],
    });
    expect(cityIndicators).toHaveLength(0);
  });

  it('throws on an indicator referencing an unknown city_slug', () => {
    expect(() =>
      validateDataset({
        projectRows: [projectRow()],
        cityRows: [cityRow({ city_slug: 'nowhere' })],
      }),
    ).toThrow(/unknown city_slug/);
  });
});

// The milestone line is drawn to scale, which puts more weight on the year than
// a narrative row usually carries: a row whose year cannot be read has no place
// on the line at all, so it is an issue rather than a mark at zero.
describe('validateDataset — milestones', () => {
  // A city is known by having a project, not by appearing in cities.csv.
  const koeln = projectRow({ id: 'koeln-ringe', city: 'koeln', city_display: 'Köln' });
  const milestone = (overrides = {}) => ({
    city_slug: 'koeln',
    year: '2019',
    event: 'Einführung von Tempo 30 auf den gesamten Ringen',
    ...overrides,
  });

  it('reads a milestone row and sorts the line by year', () => {
    const { milestones } = validateDataset({
      projectRows: [koeln],
      milestoneRows: [milestone({ year: '2024', event: 'Barbarossaplatz' }), milestone()],
    });
    expect(milestones.map((row) => row.year)).toEqual([2019, 2024]);
    expect(milestones[0].event).toBe('Einführung von Tempo 30 auf den gesamten Ringen');
  });

  it('rejects a milestone for a city nobody has heard of', () => {
    expect(() =>
      validateDataset({
        projectRows: [koeln],
        milestoneRows: [milestone({ city_slug: 'atlantis' })],
      }),
    ).toThrow(DataError);
  });

  it('rejects a milestone with no usable year rather than placing it at zero', () => {
    expect(() =>
      validateDataset({ projectRows: [koeln], milestoneRows: [milestone({ year: '' })] }),
    ).toThrow(DataError);
    expect(() =>
      validateDataset({ projectRows: [koeln], milestoneRows: [milestone({ year: 'bald' })] }),
    ).toThrow(DataError);
  });
});
