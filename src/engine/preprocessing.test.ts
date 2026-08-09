import { describe, it, expect } from 'vitest';
import { runMissingDiagnostic, runOutlierDetection, runStandardization } from './preprocessing';

const cleanRows = [
  { a: '1', b: '2', c: '3' },
  { a: '2', b: '4', c: '6' },
  { a: '3', b: '6', c: '9' },
  { a: '4', b: '8', c: '12' },
  { a: '5', b: '10', c: '15' },
];

const rowsWithMissing = [
  { a: '1', b: '2', c: '3' },
  { a: null, b: '4', c: '6' },
  { a: '3', b: null, c: null },
  { a: '4', b: '8', c: '12' },
  { a: undefined, b: '10', c: '' },
];

const rowsWithOutlier = [
  { x: '1', y: '2' },
  { x: '2', y: '4' },
  { x: '3', y: '6' },
  { x: '4', y: '8' },
  { x: '100', y: '200' }, // clear outliers
];

describe('runMissingDiagnostic', () => {
  it('reports zero missing for clean data', () => {
    const { table, missingCounts } = runMissingDiagnostic(cleanRows, ['a', 'b', 'c']);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0][2]).toBe(0); // missing count for 'a'
    expect(table.rows[1][2]).toBe(0);
    expect(missingCounts['a']).toBe(0);
  });

  it('detects missing values correctly', () => {
    const { table, missingCounts } = runMissingDiagnostic(rowsWithMissing, ['a', 'b', 'c']);
    // a: index 1 (null) and index 4 (undefined) → 2 missing out of 5 = 40%
    expect(missingCounts['a']).toBe(2);
    // b: index 2 (null) → 1 missing out of 5 = 20%
    expect(missingCounts['b']).toBe(1);
    // c: index 2 (null) and index 4 ('') → 2 missing out of 5 = 40%
    expect(missingCounts['c']).toBe(2);
    expect(table.rows[0][4]).toBe('⚠ 缺失率偏高，建议确认'); // 40% > 5%
  });
});

describe('runOutlierDetection', () => {
  it('detects and caps outliers via IQR method', () => {
    const { table, cappedRows, totalOutliers } = runOutlierDetection(rowsWithOutlier, ['x', 'y']);
    expect(totalOutliers).toBe(2); // x=100 and y=200

    // Check that the outlier row (index 4) was capped
    const cappedX = Number(cappedRows[4]['x']);
    const cappedY = Number(cappedRows[4]['y']);
    expect(cappedX).toBeLessThan(100);
    expect(cappedY).toBeLessThan(200);

    // The first four rows should be unchanged
    expect(Number(cappedRows[0]['x'])).toBe(1);
    expect(Number(cappedRows[0]['y'])).toBe(2);
  });

  it('handles clean data with no outliers', () => {
    const { totalOutliers } = runOutlierDetection(cleanRows, ['a', 'b', 'c']);
    expect(totalOutliers).toBe(0);
  });
});

describe('runStandardization', () => {
  it('standardizes to mean ~0 and std ~1', () => {
    const { table, standardizedRows } = runStandardization(cleanRows, ['a', 'b', 'c']);

    // After standardization, means should be close to 0
    for (const col of ['a', 'b', 'c']) {
      const values = standardizedRows.map((r) => Number(r[col]));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      expect(avg).toBeCloseTo(0, 1);
    }

    // Check table structure
    expect(table.rows).toHaveLength(3);
    expect(table.headers).toContain('标准化后均值');
  });

  it('preserves non-numeric columns unchanged', () => {
    const mixed = [
      { x: '1', label: 'A' },
      { x: '2', label: 'B' },
    ];
    const { standardizedRows } = runStandardization(mixed, ['x']);
    expect(standardizedRows[0]['label']).toBe('A');
    expect(standardizedRows[1]['label']).toBe('B');
  });
});
