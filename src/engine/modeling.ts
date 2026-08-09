import { mean, std, pearsonR, spearmanR, extractNumericColumn, tTestPValue, fTestPValue } from './utils';
import type { ResultTable } from '@/types/analysis';

// --- Linear algebra helpers ---
function transpose(m: number[][]): number[][] { return m[0].map((_, i) => m.map((row) => row[i])); }
function multiplyVec(a: number[][], v: number[]): number[] { return a.map((row) => row.reduce((s, val, i) => s + val * v[i], 0)); }

function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(aug[j][i]) > Math.abs(aug[maxRow][i])) maxRow = j;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) continue;
    for (let j = i + 1; j < n; j++) {
      const factor = aug[j][i] / aug[i][i];
      for (let k = i; k <= n; k++) aug[j][k] -= factor * aug[i][k];
    }
  }
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = Math.abs(aug[i][i]) < 1e-12 ? 0 : (aug[i][n] - aug[i].slice(i + 1, n).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) / aug[i][i];
  }
  return x;
}

function multiply(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((s, val, k) => s + val * b[k][j], 0)));
}

function matrixInverse(A: number[][]): number[][] {
  const n = A.length;
  const I = Array.from({ length: n }, (_, i) => Array(n).fill(0));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  const aug = A.map((row, i) => [...row, ...I[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(aug[j][i]) > Math.abs(aug[maxRow][i])) maxRow = j;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = i; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const factor = aug[j][i];
      for (let k = i; k < 2 * n; k++) aug[j][k] -= factor * aug[i][k];
    }
  }
  return aug.map((row) => row.slice(n));
}

// --- Correlation matrix ---
function kendallTau(x: number[], y: number[]): number {
  const n = x.length; let concordant = 0, discordant = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = x[i] - x[j], dy = y[i] - y[j];
    if (dx * dy > 0) concordant++; else if (dx * dy < 0) discordant++;
  }
  return (concordant - discordant) / (n * (n - 1) / 2);
}

export function runCorrelation(rows: Record<string, unknown>[], cols: string[], method = 'pearson'): {
  table: ResultTable; matrix: number[][];
} {
  const n = cols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const x = extractNumericColumn(rows, cols[i]), y = extractNumericColumn(rows, cols[j]);
      const minLen = Math.min(x.length, y.length);
      const r = method === 'spearman' ? spearmanR(x.slice(0, minLen), y.slice(0, minLen))
        : method === 'kendall' ? kendallTau(x.slice(0, minLen), y.slice(0, minLen))
        : pearsonR(x.slice(0, minLen), y.slice(0, minLen));
      matrix[i][j] = r; matrix[j][i] = r;
    }
  }
  const headers = ['', ...cols];
  return { table: { title: `${method} 相关矩阵`, headers, rows: cols.map((col, i) => [col, ...matrix[i].map((v) => Number(v.toFixed(3)))]) }, matrix };
}

// --- OLS Linear Regression ---
export function runLinearRegression(rows: Record<string, unknown>[], xCols: string[], yCol: string): {
  table: ResultTable; conclusion: string; fittedValues: number[]; residuals: number[];
} {
  const data = rows.map((r) => {
    const xs = xCols.map((c) => Number(r[c])), y = Number(r[yCol]);
    return { xs, y, valid: xs.every((v) => !isNaN(v)) && !isNaN(y) };
  }).filter((d) => d.valid);
  const n = data.length, p = xCols.length;
  const X = data.map((d) => [1, ...d.xs]), y = data.map((d) => d.y);
  const Xt = transpose(X);
  const beta = solve(multiply(Xt, X), multiplyVec(Xt, y));
  const fittedValues = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
  const residuals = y.map((yi, i) => yi - fittedValues[i]);
  const yMean = mean(y);
  const SST = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const SSE = residuals.reduce((s, e) => s + e * e, 0);
  const rSquared = 1 - SSE / SST;
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - p - 1);
  const sigma2 = SSE / (n - p - 1);
  const F = ((SST - SSE) / p) / sigma2;
  const headers = ['', '系数', '标准误', 't 值', 'p 值'];

  const XtX = multiply(Xt, X);
  const XtXInv = matrixInverse(XtX);
  const resultRows: (string | number)[][] = beta.map((b, i) => {
    const seBeta = Math.sqrt(Math.max(0, sigma2 * (XtXInv[i]?.[i] ?? 0)));
    const tVal = seBeta > 0 ? b / seBeta : 0;
    const pVal = tTestPValue(Math.abs(tVal), n - p - 1);
    return [i === 0 ? '(截距)' : xCols[i - 1], b, seBeta, tVal, pVal];
  });
  return {
    table: { title: '线性回归 (OLS)', headers, rows: resultRows },
    conclusion: `R² = ${rSquared.toFixed(4)}, 调整 R² = ${adjRSquared.toFixed(4)}, F(${p}, ${n - p - 1}) = ${F.toFixed(4)}`,
    fittedValues, residuals,
  };
}

