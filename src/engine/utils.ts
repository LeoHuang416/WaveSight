/** Mean */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (ddof=1) */
export function std(values: number[], ddof: number = 1): number {
  if (values.length <= ddof) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - ddof));
}

/** Sample variance */
export function variance(values: number[]): number {
  if (values.length <= 1) return NaN;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

/** Median */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Quantile (linear interpolation) */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}

export function min(values: number[]): number { return Math.min(...values); }
export function max(values: number[]): number { return Math.max(...values); }

/** Skewness */
export function skewness(values: number[]): number {
  if (values.length < 3) return NaN;
  const m = mean(values), s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  return (n / ((n - 1) * (n - 2))) * values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}

/** Excess kurtosis */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return NaN;
  const m = mean(values), s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  const k = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  return k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/** Covariance */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;
  const mx = mean(x), my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / (x.length - 1);
}

/** Pearson correlation */
export function pearsonR(x: number[], y: number[]): number {
  return covariance(x, y) / (std(x) * std(y));
}

/** Spearman rank correlation */
export function spearmanR(x: number[], y: number[]): number {
  return pearsonR(rankValues(x), rankValues(y));
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let j = 0;
  while (j < indexed.length) {
    let k = j;
    while (k < indexed.length && indexed[k].v === indexed[j].v) k++;
    const avgRank = (j + k - 1) / 2 + 1;
    for (let t = j; t < k; t++) ranks[indexed[t].i] = avgRank;
    j = k;
  }
  return ranks;
}

/** Extract numeric column from dataset rows */
export function extractNumericColumn(rows: Record<string, unknown>[], col: string): number[] {
  return rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
}

/** Group values by category */
export function extractByGroup(rows: Record<string, unknown>[], valueCol: string, groupCol: string): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const group = String(row[groupCol] ?? '');
    const value = Number(row[valueCol]);
    if (isNaN(value)) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(value);
  }
  return groups;
}

/** Standard normal CDF (Φ) via Abramowitz-Stegun erf approximation */
export function normalCdf(z: number): number {
  if (!isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = sign * (1 - poly * Math.exp(-x * x));
  return 0.5 * (1 + erf);
}

/** Chi-square distribution CDF (lower regularized incomplete gamma) */
export function chiSquareCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  if (!isFinite(x)) return 1;
  return lowerRegularizedGamma(df / 2, x / 2);
}

function lowerRegularizedGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  const gln = lnGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      ap += 1;
      term *= x / ap;
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  const b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    let b2 = b + 2 * i;
    d = an * d + b2;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b2 + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** t-distribution p-value (two-tailed) */
export function tTestPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(df / 2, 0.5, x);
}

/** F-distribution p-value */
export function fTestPValue(f: number, df1: number, df2: number): number {
  return regularizedIncompleteBeta(df2 / 2, df1 / 2, df2 / (df2 + df1 * f));
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const maxIter = 200;
  const logBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  let front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta) / a;
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let num = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    num = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return front * h;
}

function lnGamma(z: number): number {
  if (z < 0) return NaN;
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
