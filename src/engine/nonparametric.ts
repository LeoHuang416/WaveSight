/**
 * 非参数检验（V2 新增，PRD §7.2）：
 * - Mann-Whitney U（两组独立样本）
 * - Wilcoxon 符号秩（配对样本）
 * - Kruskal-Wallis（多组独立样本）
 * 均基于秩 + 正态/卡方大样本近似（含 tie 校正与连续性校正）。
 */
import { mean, median, normalCdf, chiSquareCdf } from './utils';
import type { ResultTable } from '@/types/analysis';

function pStars(p: number, alpha: number): string { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < alpha ? '*' : ''; }
function pText(p: number, alpha: number): string { return p < 0.001 ? 'p < 0.001' : p < 0.01 ? 'p < 0.01' : p < alpha ? `p < ${alpha}` : `p = ${p.toFixed(3)}`; }

/** 严格分组：空值（null/undefined/空串）样本直接排除，避免 Number('')=0 */
function extractGroupsStrict(rows: Record<string, unknown>[], valueCol: string, groupCol: string): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const raw = row[valueCol];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    const group = String(row[groupCol] ?? '').trim();
    if (group === '') continue;
    const value = Number(raw);
    if (isNaN(value)) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(value);
  }
  return groups;
}

/** 合并赋秩（平均秩处理 tie），返回秩数组 + tie 组大小列表 */
function rankAll(values: number[]): { ranks: number[]; tieSizes: number[] } {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  const tieSizes: number[] = [];
  let j = 0;
  while (j < indexed.length) {
    let k = j;
    while (k < indexed.length && indexed[k].v === indexed[j].v) k++;
    const avgRank = (j + k - 1) / 2 + 1;
    for (let t = j; t < k; t++) ranks[indexed[t].i] = avgRank;
    if (k - j > 1) tieSizes.push(k - j);
    j = k;
  }
  return { ranks, tieSizes };
}

/** Mann-Whitney U 检验（正态近似 + 连续性校正 + tie 校正） */
export function runMannWhitneyU(rows: Record<string, unknown>[], valueCol: string, groupCol: string, alpha = 0.05): {
  statTable: ResultTable; testTable: ResultTable; conclusion: string;
  u: number; z: number; p: number; effectR: number;
} {
  const groups = extractGroupsStrict(rows, valueCol, groupCol);
  const names = Array.from(groups.keys());
  if (names.length !== 2) {
    const err = { title: 'Mann-Whitney U 检验', headers: ['错误'], rows: [['需要恰好两个分组']] };
    return { statTable: err, testTable: err, conclusion: '错误：需要恰好两个分组', u: NaN, z: NaN, p: NaN, effectR: NaN };
  }
  const g1 = groups.get(names[0])!, g2 = groups.get(names[1])!;
  const n1 = g1.length, n2 = g2.length;
  const all = [...g1, ...g2];
  const N = all.length;
  const { ranks, tieSizes } = rankAll(all);
  const r1 = g1.reduce((s, _, i) => s + ranks[i], 0);
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);
  const mu = (n1 * n2) / 2;
  const tieCorr = tieSizes.reduce((s, t) => s + (t ** 3 - t), 0) / (N * (N - 1));
  const sigma = Math.sqrt((n1 * n2 / 12) * (N + 1 - tieCorr));
  const z = (u - mu + 0.5) / sigma;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const effectR = Math.abs(z) / Math.sqrt(N);
  const stars = pStars(p, alpha);
  const med1 = median(g1), med2 = median(g2);
  const r2 = (N * (N + 1)) / 2 - r1;

  const statTable: ResultTable = {
    title: '组统计（Mann-Whitney）',
    headers: ['组别', 'N', '中位数', '秩均值', '秩和'],
    rows: [
      [names[0], n1, med1, +(r1 / n1).toFixed(3), r1],
      [names[1], n2, med2, +(r2 / n2).toFixed(3), r2],
    ],
  };
  const testTable: ResultTable = {
    title: 'Mann-Whitney U 检验',
    headers: ['统计量', '值'],
    rows: [['U', u], ['z（正态近似）', +z.toFixed(4)], ['p 值（双尾）', +p.toFixed(6)], ['效应量 r', +effectR.toFixed(3)]],
  };
  const conclusion =
    `Mann-Whitney U = ${u}, z = ${z.toFixed(4)}, ${pText(p, alpha)}${stars ? ` ${stars}` : ''}, r = ${effectR.toFixed(3)}。` +
    `两组中位数（${med1.toFixed(3)} vs ${med2.toFixed(3)}）${p < alpha ? '存在显著差异' : '无显著差异'}。`;
  return { statTable, testTable, conclusion, u, z, p, effectR };
}