// --- Nonlinear fit ---
function linearFunc(x: number, p: number[]) { return p[0] * x + p[1]; }
function expFunc(x: number, p: number[]) { return p[0] * Math.exp(p[1] * x) + p[2]; }
function powerFunc(x: number, p: number[]) { return p[0] * Math.pow(Math.max(x, 1e-10), p[1]) + p[2]; }
function gaussFunc(x: number, p: number[]) { return p[0] * Math.exp(-((x - p[1]) ** 2) / (2 * p[2] * p[2])) + p[3]; }

function lmFit(xs: number[], ys: number[], fn: (x: number, p: number[]) => number, initP: number[]): number[] {
  let p = [...initP], lambda = 0.001;
  for (let iter = 0; iter < 60; iter++) {
    const residuals = xs.map((x, i) => ys[i] - fn(x, p));
    const sse0 = residuals.reduce((s, r) => s + r * r, 0);
    const J = xs.map((x) => {
      const h = 1e-6;
      return p.map((_, j) => {
        const pp = [...p]; pp[j] += h;
        return (fn(x, pp) - fn(x, p)) / h;
      });
    });
    const JTJ = multiply(transpose(J), J);
    for (let i = 0; i < JTJ.length; i++) JTJ[i][i] += lambda;
    try {
      const delta = solve(JTJ, multiplyVec(transpose(J), residuals));
      const newP = p.map((v, i) => v + delta[i]);
      const newSSE = xs.reduce((s, x, i) => { const r = ys[i] - fn(x, newP); return s + r * r; }, 0);
      if (newSSE < sse0) { p = newP; lambda /= 10; if (Math.abs(sse0 - newSSE) < 1e-8) break; }
      else lambda *= 10;
    } catch { break; }
  }
  return p;
}

export function runNonlinearFit(rows: Record<string, unknown>[], xCol: string, yCol: string, modelName = 'exp'): {
  table: ResultTable; conclusion: string; fitted: { x: number; y: number }[];
} {
  const data = rows.map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) })).filter((d) => !isNaN(d.x) && !isNaN(d.y));
  const xs = data.map((d) => d.x), ys = data.map((d) => d.y);
  const yMin = Math.min(...ys), yMax = Math.max(...ys), xMean = mean(xs), xRange = Math.max(...xs) - Math.min(...xs);
  const models: Record<string, { fn: (x: number, p: number[]) => number; init: number[]; names: string[] }> = {
    linear: { fn: linearFunc, init: [1, 0], names: ['a', 'b'] },
    exp: { fn: expFunc, init: [yMax - yMin, -0.1, yMin], names: ['a', 'b', 'c'] },
    power: { fn: powerFunc, init: [1, 1, 0], names: ['a', 'b', 'c'] },
    gauss: { fn: gaussFunc, init: [yMax - yMin, xMean, xRange / 5, yMin], names: ['amp', 'cen', 'wid', 'offset'] },
  };
  const m = models[modelName] ?? models.exp;
  const params = lmFit(xs, ys, m.fn, m.init);
  const fitted = xs.map((x) => ({ x, y: m.fn(x, params) }));
  const SSE = ys.reduce((s, yi, i) => s + (yi - fitted[i].y) ** 2, 0);
  const SST = ys.reduce((s, yi) => s + (yi - mean(ys)) ** 2, 0);
  return {
    table: { title: `非线性拟合 (${modelName})`, headers: ['参数', '估计值'], rows: m.names.map((name, i) => [name, params[i]]) },
    conclusion: `R² = ${(1 - SSE / SST).toFixed(4)}, SSE = ${SSE.toFixed(4)}`,
    fitted,
  };
}

