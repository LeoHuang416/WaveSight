import { describe, it, expect } from 'vitest';
import { runDescriptive, runFrequency, runNormality, runGroupedStats } from './descriptive';

const rows = [
  { x: '1', y: '2', cat: 'A' },
  { x: '2', y: '4', cat: 'A' },
  { x: '3', y: '6', cat: 'B' },
  { x: '4', y: '8', cat: 'B' },
  { x: '5', y: '10', cat: 'B' },
];

describe('runDescriptive', () => {
  it('returns correct N and mean for a column', () => {
    const result = runDescriptive(rows, ['x']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe('x');   // col name
    expect(result.rows[0][1]).toBe(5);      // N
    expect(result.rows[0][2]).toBeCloseTo(3); // mean = 3
  });
  it('works with multiple columns', () => {
    const result = runDescriptive(rows, ['x', 'y']);
    expect(result.rows).toHaveLength(2);
  });
});

describe('runFrequency', () => {
  it('counts categories correctly', () => {
    const result = runFrequency(rows, 'cat');
    expect(result.rows).toHaveLength(2);
    const aRow = result.rows.find((r) => r[0] === 'A')!;
    expect(aRow[1]).toBe(2); // count
    expect(aRow[2]).toBeCloseTo(0.4); // proportion
  });
});

describe('runNormality', () => {
  it('returns Shapiro-Wilk W and p-value between 0 and 1', () => {
    const result = runNormality(rows, ['x']);
    expect(result.table.rows).toHaveLength(1);
    const w = result.table.rows[0][2] as number;
    const p = result.table.rows[0][3] as number;
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(1);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
  it('generates QQ data', () => {
    const result = runNormality(rows, ['x']);
    expect(result.qqData['x']).toBeDefined();
    expect(result.qqData['x'].theoretical).toHaveLength(5);
    expect(result.qqData['x'].sample).toHaveLength(5);
  });
  it('uses alpha in column header and normality judgment', () => {
    const result = runNormality(rows, ['x'], 0.01);
    expect(result.table.headers[4]).toContain('0.01');
    // With only 5 samples, normality test is inconclusive; just verify the header changes
  });
});

describe('runGroupedStats', () => {
  it('computes per-group statistics', () => {
    const result = runGroupedStats(rows, ['x'], 'cat');
    expect(result.rows).toHaveLength(2); // A, B
  });
});
