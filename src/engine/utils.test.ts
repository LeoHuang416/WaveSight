import { describe, it, expect } from 'vitest';
import { mean, std, variance, median, quantile, min, max, skewness, kurtosis, covariance, pearsonR, spearmanR, extractNumericColumn, extractByGroup } from './utils';

describe('mean', () => {
  it('returns average of array', () => { expect(mean([1, 2, 3, 4, 5])).toBeCloseTo(3); });
  it('returns NaN for empty array', () => { expect(mean([])).toBeNaN(); });
  it('handles single value', () => { expect(mean([42])).toBe(42); });
});

describe('std', () => {
  it('returns sample standard deviation', () => {
    expect(std([1, 2, 3, 4, 5])).toBeCloseTo(1.5811, 3);
  });
  it('returns NaN for single value', () => { expect(std([1])).toBeNaN(); });
});

describe('variance', () => {
  it('returns sample variance', () => {
    expect(variance([1, 2, 3, 4, 5])).toBeCloseTo(2.5);
  });
});

describe('median', () => {
  it('returns middle value for odd length', () => { expect(median([1, 3, 2])).toBe(2); });
  it('returns average of middle values for even length', () => { expect(median([1, 2, 3, 4])).toBe(2.5); });
  it('returns NaN for empty', () => { expect(median([])).toBeNaN(); });
});

describe('quantile', () => {
  it('returns Q1 at 0.25', () => { expect(quantile([1, 2, 3, 4, 5], 0.25)).toBeCloseTo(2); });
  it('returns median at 0.5', () => { expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3); });
  it('returns Q3 at 0.75', () => { expect(quantile([1, 2, 3, 4, 5], 0.75)).toBeCloseTo(4); });
});

describe('min/max', () => {
  it('min returns smallest', () => { expect(min([3, 1, 2])).toBe(1); });
  it('max returns largest', () => { expect(max([3, 1, 2])).toBe(3); });
});

describe('skewness', () => {
  it('returns near 0 for symmetric data', () => {
    const v = [1, 2, 3, 3, 4, 5];
    expect(Math.abs(skewness(v))).toBeLessThan(0.5);
  });
  it('returns NaN for small sample', () => { expect(skewness([1, 2])).toBeNaN(); });
});

describe('kurtosis', () => {
  it('returns near 0 for normal-ish data', () => {
    const v = [1, 2, 3, 4, 5, 2, 3, 4, 1, 5, 3, 2];
    expect(Math.abs(kurtosis(v))).toBeLessThan(3);
  });
  it('returns NaN for small sample', () => { expect(kurtosis([1, 2, 3])).toBeNaN(); });
});

describe('covariance', () => {
  it('returns positive for positively correlated data', () => {
    expect(covariance([1, 2, 3], [2, 4, 6])).toBeGreaterThan(0);
  });
  it('returns NaN for mismatched length', () => {
    expect(covariance([1, 2], [1])).toBeNaN();
  });
});

describe('pearsonR', () => {
  it('returns 1 for perfect positive correlation', () => {
    expect(pearsonR([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
  });
  it('returns -1 for perfect negative correlation', () => {
    expect(pearsonR([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });
});

describe('spearmanR', () => {
  it('returns 1 for monotonic increasing', () => {
    expect(spearmanR([1, 2, 3], [10, 20, 30])).toBeCloseTo(1, 5);
  });
});

describe('extractNumericColumn', () => {
  it('extracts numbers from record rows', () => {
    const rows = [{ a: '1' }, { a: '2' }, { a: 'x' }, { a: 3 }];
    expect(extractNumericColumn(rows, 'a')).toEqual([1, 2, 3]);
  });
});

describe('extractByGroup', () => {
  it('groups numeric values by category', () => {
    const rows = [
      { val: '1', grp: 'A' }, { val: '2', grp: 'A' },
      { val: '3', grp: 'B' }, { val: 'x', grp: 'B' },
    ];
    const groups = extractByGroup(rows, 'val', 'grp');
    expect(groups.get('A')).toEqual([1, 2]);
    expect(groups.get('B')).toEqual([3]);
  });
});