// --- RSM ---
// Full coded quadratic response surface:
//   Y = b0 + Σ bi·Xi + Σ bii·Xi² + Σ bij·Xi·Xj  (coded Xi = (xi - center)/halfRange ∈ [-1, 1])
export interface RSMResult {
  table: ResultTable;      // 回归系数表（含 SE / t / p / 显著性）
  summary: ResultTable;    // 模型摘要：R²、调整R²、模型F、失拟检验
  anova: ResultTable;      // 方差分析（回归/残差/失拟/纯误差）
  residTable: ResultTable; // 残差诊断表（标准化残差、Cook距离、异常标记）
  equation: string;        // 编码变量回归方程文本（仅保留项）
  equationActual: string;  // 实际变量回归方程文本（编码→实际展开，非重拟合）
  codedDefs: string[];     // 编码定义，如 "A=(温度-50)/10"
  optimal: { type: 'max' | 'min' | 'saddle'; values: string; y: number; boundary: boolean; inside: boolean; predInterval: string } | null;
  conclusion: string;
  r2: number; adjR2: number; dfRes: number; mse: number;
  center: number[]; halfRange: number[];
  fitted: number[];        // 拟合值（残差诊断用）
  residuals: number[];     // 残差
  stdResid: number[];      // 标准化残差
  cooksD: number[];        // Cook 距离
  outliers: number[];      // 异常点下标（|stdResid|>2 或 Cook>4/n），只标记不删除
  predictCoded: (c: number[]) => number;
}

/** 95% two-tailed t-critical by bisection on the t cdf */
function tCritical(df: number): number {
  if (df <= 0) return 1.96;
  let lo = 0, hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tTestPValue(mid, df) > 0.05) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 规划求解：对编码二次模型求 ∂Y/∂Xi = 0 的驻点，域外时退化为边界最优 */
function solveRsmOptimum(
  k: number, bLin: number[], bSq: number[], bInt: number[][], b0: number,
  center: number[], halfRange: number[], factorCols: string[], dfRes: number, mse: number, XtXInv: number[][],
): RSMResult['optimal'] {
  if (k < 2 || k > 3 || bSq.length !== k) return null;
  // stationary: H·X = -g,  H[i][i]=2·bSq[i], H[i][j]=bInt[i][j], g[i]=bLin[i]
  const H: number[][] = Array.from({ length: k }, (_, i) => Array(k).fill(0));
  const g: number[] = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    H[i][i] = 2 * bSq[i];
    for (let j = 0; j < k; j++) H[i][j] = (H[i][j] || 0) + (i === j ? 0 : bInt[i][j]);
    g[i] = bLin[i];
  }
  const XtX = H; const rhs = g.map((v) => -v);
  const aug = XtX.map((row, i) => [...row, rhs[i]]);
  const stat: number[] = Array(k).fill(0);
  let solvable = true;
  for (let i = 0; i < k; i++) {
    let piv = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(aug[j][i]) > Math.abs(aug[piv][i])) piv = j;
    [aug[i], aug[piv]] = [aug[piv], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) { solvable = false; break; }
    for (let j = i + 1; j < k; j++) { const f = aug[j][i] / aug[i][i]; for (let c = i; c <= k; c++) aug[j][c] -= f * aug[i][c]; }
  }
  if (solvable) for (let i = k - 1; i >= 0; i--) stat[i] = (aug[i][k] - aug[i].slice(i + 1, k).reduce((s, v, j) => s + v * stat[i + 1 + j], 0)) / aug[i][i];

  const predict = (c: number[]): number => {
    let y = b0;
    for (let i = 0; i < k; i++) y += bLin[i] * c[i] + bSq[i] * c[i] ** 2;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) y += bInt[i][j] * c[i] * c[j];
    return y;
  };
  const insideBox = (c: number[]) => c.every((v) => v >= -1 - 1e-9 && v <= 1 + 1e-9);
  const toActual = (c: number[]) => factorCols.map((n, i) => `${n}=${formatVal(center[i] + halfRange[i] * c[i])}`).join(', ');
  const designRowForPI = (c: number[]): number[] => {
    // build [1, lin..., sq..., int...] in same order as design matrix for XtXInv
    const row: number[] = [1];
    for (let i = 0; i < k; i++) row.push(c[i]);
    for (let i = 0; i < k; i++) row.push(c[i] ** 2);
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) row.push(c[i] * c[j]);
    return row;
  };
  const pi = (c: number[]): string => {
    const x = designRowForPI(c);
    let q = 0;
    for (let i = 0; i < x.length; i++) for (let j = 0; j < x.length; j++) q += x[i] * (XtXInv?.[i]?.[j] ?? 0) * x[j];
    const s = Math.sqrt(Math.max(0, mse * (1 + q)));
    const tc = tCritical(dfRes);
    return `[${formatVal(predict(c) - tc * s)}, ${formatVal(predict(c) + tc * s)}]`;
  };

  // candidate set: stationary (if inside) + grid over box (boundary-sensitive)
  const cands: { c: number[]; boundary: boolean }[] = [];
  if (solvable && insideBox(stat)) cands.push({ c: stat, boundary: false });
  const N = k === 2 ? 41 : 21;
  for (let a = 0; a < k; a++) {
    // edges/faces: vary one axis over the box
    for (let idx = 0; idx < N; idx++) {
      const c: number[] = Array(k).fill(0);
      c[a] = -1 + (2 * idx) / (N - 1);
      cands.push({ c: [...c.map((v, i) => (i === a ? v : i === (a + 1) % k ? 1 : 0))], boundary: true });
      cands.push({ c: [...c.map((v, i) => (i === a ? v : i === (a + 1) % k ? -1 : 0))], boundary: true });
      if (k === 3) {
        cands.push({ c: [...c.map((v, i) => (i === a ? v : i === (a + 1) % k ? 1 : -1))], boundary: true });
        cands.push({ c: [...c.map((v, i) => (i === a ? v : i === (a + 1) % k ? -1 : 1))], boundary: true });
      }
    }
  }
  // full box corners
  for (let mask = 0; mask < 1 << k; mask++) cands.push({ c: Array.from({ length: k }, (_, i) => (mask & (1 << i) ? 1 : -1)), boundary: true });

  let best: { c: number[]; boundary: boolean; y: number } | null = null;
  let worst: { c: number[]; boundary: boolean; y: number } | null = null;
  for (const cnd of cands) {
    const y = predict(cnd.c);
    if (!best || y > best.y) best = { ...cnd, y };
    if (!worst || y < worst.y) worst = { ...cnd, y };
  }
  // 返回最大值解（驻点在域内时为解析驻点，否则为边界最优）
  const primary = best!;
  return {
    type: 'max',
    values: toActual(primary.c),
    y: primary.y,
    boundary: primary.boundary,
    inside: insideBox(primary.c),
    predInterval: pi(primary.c),
  };
}

