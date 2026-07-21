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
