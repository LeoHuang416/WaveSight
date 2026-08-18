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
  it('appends significance stars to table cells', () => {
    // x and y are perfectly correlated (n=5) → p≈0 → three stars
    const r = runCorrelation(rows, ['x', 'y'], 'pearson');
    expect(String(r.table.rows[0][2])).toMatch(/^1\*{3}$/);
    // diagonal keeps the raw number (no stars)
    expect(r.table.rows[0][1]).toBe(1);
    expect(r.table.rows[0][0]).toBe('x');
  });
  it('keeps matrix values numeric (no stars)', () => {
    const r = runCorrelation(rows, ['x', 'y'], 'pearson');
    expect(typeof r.matrix[0][1]).toBe('number');
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
  it('includes quadratic and interaction terms in the coded model', () => {
    // y = 1 + x² + xy (x=y on 5 rows) → x² & x×y columns must appear
    const r = runRSM(rows, ['x', 'y'], 'z');
    const terms = r.table.rows.map((row) => String(row[0]));
    expect(terms.some((t) => t.includes('²'))).toBe(true);
    expect(terms.some((t) => t.includes('×'))).toBe(true);
    expect(r.codedDefs.length).toBe(2);
    expect(r.equation).toContain('X1');
  });
  it('computes R² and adjusted R² on a full quadratic surface', () => {
    // z = 5 - 2x - 3y + x² + y² + 0.5xy over a 4×4 grid (16 pts ≥ 6 terms)
    const quad: Record<string, unknown>[] = [];
    for (let xi = -2; xi <= 2; xi++) for (let yi = -2; yi <= 2; yi++) quad.push({ x: String(xi), y: String(yi), z: String(5 - 2 * xi - 3 * yi + xi * xi + yi * yi + 0.5 * xi * yi) });
    const r = runRSM(quad, ['x', 'y'], 'z');
    expect(r.r2).toBeGreaterThan(0.99);
    expect(r.adjR2).toBeGreaterThan(0.99);
  });
  it('finds an optimal solution within the design', () => {
    const quad: Record<string, unknown>[] = [];
    for (let xi = -1; xi <= 1; xi++) for (let yi = -1; yi <= 1; yi++) quad.push({ x: String(xi), y: String(yi), z: String(2 - (xi - 0.5) ** 2 - (yi + 0.25) ** 2) });
    const r = runRSM(quad, ['x', 'y'], 'z');
    expect(r.optimal).not.toBeNull();
    expect(r.optimal!.y).toBeGreaterThan(1);
  });
  it('returns actual-units equation and residual diagnostics', () => {
    const quad: Record<string, unknown>[] = [];
    for (let xi = -2; xi <= 2; xi++) for (let yi = -2; yi <= 2; yi++) quad.push({ x: String(xi), y: String(yi), z: String(5 - 2 * xi - 3 * yi + xi * xi + yi * yi + 0.5 * xi * yi) });
    const r = runRSM(quad, ['x', 'y'], 'z');
    expect(r.equationActual).toContain('x');
    expect(r.fitted.length).toBe(25);
    expect(r.residuals.length).toBe(25);
    expect(r.cooksD.length).toBe(25);
    expect(r.cooksD.every((d) => d >= 0)).toBe(true);
  });
  it('backward elimination removes non-significant terms (p>0.1)', () => {
    // y = 2 + 3x + x² (no y, no xy, no y² dependence) over a wide grid
    const quad: Record<string, unknown>[] = [];
    for (let xi = -2; xi <= 2; xi++) for (let yi = -2; yi <= 2; yi++) quad.push({ x: String(xi), y: String(yi), z: String(2 + 3 * xi + xi * xi) });
    const r = runRSM(quad, ['x', 'y'], 'z');
    const terms = r.table.rows.map((row) => String(row[0]));
    // y (linear), xy, y² all truly 0 → should be eliminated
    expect(terms).not.toContain('y');
    expect(terms).not.toContain('x×y');
    expect(terms).not.toContain('y²');
    expect(terms).toContain('x');
    // equation should not contain eliminated terms
    expect(r.equation).not.toContain('·X2');
    expect(r.equation).not.toContain('×X');
  });
  it('actual-units equation is derived from coded coefficients (not a raw re-fit)', () => {
    // coded: z = 1 + 2·X1 + X1²,  X1=(x-0)/2  → actual: z = 1 + 2·(x/2) + (x/2)² = 1 + x + x²/4
    const quad: Record<string, unknown>[] = [];
    for (let xi = -2; xi <= 2; xi++) for (let yi = -2; yi <= 2; yi++) quad.push({ x: String(xi), y: String(yi), z: String(1 + 2 * (xi / 2) + (xi / 2) ** 2) });
    const r = runRSM(quad, ['x', 'y'], 'z');
    expect(r.equationActual).toContain('0.25·x²');
    expect(r.equationActual).toContain('·x');
  });
  it('accepts a 3-factor Box-Behnken-style design (full quadratic, adjR² ≥ 0.90)', () => {
    // Box-Behnken 3-factor: y = 76.6 + 5.91A + 4.67B + 2.89C - 5A² - 3B² - 2C² + 2AB - 1.5AC + 3BC
    const f = (A: number, B: number, C: number) => 76.6 + 5.91 * A + 4.67 * B + 2.89 * C - 5 * A * A - 3 * B * B - 2 * C * C + 2 * A * B - 1.5 * A * C + 3 * B * C;
    const bb: Record<string, unknown>[] = [];
    const pts: [number, number, number][] = [
      [-1, -1, 0], [1, -1, 0], [-1, 1, 0], [1, 1, 0],
      [-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1],
      [0, -1, -1], [0, 1, -1], [0, -1, 1], [0, 1, 1],
      [0, 0, 0], [0, 0, 0], [0, 0, 0],
    ];
    pts.forEach(([a, b, c], i) => bb.push({ A: String(a), B: String(b), C: String(c), Y: String(f(a, b, c)) }));
    const r = runRSM(bb, ['A', 'B', 'C'], 'Y');
    expect(r.r2).toBeGreaterThan(0.99);
    expect(r.adjR2).toBeGreaterThan(0.9);
    expect(r.optimal).not.toBeNull();
    // equation should contain X1² and X1×X2 term labels
    expect(r.equation).toContain('X1²');
    expect(r.equation).toContain('X1×X2');
  });
  it('real BB data: 6-term equation + full-model diagnostics flag runs 8/12 as influential, not outliers', () => {
    // 真实 Box-Behnken 3 因子 15 次实验（编码 A/B/C → 产率 Y）
    const bb: Record<string, unknown>[] = [
      { A: -1, B: -1, C: 0, Y: 66.75 }, { A: -1, B: 1, C: 0, Y: 69.79 },
      { A: 1, B: -1, C: 0, Y: 74.97 }, { A: 1, B: 1, C: 0, Y: 88.28 },
      { A: -1, B: 0, C: -1, Y: 64.15 }, { A: -1, B: 0, C: 1, Y: 73.15 },
      { A: 1, B: 0, C: -1, Y: 81.87 }, { A: 1, B: 0, C: 1, Y: 76.0 },
      { A: 0, B: -1, C: -1, Y: 72.3 }, { A: 0, B: -1, C: 1, Y: 73.81 },
      { A: 0, B: 1, C: -1, Y: 74.3 }, { A: 0, B: 1, C: 1, Y: 92.8 },
      { A: 0, B: 0, C: 0, Y: 82.36 }, { A: 0, B: 0, C: 0, Y: 79.13 },
      { A: 0, B: 0, C: 0, Y: 79.41 },
    ];
    const r = runRSM(bb, ['A', 'B', 'C'], 'Y');
    // 向后剔除保留 A, B, C, A², A×C, B×C；剔除 A×B, B², C²
    const terms = r.table.rows.map((row) => String(row[0]));
    for (const keep of ['A', 'B', 'C', 'A²', 'A×C', 'B×C']) expect(terms).toContain(keep);
    for (const drop of ['A×B', 'B²', 'C²']) expect(terms).not.toContain(drop);
    // 残差诊断基于完整二次模型：Run8 预测≈78.88、标准化残差≈−0.92（非统计异常）
    expect(r.fitted[7]).toBeCloseTo(78.88, 1);
    expect(r.stdResid[7]).toBeCloseTo(-0.92, 1);
    expect(r.stdResid[11]).toBeCloseTo(0.86, 1);
    expect(r.outliers).not.toContain(7);
    expect(r.outliers).not.toContain(11);
    // Run8 / Run12 标为「影响较大」（Cook>4/n），而非「统计异常」
    expect(String(r.residTable.rows[7][6])).toContain('影响较大');
    expect(String(r.residTable.rows[11][6])).toContain('影响较大');
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