function formatVal(v: number, sig = 4): string {
  if (!isFinite(v)) return '—';
  return String(Number(v.toPrecision(sig)));
}

type RSMTermRole = 'lin' | 'sq' | 'int';

/** 完整二次模型项定义（编码空间），项顺序：const, lin…, sq…, int… */
function rsmTermDefs(k: number): { role: RSMTermRole; i: number; j: number }[] {
  const defs: { role: RSMTermRole; i: number; j: number }[] = [];
  for (let i = 0; i < k; i++) defs.push({ role: 'lin', i, j: -1 });
  for (let i = 0; i < k; i++) defs.push({ role: 'sq', i, j: -1 });
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) defs.push({ role: 'int', i, j });
  return defs;
}

/** 从项定义 + 编码值构造设计行 */
function rsmRow(c: number[], defs: { role: RSMTermRole; i: number; j: number }[]): number[] {
  return [1, ...defs.map((t) => (t.role === 'lin' ? c[t.i] : t.role === 'sq' ? c[t.i] ** 2 : c[t.i] * c[t.j]))];
}

/** 显著性标记：*** p<0.001, ** p<0.01, * p<0.05, . p<0.1 */
function sigMark(p: number): string {
  if (!isFinite(p)) return '—';
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  if (p < 0.1) return '.';
  return ' ';
}

