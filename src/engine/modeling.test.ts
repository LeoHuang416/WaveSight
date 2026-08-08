import { describe, it, expect } from 'vitest';
import { runCorrelation, runLinearRegression, runNonlinearFit, runRSM, runPCA } from './modeling';

const rows = [
  { x: '1', y: '2', z: '3', grp: 'A' },
  { x: '2', y: '4', z: '5', grp: 'A' },
  { x: '3', y: '6', z: '7', grp: 'B' },
  { x: '4', y: '8', z: '9', grp: 'B' },
  { x: '5', y: '10', z: '11', grp: 'B' },
];

describe('runCorrelation', () => {
  it('returns correlation matrix with pearson', () => {
    const r = runCorrelation(rows, ['x', 'y'], 'pearson');
    expect(r.matrix).toHaveLength(2);
    expect(r.matrix[0][1]).toBeCloseTo(1, 3); // x and y are perfectly correlated
  });
  it('supports spearman method', () => {
    const r = runCorrelation(rows, ['x', 'y'], 'spearman');
    expect(r.matrix[0][1]).toBeCloseTo(1, 3);
  });
});

describe('runLinearRegression', () => {
  it('fits simple linear regression', () => {
    const r = runLinearRegression(rows, ['x'], 'y');
    expect(r.conclusion).toContain('R²');
    expect(Number(r.conclusion.match(/R² = ([\d.]+)/)?.[1] ?? 0)).toBeCloseTo(1, 1);
    expect(r.fittedValues).toHaveLength(5);
    expect(r.residuals).toHaveLength(5);
  });
});

describe('runNonlinearFit', () => {
  it('fits exponential model', () => {
    const expRows = [
      { x: '0', y: '1' }, { x: '1', y: '2.71' }, { x: '2', y: '7.38' },
    ];
    const r = runNonlinearFit(expRows, 'x', 'y', 'exp');
    expect(r.table.rows.length).toBeGreaterThan(0);
    expect(r.fitted.length).toBe(3);
  });
  it('fits linear model', () => {
    const r = runNonlinearFit(rows, 'x', 'y', 'linear');
    expect(r.conclusion).toContain('R²');
    expect(r.fitted.length).toBe(5);
  });
  it('fits gauss model', () => {
    const r = runNonlinearFit(rows, 'x', 'y', 'gauss');
    expect(r.conclusion).toContain('R²');
  });
  it('fits power model', () => {
    const r = runNonlinearFit(rows, 'x', 'y', 'power');
    expect(r.conclusion).toContain('R²');
  });
});

describe('runRSM', () => {
  it('returns quadratic model for 2 factors', () => {
    const r = runRSM(rows, ['x', 'y'], 'z');
    expect(r.conclusion).toContain('R²');
    expect(r.table.rows.length).toBeGreaterThan(2);
  });
  it('rejects fewer than 2 factors', () => {
    const r = runRSM(rows, ['x'], 'z');
    expect(r.table.rows[0][0]).toBe('因素数量需为 2 或 3');
  });
});

describe('runPCA', () => {
  it('returns eigenvalues and loadings', () => {
    const r = runPCA(rows, ['x', 'y', 'z']);
    expect(r.eigenvalues).toHaveLength(3);
    expect(r.scores).toHaveLength(5); // one per row
    expect(r.table.rows).toHaveLength(3);
    // eigenvalues should be sorted descending
    expect(r.eigenvalues[0]).toBeGreaterThanOrEqual(r.eigenvalues[1]);
  });
  it('works with 2 columns', () => {
    const r = runPCA(rows, ['x', 'y']);
    expect(r.eigenvalues).toHaveLength(2);
  });
});
