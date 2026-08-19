/**
 * 卡方检验（V2 新增，PRD §7.2）：
 * - 独立性检验：两个分类变量的列联表 + χ² + Cramér's V
 * - 拟合优度检验：单分类变量的频数 vs 期望比例（默认均匀）
 */
import { chiSquareCdf } from './utils';
import type { ResultTable } from '@/types/analysis';

function pStars(p: number, alpha: number): string { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < alpha ? '*' : ''; }
function pText(p: number, alpha: number): string { return p < 0.001 ? 'p < 0.001' : p < 0.01 ? 'p < 0.01' : p < alpha ? `p < ${alpha}` : `p = ${p.toFixed(3)}`; }

function chiSqPValue(x2: number, df: number): number {
  return Math.max(0, Math.min(1, 1 - chiSquareCdf(x2, df)));
}

/** 列联表频数（排除含缺失的样本） */
function contingencyCounts(rows: Record<string, unknown>[], col1: string, col2: string): {
  rowNames: string[]; colNames: string[]; counts: number[][];
} {
  const rowSet = new Set<string>(), colSet = new Set<string>();
  const pairs: [string, string][] = [];
  for (const r of rows) {
    const a = String(r[col1] ?? '');
    const b = String(r[col2] ?? '');
    if (a === '' || b === '') continue;
    rowSet.add(a); colSet.add(b); pairs.push([a, b]);
  }
  const rowNames = [...rowSet].sort((x, y) => x.localeCompare(y, 'zh'));
  const colNames = [...colSet].sort((x, y) => x.localeCompare(y, 'zh'));
  const counts = rowNames.map(() => colNames.map(() => 0));
  for (const [a, b] of pairs) counts[rowNames.indexOf(a)][colNames.indexOf(b)]++;
  return { rowNames, colNames, counts };
}

export interface ChiSquareIndependenceResult {
  table: ResultTable; testTable: ResultTable; conclusion: string;
  chiSq: number; df: number; p: number; cramersV: number;
  expected: number[][]; smallExpected: number;
}

export function runChiSquareIndependence(
  rows: Record<string, unknown>[], col1: string, col2: string, alpha = 0.05,
): ChiSquareIndependenceResult {
  const { rowNames, colNames, counts } = contingencyCounts(rows, col1, col2);
  if (rowNames.length < 2 || colNames.length < 2) {
    return {
      table: { title: '列联表（观察频数）', headers: ['错误'], rows: [['每个变量至少需要 2 个类别']] },
      testTable: { title: '卡方检验', headers: ['错误'], rows: [['每个变量至少需要 2 个类别']] },
      conclusion: '错误：每个变量至少需要 2 个类别',
      chiSq: NaN, df: 0, p: NaN, cramersV: NaN, expected: [], smallExpected: 0,
    };
  }
  const nRows = rowNames.length, nCols = colNames.length;
  const N = counts.flat().reduce((a, b) => a + b, 0);
  const rowTot = counts.map((r) => r.reduce((a, b) => a + b, 0));
  const colTot = counts[0].map((_, j) => counts.reduce((s, r) => s + r[j], 0));
  const expected = counts.map((r, i) => r.map((_, j) => (rowTot[i] * colTot[j]) / N));

  let chiSq = 0;
  let smallExpected = 0;
  const obsRows: (string | number)[][] = [];
  counts.forEach((r, i) => r.forEach((o, j) => {
    const e = expected[i][j];
    chiSq += (o - e) ** 2 / e;
    if (e < 5) smallExpected++;
    obsRows.push([`${rowNames[i]} × ${colNames[j]}`, o, +e.toFixed(3), +((o - e) ** 2 / e).toFixed(3)]);
  }));

  const df = (nRows - 1) * (nCols - 1);
  const p = chiSqPValue(chiSq, df);
  const cramersV = Math.sqrt(chiSq / (N * Math.min(nRows - 1, nCols - 1)));
  const stars = pStars(p, alpha);

  const headerRow = ['', ...colNames, '合计'];
  const tableRows: (string | number)[][] = counts.map((r, i) => [...r, rowTot[i]]);
  tableRows.push(['合计', ...colTot, N]);

  const conclusion =
    `卡方检验: χ²(${df}) = ${chiSq.toFixed(4)}, ${pText(p, alpha)}${stars ? ` ${stars}` : ''}，Cramér's V = ${cramersV.toFixed(3)}。` +
    `两变量${p < alpha ? '存在显著关联' : '无显著关联'}。` +
    (smallExpected > 0 ? `（警告：${smallExpected} 个单元格期望频数 < 5，χ² 近似可能不准确）` : '');

  return {
    table: { title: '列联表（观察频数）', headers: headerRow, rows: tableRows },
    testTable: {
      title: '卡方检验',
      headers: ['统计量', '值'],
      rows: [['χ²', +chiSq.toFixed(4)], ['自由度', df], ['p 值', +p.toFixed(6)], ['Cramér\'s V', +cramersV.toFixed(4)], ['N', N], ['期望频数 < 5 的单元格数', smallExpected]],
    },
    conclusion,
    chiSq, df, p, cramersV, expected, smallExpected,
  };
}

export interface ChiSquareGOFResult {
  table: ResultTable; testTable: ResultTable; conclusion: string;
  chiSq: number; df: number; p: number;
}

/** 拟合优度检验：期望比例可自定义（求和≈1），否则默认均匀分布 */
export function runChiSquareGOF(
  rows: Record<string, unknown>[], col: string, expectedProportions?: Record<string, number>, alpha = 0.05,
): ChiSquareGOFResult {
  const counts = new Map<string, number>();
  let N = 0;
  for (const r of rows) {
    const v = String(r[col] ?? '');
    if (v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    N++;
  }
  const names = [...counts.keys()].sort((x, y) => x.localeCompare(y, 'zh'));
  if (names.length < 2) {
    return {
      table: { title: '频数分布（观察 vs 期望）', headers: ['错误'], rows: [['至少需要 2 个类别']] },
      testTable: { title: '卡方拟合优度检验', headers: ['错误'], rows: [['至少需要 2 个类别']] },
      conclusion: '错误：至少需要 2 个类别',
      chiSq: NaN, df: 0, p: NaN,
    };
  }
  const k = names.length;
  let chiSq = 0;
  const tableRows: (string | number)[][] = [];
  for (const name of names) {
    const o = counts.get(name)!;
    const prop = expectedProportions ? (expectedProportions[name] ?? 0) : 1 / k;
    const e = N * prop;
    chiSq += (o - e) ** 2 / e;
    tableRows.push([name, o, +e.toFixed(3), +((o - e) ** 2 / e).toFixed(3)]);
  }
  const df = k - 1;
  const p = chiSqPValue(chiSq, df);
  const stars = pStars(p, alpha);
  const conclusion =
    `卡方拟合优度检验: χ²(${df}) = ${chiSq.toFixed(4)}, ${pText(p, alpha)}${stars ? ` ${stars}` : ''}。` +
    `观察频数${p < alpha ? '不符合' : '符合'}期望分布${expectedProportions ? '（自定义比例）' : '（均匀分布）'}。`;
  return {
    table: { title: '频数分布（观察 vs 期望）', headers: ['类别', '观察频数', '期望频数', '贡献 χ²'], rows: tableRows },
    testTable: {
      title: '卡方拟合优度检验',
      headers: ['统计量', '值'],
      rows: [['χ²', +chiSq.toFixed(4)], ['自由度', df], ['p 值', +p.toFixed(6)], ['N', N]],
    },
    conclusion,
    chiSq, df, p,
  };
}