/** 把编码二次方程展开为实际变量形式：X_i=(x_i-c_i)/h_i 代入 */
function expandCodedToActual(
  defs: { role: RSMTermRole; i: number; j: number }[], beta: number[],
  center: number[], halfRange: number[], factorCols: string[], responseCol: string,
): string {
  const k = factorCols.length;
  // 实际变量系数累加器
  const coef: Record<string, number> = {};
  const add = (k: string, v: number) => { coef[k] = (coef[k] ?? 0) + v; };
  add('const', beta[0]);
  defs.forEach((t, idx) => {
    const b = beta[1 + idx];
    if (Math.abs(b) < 1e-12) return;
    const a = 1 / halfRange[t.i];               // x_i 前的系数 (1/h_i)
    const d = -center[t.i] / halfRange[t.i];    // 常数项
    if (t.role === 'lin') {
      add(factorCols[t.i], b * a);
      add('const', b * d);
    } else if (t.role === 'sq') {
      add(`${factorCols[t.i]}²`, b * a * a);
      add(factorCols[t.i], 2 * b * a * d);
      add('const', b * d * d);
    } else {
      const a2 = 1 / halfRange[t.j], d2 = -center[t.j] / halfRange[t.j];
      add(`${factorCols[t.i]}×${factorCols[t.j]}`, b * a * a2);
      add(factorCols[t.i], b * a * d2);
      add(factorCols[t.j], b * d * a2);
      add('const', b * d * d2);
    }
  });
  const names: string[] = ['const', ...factorCols, ...factorCols.map((f) => `${f}²`)];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) names.push(`${factorCols[i]}×${factorCols[j]}`);
  let eq = `${responseCol} = ${formatVal(coef['const'] ?? 0)}`;
  names.slice(1).forEach((n) => {
    const b = coef[n] ?? 0;
    if (Math.abs(b) < 1e-12) return;
    eq += ` ${b >= 0 ? '+' : '−'} ${formatVal(Math.abs(b))}·${n}`;
  });
  return eq;
}