/** Wilcoxon 符号秩检验（配对，正态近似 + tie 校正） */
export function runWilcoxonSignedRank(rows: Record<string, unknown>[], col1: string, col2: string, alpha = 0.05): {
  statTable: ResultTable; testTable: ResultTable; conclusion: string;
  wPlus: number; wMinus: number; z: number; p: number; effectR: number;
} {
  if (col1 === col2) {
    const err = { title: 'Wilcoxon 符号秩检验', headers: ['错误'], rows: [['配对列不能相同']] };
    return { statTable: err, testTable: err, conclusion: '错误：配对列不能相同', wPlus: NaN, wMinus: NaN, z: NaN, p: NaN, effectR: NaN };
  }
  const diffs: number[] = [];
  const pairs: [number, number][] = [];
  for (const r of rows) {
    const a = Number(r[col1]), b = Number(r[col2]);
    if (isNaN(a) || isNaN(b)) continue;
    pairs.push([a, b]);
    const d = a - b;
    if (d !== 0) diffs.push(d);
  }
  if (diffs.length === 0) {
    const err = { title: 'Wilcoxon 符号秩检验', headers: ['错误'], rows: [['没有非零差值']] };
    return { statTable: err, testTable: err, conclusion: '错误：没有非零差值', wPlus: NaN, wMinus: NaN, z: NaN, p: NaN, effectR: NaN };
  }
  const n = diffs.length;
  const abs = diffs.map((d) => Math.abs(d));
  const { ranks, tieSizes } = rankAll(abs);
  let wPlus = 0, wMinus = 0;
  ranks.forEach((r, i) => { if (diffs[i] > 0) wPlus += r; else wMinus += r; });
  const mu = (n * (n + 1)) / 4;
  let sigma2 = (n * (n + 1) * (2 * n + 1)) / 24;
  if (tieSizes.length) sigma2 -= tieSizes.reduce((s, t) => s + (t ** 3 - t), 0) / 48;
  const sigma = Math.sqrt(sigma2);
  const z = (wPlus - mu) / sigma;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const effectR = Math.abs(z) / Math.sqrt(pairs.length);
  const stars = pStars(p, alpha);

  const nPos = diffs.filter((d) => d > 0).length;
  const nNeg = diffs.filter((d) => d < 0).length;
  const nZero = pairs.length - diffs.length;
  const d1 = pairs.map((p0) => p0[0]), d2 = pairs.map((p0) => p0[1]);
  const statTable: ResultTable = {
    title: '秩统计（Wilcoxon）',
    headers: ['', 'N', '秩均值', '秩和'],
    rows: [
      ['正差值', nPos, nPos ? +(wPlus / nPos).toFixed(3) : 0, wPlus],
      ['负差值', nNeg, nNeg ? +(wMinus / nNeg).toFixed(3) : 0, wMinus],
      ['零差值', nZero, '', ''],
      ['合计', pairs.length, '', ''],
    ],
  };
  const testTable: ResultTable = {
    title: 'Wilcoxon 符号秩检验',
    headers: ['统计量', '值'],
    rows: [
      ['正秩和 W+', wPlus], ['负秩和 W−', wMinus],
      ['z（正态近似）', +z.toFixed(4)], ['p 值（双尾）', +p.toFixed(6)], ['效应量 r', +effectR.toFixed(3)],
    ],
  };
  const md1 = mean(d1), md2 = mean(d2);
  const conclusion =
    `Wilcoxon 符号秩: W+ = ${wPlus}, W− = ${wMinus}, z = ${z.toFixed(4)}, ${pText(p, alpha)}${stars ? ` ${stars}` : ''}。` +
    `两列均值（${md1.toFixed(3)} vs ${md2.toFixed(3)}）${p < alpha ? '存在显著差异' : '无显著差异'}。`;
  return { statTable, testTable, conclusion, wPlus, wMinus, z, p, effectR };
}

/** Kruskal-Wallis 检验（多组，卡方近似 + tie 校正） */
export function runKruskalWallis(rows: Record<string, unknown>[], valueCol: string, groupCol: string, alpha = 0.05): {
  statTable: ResultTable; testTable: ResultTable; conclusion: string;
  h: number; p: number;
} {
  const groups = extractGroupsStrict(rows, valueCol, groupCol);
  const names = Array.from(groups.keys());
  if (names.length < 2) {
    const err = { title: 'Kruskal-Wallis 检验', headers: ['错误'], rows: [['至少需要 2 个分组']] };
    return { statTable: err, testTable: err, conclusion: '错误：至少需要 2 个分组', h: NaN, p: NaN };
  }
  const gVals = names.map((g) => groups.get(g)!);
  const all = gVals.flat();
  const N = all.length;
  const { ranks, tieSizes } = rankAll(all);
  let offset = 0;
  const rankSums = gVals.map((vals) => {
    const s = vals.reduce((acc, _, i) => acc + ranks[offset + i], 0);
    offset += vals.length;
    return s;
  });
  let h = 0;
  gVals.forEach((vals, i) => { h += rankSums[i] ** 2 / vals.length; });
  h = (12 / (N * (N + 1))) * h - 3 * (N + 1);
  const tieCorr = tieSizes.length ? tieSizes.reduce((s, t) => s + (t ** 3 - t), 0) / (N ** 3 - N) : 0;
  const hAdj = h / (1 - tieCorr);
  const df = names.length - 1;
  const p = Math.max(0, Math.min(1, 1 - chiSquareCdf(hAdj, df)));
  const stars = pStars(p, alpha);

  const statTable: ResultTable = {
    title: '组秩统计（Kruskal-Wallis）',
    headers: ['组别', 'N', '中位数', '秩均值', '秩和'],
    rows: names.map((g, i) => [
      g, gVals[i].length, median(gVals[i]),
      +(rankSums[i] / gVals[i].length).toFixed(3), rankSums[i],
    ]),
  };
  const testTable: ResultTable = {
    title: 'Kruskal-Wallis 检验',
    headers: ['统计量', '值'],
    rows: [['H', +h.toFixed(4)], ['H（tie 校正）', +hAdj.toFixed(4)], ['自由度', df], ['p 值', +p.toFixed(6)]],
  };
  const conclusion =
    `Kruskal-Wallis: H(${df}) = ${hAdj.toFixed(4)}, ${pText(p, alpha)}${stars ? ` ${stars}` : ''}。` +
    `${names.length} 组间${p < alpha ? '存在显著差异' : '无显著差异'}。`;
  return { statTable, testTable, conclusion, h: hAdj, p };
}