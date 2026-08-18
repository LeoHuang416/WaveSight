import { mean, std, median, min, max, quantile, skewness, kurtosis, extractNumericColumn, extractByGroup } from './utils';
import type { ResultTable } from '@/types/analysis';

export function runDescriptive(rows: Record<string, unknown>[], cols: string[]): ResultTable {
  const headers = ['变量', 'N', '均值', '标准差', '中位数', '最小值', '最大值', 'Q1', 'Q3', '偏度', '峰度'];
  const resultRows: (string | number)[][] = [];
  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    if (values.length === 0) continue;
    resultRows.push([col, values.length, mean(values), std(values), median(values),
      min(values), max(values), quantile(values, 0.25), quantile(values, 0.75),
      skewness(values), kurtosis(values)]);
  }
  return { title: '描述统计', headers, rows: resultRows };
}

export function runFrequency(rows: Record<string, unknown>[], col: string): ResultTable {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    counts.set(String(row[col] ?? '缺失'), (counts.get(String(row[col] ?? '缺失')) ?? 0) + 1);
    total++;
  }
  const headers = ['类别', '频数', '占比'];
  const resultRows: (string | number)[][] = [];
  for (const [category, count] of counts) resultRows.push([category, count, count / total]);
  return { title: `频数统计: ${col}`, headers, rows: resultRows };
}

function shapiroWilkCoefficients(n: number): number[] {
  const m = Array.from({ length: n }, (_, i) => normalQuantile((i + 0.375) / (n + 0.25)));
  const sqrtSumM2 = Math.sqrt(m.reduce((s, v) => s + v ** 2, 0));
  const half = Math.floor(n / 2);
  return Array.from({ length: half }, (_, i) => -m[n - 1 - i] / sqrtSumM2);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  return 0.5 * (1 + sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)));
}

export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
  let q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return q * (((-25.44106049637 * r + 41.39119773534) * r - 18.61500062529) * r + 2.50662823884) /
           ((((3.13082909833 * r - 21.06224101826) * r + 23.08336743743) * r - 8.47351093090) * r + 1);
  }
  const r = q < 0 ? p : 1 - p;
  const val = Math.sqrt(-Math.log(r));
  return (q < 0 ? -1 : 1) * (((2.32121276858 * val + 4.85014127135) * val - 2.29796479134) * val - 2.78718931138) /
         ((1.63706781897 * val + 3.54388924762) * val + 1);
}

function shapiroWilk(values: number[]): { w: number; p: number } {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);
  const a = shapiroWilkCoefficients(n);
  let sumAx = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) sumAx += a[i] * (sorted[n - 1 - i] - sorted[i]);
  const ss = sorted.reduce((s, v) => s + (v - m) ** 2, 0);
  const w = ss > 0 ? (sumAx ** 2) / ss : 1;
  let y = Math.log(1 - w);
  const mu = -1.5861 - 0.6319 * Math.log(n) + 0.0186 * (Math.log(n)) ** 2;
  const sigma = Math.exp(0.7368 - 0.4683 * Math.log(n) + 0.0574 * (Math.log(n)) ** 2);
  const z = (y - mu) / sigma;
  return { w, p: Math.min(1, Math.max(0, 1 - normalCDF(z))) };
}

export function runNormality(rows: Record<string, unknown>[], cols: string[], alpha = 0.05): {
  table: ResultTable;
  qqData: Record<string, { theoretical: number[]; sample: number[] }>;
} {
  const headers = ['变量', 'N', 'Shapiro-Wilk W', 'p 值', `是否正态(p>${alpha})`, 'K-S D', 'K-S p 值'];
  const resultRows: (string | number)[][] = [];
  const qqData: Record<string, { theoretical: number[]; sample: number[] }> = {};
  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    if (values.length < 3) continue;
    const { w, p } = shapiroWilk(values);
    const { d, p: ksP } = kolmogorovSmirnov(values);
    resultRows.push([col, values.length, w, p, p > alpha ? '是' : '否', d, ksP]);
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    qqData[col] = {
      theoretical: Array.from({ length: n }, (_, i) => normalQuantile((i + 0.5) / n)),
      sample: sorted,
    };
  }
  return { table: { title: '正态性检验', headers, rows: resultRows }, qqData };
}

/**
 * One-sample Kolmogorov-Smirnov test against the normal distribution.
 * Since mean/variance are estimated from the data, the Lilliefors-type
 * correction is applied to the test statistic before computing the p-value.
 */
function kolmogorovSmirnov(values: number[]): { d: number; p: number } {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);
  const s = std(sorted);
  if (n < 3 || s <= 0 || !isFinite(s)) return { d: 1, p: 0 };
  let d = 0;
  for (let i = 0; i < n; i++) {
    const z = (sorted[i] - m) / s;
    const cdf = normalCDF(z);
    const empirical = (i + 1) / n;
    d = Math.max(d, Math.abs(cdf - empirical), Math.abs(cdf - (i) / n));
  }
  // Lilliefors correction: z = (√n + 0.12 + 0.11/√n) · D
  const z = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * d;
  // Kolmogorov distribution asymptotic p-value (two-sided)
  const p = 2 * Math.exp(-2 * z * z);
  return { d: +d.toFixed(4), p: Math.min(1, Math.max(0, p)) };
}

export function runGroupedStats(rows: Record<string, unknown>[], valueCols: string[], groupCol: string): ResultTable {
  const headers = ['变量', '分组', 'N', '均值', '标准差', '中位数'];
  const resultRows: (string | number)[][] = [];
  for (const col of valueCols) {
    for (const [group, values] of extractByGroup(rows, col, groupCol)) {
      resultRows.push([col, group, values.length, mean(values), std(values), median(values)]);
    }
  }
  return { title: `分组统计 (按 ${groupCol})`, headers, rows: resultRows };
}