export function runRSM(rows: Record<string, unknown>[], factorCols: string[], responseCol: string): RSMResult {
  const k = factorCols.length;
  const err = (msg: string): RSMResult => ({ table: { title: '响应面分析 (RSM)', headers: ['错误'], rows: [[msg]] }, summary: { title: '模型摘要', headers: [], rows: [] }, anova: { title: '方差分析', headers: [], rows: [] }, residTable: { title: '残差诊断', headers: [], rows: [] }, equation: '', equationActual: '', codedDefs: [], optimal: null, conclusion: '', r2: NaN, adjR2: NaN, dfRes: 0, mse: NaN, center: [], halfRange: [], fitted: [], residuals: [], stdResid: [], cooksD: [], outliers: [], predictCoded: () => NaN });
  if (k < 2 || k > 3) return err('因素数量需为 2 或 3');
  const data = rows.map((r) => {
    const factors = factorCols.map((c) => Number(r[c]));
    const response = Number(r[responseCol]);
    return { factors, response, valid: factors.every((v) => !isNaN(v)) && !isNaN(response) };
  }).filter((d) => d.valid);
  if (data.length < k + 1) return err('有效数据点不足，无法拟合');

  // center / half-range for coding
  const center = factorCols.map((_, i) => (Math.min(...data.map((d) => d.factors[i])) + Math.max(...data.map((d) => d.factors[i]))) / 2);
  const halfRange = factorCols.map((_, i) => { const r = (Math.max(...data.map((d) => d.factors[i])) - Math.min(...data.map((d) => d.factors[i]))) / 2; return r === 0 ? 1 : r; });

  // 编码值
  const coded = data.map((d) => d.factors.map((v, i) => (v - center[i]) / halfRange[i]));
  const y = data.map((d) => d.response);
  const n = y.length;
  const fullDefs = rsmTermDefs(k);
  const fullNames = ['const', ...fullDefs.map((t) => (t.role === 'lin' ? factorCols[t.i] : t.role === 'sq' ? `${factorCols[t.i]}²` : `${factorCols[t.i]}×${factorCols[t.j]}`))];

  // 用指定项集合拟合，返回系数/SE/t/p/残差/统计量
  const fitWith = (defs: { role: RSMTermRole; i: number; j: number }[]) => {
    const design = coded.map((c) => rsmRow(c, defs));
    const p = defs.length + 1;
    const Xt = transpose(design), beta = solve(multiply(Xt, design), multiplyVec(Xt, y));
    const fittedVals = design.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
    const residuals = y.map((yi, i) => yi - fittedVals[i]);
    const ybar = mean(y);
    const SST = y.reduce((s, yi) => s + (yi - ybar) ** 2, 0);
    const SSE = residuals.reduce((s, e) => s + e * e, 0);
    const dfReg = p - 1, dfRes = n - p;
    const mse = dfRes > 0 ? SSE / dfRes : NaN;
    const r2 = SST > 0 ? 1 - SSE / SST : NaN;
    const adjR2 = dfRes > 0 ? 1 - (1 - r2) * (n - 1) / dfRes : NaN;
    const F = dfReg > 0 && mse > 0 ? ((SST - SSE) / dfReg) / mse : NaN;
    const pF = isFinite(F) && dfRes > 0 ? fTestPValue(F, dfReg, dfRes) : NaN;
    const XtXInv = matrixInverse(multiply(Xt, design));
    const stats = beta.map((b, i) => {
      const se = Math.sqrt(Math.max(0, mse * (XtXInv?.[i]?.[i] ?? 0)));
      // se=0 且 b≠0 → 完美拟合，系数显著（p=0）；否则正常 t 检验
      const t = se > 0 ? b / se : (b === 0 ? 0 : Infinity);
      const pv = t === Infinity ? 0 : (isFinite(t) && dfRes > 0 ? tTestPValue(Math.abs(t), dfRes) : NaN);
      return { b, se, t, p: pv };
    });
    return { beta, stats, fittedVals, residuals, r2, adjR2, F, pF, dfRes, mse, SSE, SST, XtXInv };
  };

  // ── 向后剔除：从完整模型开始，反复移除 p 值最大且 p>0.1 的项 ──
  let defs = fullDefs.slice();
  let fit = fitWith(defs);
  const fullFit = fit; // 完整模型拟合，残差诊断须基于完整模型（需求3），不受向后剔除影响
  for (let iter = 0; iter < 20 && defs.length > 0; iter++) {
    let worst = -1, worstP = 0.1;
    for (let i = 0; i < defs.length; i++) {
      const pv = fit.stats[1 + i].p;
      if (isFinite(pv) && pv > worstP) { worst = i; worstP = pv; }
    }
    if (worst < 0) break;
    defs.splice(worst, 1);
    fit = fitWith(defs);
  }
  const p = defs.length + 1;
  const dfReg = p - 1, dfRes = fit.dfRes, mse = fit.mse;
  const r2 = fit.r2, adjR2 = fit.adjR2, F = fit.F, pF = fit.pF;
  const { beta, stats, SSE, SST, XtXInv } = fit;

  // ── 系数表（仅保留项）──
  const retainedNames = ['const', ...defs.map((t) => (t.role === 'lin' ? factorCols[t.i] : t.role === 'sq' ? `${factorCols[t.i]}²` : `${factorCols[t.i]}×${factorCols[t.j]}`))];
  const coefRows: (string | number)[][] = beta.map((b, i) => {
    const s = stats[i];
    return [retainedNames[i], b, s.se, s.t, isFinite(s.p) ? s.p : '—', sigMark(s.p)];
  });

  // ── 失拟检验 ──
  let ssPE = 0, dfPE = 0;
  const groups = new Map<string, number[]>();
  data.forEach((d, idx) => {
    const key = d.factors.map((v) => v.toFixed(6)).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(y[idx]);
  });
  groups.forEach((vals) => { if (vals.length > 1) { const m = mean(vals); vals.forEach((v) => ssPE += (v - m) ** 2); dfPE += vals.length - 1; } });
  const dfLOF = dfRes - dfPE;
  const ssLOF = SSE - ssPE;
  const msPE = dfPE > 0 ? ssPE / dfPE : NaN;
  const msLOF = dfLOF > 0 ? ssLOF / dfLOF : NaN;
  const fLOF = msLOF > 0 && msPE > 0 ? msLOF / msPE : NaN;
  const pLOF = isFinite(fLOF) && dfLOF > 0 && dfPE > 0 ? fTestPValue(fLOF, dfLOF, dfPE) : NaN;

  // ── 编码方程（仅保留项）──
  const codeNames = factorCols.map((_, i) => `X${i + 1}`);
  const codedDefs = factorCols.map((_, i) => `${codeNames[i]}=(${factorCols[i]}${center[i] < 0 ? '+' : '−'}${formatVal(Math.abs(center[i]))})/${formatVal(halfRange[i])}`);
  let eq = `${responseCol} = ${formatVal(beta[0])}`;
  for (let i = 0; i < defs.length; i++) {
    const b = beta[1 + i], t = defs[i];
    const name = t.role === 'lin' ? codeNames[t.i] : t.role === 'sq' ? `${codeNames[t.i]}²` : `${codeNames[t.i]}×${codeNames[t.j]}`;
    eq += ` ${b >= 0 ? '+' : '−'} ${formatVal(Math.abs(b))}·${name}`;
  }
  const eqActual = expandCodedToActual(defs, beta, center, halfRange, factorCols, responseCol);

  // ── 规划求解：基于保留模型 ──
  const termIdx = (role: RSMTermRole, i: number, j?: number) => {
    const idx = defs.findIndex((t) => t.role === role && t.i === i && (j === undefined || t.j === j));
    return idx < 0 ? -1 : 1 + idx;
  };
  const bLin = factorCols.map((_, i) => { const ix = termIdx('lin', i); return ix < 0 ? 0 : beta[ix]; });
  const bSq = factorCols.map((_, i) => { const ix = termIdx('sq', i); return ix < 0 ? 0 : beta[ix]; });
  const bInt: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  defs.forEach((t, idx) => { if (t.role === 'int') { bInt[t.i][t.j] = beta[1 + idx]; bInt[t.j][t.i] = beta[1 + idx]; } });
  const optimal = solveRsmOptimum(k, bLin, bSq, bInt, beta[0], center, halfRange, factorCols, dfRes, mse, XtXInv);

  // ── 残差诊断：基于完整二次模型（需求3「拟合完整模型后」），标准化残差 + Cook 距离 ──
  const pFull = fullDefs.length + 1;
  const mseFull = fullFit.mse;
  const leverage = coded.map((c) => {
    const row = rsmRow(c, fullDefs);
    let h = 0;
    for (let a = 0; a < row.length; a++) { let s = 0; for (let b = 0; b < row.length; b++) s += (fullFit.XtXInv?.[a]?.[b] ?? 0) * row[b]; h += row[a] * s; }
    return h;
  });
  // 标准化残差 = 残差 / sqrt(MSE)（教科书定义）；Cook = e²/(p·MSE)·h/(1−h)²
  const stdResid = fullFit.residuals.map((e) => (mseFull > 0 ? e / Math.sqrt(mseFull) : NaN));
  const cooksD = fullFit.residuals.map((e, i) => {
    const h = leverage[i];
    const denom = (1 - h) * (1 - h);
    return denom > 1e-12 && mseFull > 0 ? (e * e / (pFull * mseFull)) * (h / denom) : 0;
  });
  const cookThresh = 4 / n;
  // 判定：|标准化残差|>2 → 统计异常；Cook>4/n → 影响较大（两类分离，异常只标记不删除）
  const outliers: number[] = [];
  const residMark = fullFit.residuals.map((e, i) => {
    const z = stdResid[i];
    const isOut = isFinite(z) && Math.abs(z) > 2;
    const isInfl = cooksD[i] > cookThresh;
    if (isOut) { outliers.push(i); return isInfl ? '● 统计异常+影响较大' : '● 统计异常'; }
    return isInfl ? '○ 影响较大' : '—';
  });

  const residRows: (string | number)[][] = data.map((d, i) => [
    i + 1, y[i], fullFit.fittedVals[i], fullFit.residuals[i], stdResid[i], cooksD[i], residMark[i],
  ]);
  const residTable: ResultTable = {
    title: '残差诊断（完整二次模型；|标准化残差|>2 为统计异常、Cook>4/n 为影响较大，仅标记不删除）',
    headers: ['序号', '响应值', '拟合值', '残差', '标准化残差', 'Cook距离', '标记'],
    rows: residRows,
  };

  const summary: ResultTable = {
    title: '模型摘要', headers: ['指标', '值'],
    rows: [
      ['R²', formatVal(r2)], ['调整 R²', formatVal(adjR2)],
      ['模型 F', isFinite(F) ? formatVal(F) : '—'], ['模型 p', isFinite(pF) ? formatVal(pF) : '—'],
      ['失拟 F', isFinite(fLOF) ? formatVal(fLOF) : '—'], ['失拟 p', isFinite(pLOF) ? formatVal(pLOF) : '—'],
      ['残差自由度', dfRes], ['MSE', formatVal(mse)],
      ['保留项数', defs.length + 1],
    ],
  };
  const anova: ResultTable = {
    title: '方差分析 (ANOVA)', headers: ['来源', 'SS', 'df', 'MS', 'F', 'p'],
    rows: [
      ['回归', formatVal(SST - SSE), dfReg, formatVal((SST - SSE) / dfReg), isFinite(F) ? formatVal(F) : '—', isFinite(pF) ? formatVal(pF) : '—'],
      ['残差', formatVal(SSE), dfRes, formatVal(mse), '—', '—'],
      ['失拟', formatVal(ssLOF), dfLOF, formatVal(msLOF), isFinite(fLOF) ? formatVal(fLOF) : '—', isFinite(pLOF) ? formatVal(pLOF) : '—'],
      ['纯误差', formatVal(ssPE), dfPE, formatVal(msPE), '—', '—'],
      ['总和', formatVal(SST), n - 1, '—', '—', '—'],
    ],
  };
  const table: ResultTable = { title: '回归系数（编码变量，向后剔除后）', headers: ['项', '系数', '标准误', 't 值', 'p 值', '显著性'], rows: coefRows };

  let conclusion = `向后剔除后保留 ${defs.length + 1}/${fullDefs.length + 1} 项；R² = ${formatVal(r2)}, 调整R² = ${formatVal(adjR2)}`;
  if (isFinite(F)) conclusion += `, 模型F = ${formatVal(F)} (p = ${isFinite(pF) ? formatVal(pF) : '—'})`;
  if (isFinite(fLOF)) conclusion += `, 失拟检验 F = ${formatVal(fLOF)} (p = ${isFinite(pLOF) ? formatVal(pLOF) : '—'})`;
  if (outliers.length) conclusion += `；标记 ${outliers.length} 个统计异常点（序号 ${outliers.map((i) => i + 1).join(', ')}），未自动删除`;
  const inflIdx = residMark.map((m, i) => (m.includes('影响') ? i : -1)).filter((i) => i >= 0);
  if (inflIdx.length) conclusion += `；${inflIdx.length} 个影响较大点（序号 ${inflIdx.map((i) => i + 1).join(', ')}），Cook>4/n 仅提示不剔除`;
  if (optimal) conclusion += `；最优响应 = ${formatVal(optimal.y)}，${optimal.values}${optimal.boundary ? '（边界解）' : ''}`;

  const predictCoded = (c: number[]): number => rsmRow(c, defs).reduce((s, v, i) => s + v * beta[i], 0);

  return { table, summary, anova, residTable, equation: eq, equationActual: eqActual, codedDefs, optimal, conclusion, r2, adjR2, dfRes, mse, center, halfRange, fitted: fullFit.fittedVals, residuals: fullFit.residuals, stdResid, cooksD, outliers, predictCoded };
}

