import { mean, std, pearsonR, spearmanR, extractNumericColumn, tTestPValue } from './utils';
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
export function runRSM(rows: Record<string, unknown>[], factorCols: string[], responseCol: string): {
  table: ResultTable; conclusion: string;
} {
  if (factorCols.length < 2 || factorCols.length > 3) return {
    table: { title: '响应面分析', headers: ['错误'], rows: [['因素数量需为 2 或 3']] }, conclusion: '',
  };
  const data = rows.map((r) => {
    const factors = factorCols.map((c) => Number(r[c]));
    const response = Number(r[responseCol]);
    return { factors, response, valid: factors.every((v) => !isNaN(v)) && !isNaN(response) };
  }).filter((d) => d.valid);
  const design: number[][] = [], y: number[] = [], termNames: string[] = ['const'];
  for (const d of data) {
    const row: number[] = [1];
    for (let i = 0; i < factorCols.length; i++) { row.push(d.factors[i]); if (design.length === 0) termNames.push(factorCols[i]); }
    for (let i = 0; i < factorCols.length; i++) { row.push(d.factors[i] ** 2); if (design.length === 0) termNames.push(`${factorCols[i]}²`); }
    for (let i = 0; i < factorCols.length; i++) for (let j = i + 1; j < factorCols.length; j++) {
      row.push(d.factors[i] * d.factors[j]);
      if (design.length === 0) termNames.push(`${factorCols[i]}×${factorCols[j]}`);
    }
    design.push(row); y.push(d.response);
  }
  const Xt = transpose(design), beta = solve(multiply(Xt, design), multiplyVec(Xt, y));
  const fittedVals = design.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
  const SSE = y.reduce((s, yi, i) => s + (yi - fittedVals[i]) ** 2, 0);
  const SST = y.reduce((s, yi) => s + (yi - mean(y)) ** 2, 0);
  return {
    table: { title: '响应面分析 (RSM)', headers: ['项', '系数'], rows: termNames.map((name, i) => [name, beta[i]]) },
    conclusion: `R² = ${(1 - SSE / SST).toFixed(4)}`,
  };
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