// --- PCA ---
export function runPCA(rows: Record<string, unknown>[], cols: string[]): {
  table: ResultTable; loadings: number[][]; scores: number[][]; eigenvalues: number[];
} {
  const data = rows.map((r) => cols.map((c) => Number(r[c]))).filter((vs) => vs.every((v) => !isNaN(v)));
  const n = data.length, p = cols.length;
  const colMeans = cols.map((_, j) => mean(data.map((r) => r[j])));
  const colStds = cols.map((_, j) => std(data.map((r) => r[j])));
  const standardized = data.map((row) => row.map((v, j) => colStds[j] > 0 ? (v - colMeans[j]) / colStds[j] : 0));
  const covMatrix: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) {
    let sum = 0; for (let k = 0; k < n; k++) sum += standardized[k][i] * standardized[k][j];
    covMatrix[i][j] = sum / (n - 1); covMatrix[j][i] = covMatrix[i][j];
  }
  const eigenvalues: number[] = [], eigenvectors: number[][] = [];
  let residual = covMatrix.map((row) => [...row]);
  for (let comp = 0; comp < Math.min(p, p); comp++) {
    let v = Array(p).fill(0).map(() => Math.random()), lambda = 0;
    for (let iter = 0; iter < 50; iter++) {
      const Av = residual.map((row) => row.reduce((s, val, j) => s + val * v[j], 0));
      const norm = Math.sqrt(Av.reduce((s, val) => s + val * val, 0));
      if (norm < 1e-12) break;
      v = Av.map((val) => val / norm);
      lambda = v.reduce((s, vi, i) => s + vi * residual[i].reduce((t, aij, j) => t + aij * v[j], 0), 0);
    }
    eigenvalues.push(lambda); eigenvectors.push(v);
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) residual[i][j] -= lambda * v[i] * v[j];
  }
  const scores = standardized.map((row) => eigenvectors.map((ev) => ev.reduce((s, v, j) => s + row[j] * v, 0)));
  const totalVar = eigenvalues.reduce((a, b) => a + b, 0);
  let cumVar = 0;
  const headers = ['主成分', '特征值', '方差解释率', '累计方差解释率'];
  const resultRows = eigenvalues.map((ev, i) => {
    const prop = ev / totalVar; cumVar += prop;
    return [`PC${i + 1}`, ev, prop, cumVar];
  });
  return {
    table: { title: 'PCA 主成分分析', headers, rows: resultRows as (string | number)[][] },
    loadings: cols.map((_, i) => eigenvectors.slice(0, 2).map((ev) => ev[i])),
    scores: scores.map((s) => [s[0], s[1]]),
    eigenvalues,
  };
}
