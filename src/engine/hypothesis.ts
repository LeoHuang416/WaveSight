import { mean, std, variance, extractNumericColumn, extractByGroup, tTestPValue, fTestPValue } from './utils';
import type { ResultTable } from '@/types/analysis';

export function runIndependentTTest(rows: Record<string, unknown>[], valueCol: string, groupCol: string): {
  table: ResultTable; conclusion: string;
} {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const names = Array.from(groups.keys());
  if (names.length !== 2) return {
    table: { title: '独立样本 t 检验', headers: ['错误'], rows: [['需要恰好两个分组']] },
    conclusion: '错误：需要恰好两个分组',
  };
  const g1 = groups.get(names[0])!, g2 = groups.get(names[1])!;
  const m1 = mean(g1), m2 = mean(g2), v1 = variance(g1), v2 = variance(g2);
  const n1 = g1.length, n2 = g2.length;
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;
  const dfNum = (v1 / n1 + v2 / n2) ** 2;
  const dfDen = ((v1 / n1) ** 2) / (n1 - 1) + ((v2 / n2) ** 2) / (n2 - 1);
  const df = dfNum / dfDen;
  const p = tTestPValue(Math.abs(t), df);
  const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const cohensD = Math.abs(m1 - m2) / pooledSD;
  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  return {
    table: { title: '独立样本 t 检验', headers: ['组别', 'N', '均值', '标准差'], rows: [[names[0], n1, m1, Math.sqrt(v1)], [names[1], n2, m2, Math.sqrt(v2)]] },
    conclusion: `t = ${t.toFixed(4)}, ${pText}, Cohen's d = ${cohensD.toFixed(3)}。两组${p < 0.05 ? '存在显著差异' : '无显著差异'}${p < 0.05 ? ' (p < 0.05)' : ''}。`,
  };
}

export function runPairedTTest(rows: Record<string, unknown>[], col1: string, col2: string): {
  table: ResultTable; conclusion: string;
} {
  const merged = rows.map((r) => ({ a: Number(r[col1]), b: Number(r[col2]) })).filter((v) => !isNaN(v.a) && !isNaN(v.b));
  const diffs = merged.map((v) => v.a - v.b);
  const n = diffs.length;
  const mDiff = mean(diffs), sdDiff = std(diffs);
  const t = mDiff / (sdDiff / Math.sqrt(n));
  const p = tTestPValue(Math.abs(t), n - 1);
  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  return {
    table: { title: '配对 t 检验', headers: ['', 'N', '均值', '标准差', '差值均值'], rows: [[col1, n, mean(merged.map((v) => v.a)), std(merged.map((v) => v.a)), mDiff], [col2, n, mean(merged.map((v) => v.b)), std(merged.map((v) => v.b)), '']] },
    conclusion: `配对 t 检验: t(${n - 1}) = ${t.toFixed(4)}, ${pText}。${col1} 与 ${col2} ${p < 0.05 ? '存在显著差异' : '无显著差异'}。`,
  };
}

export function runOneWayANOVA(rows: Record<string, unknown>[], valueCol: string, groupCol: string): {
  table: ResultTable; conclusion: string;
} {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const names = Array.from(groups.keys());
  const allValues = names.flatMap((g) => groups.get(g)!);
  const grandMean = mean(allValues);
  const N = allValues.length, k = names.length;
  let ssb = 0;
  for (const g of names) { const vals = groups.get(g)!; ssb += vals.length * (mean(vals) - grandMean) ** 2; }
  const dfb = k - 1, msb = ssb / dfb;
  let ssw = 0;
  for (const g of names) { const vals = groups.get(g)!, m = mean(vals); ssw += vals.reduce((s, v) => s + (v - m) ** 2, 0); }
  const dfw = N - k, msw = ssw / dfw;
  const f = msb / msw;
  const p = fTestPValue(f, dfb, dfw);
  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  return {
    table: { title: '单因素 ANOVA', headers: ['来源', 'SS', 'df', 'MS', 'F', 'p'], rows: [['组间', ssb, dfb, msb, f, p], ['组内', ssw, dfw, msw, '', ''], ['总计', ssb + ssw, N - 1, '', '', '']] },
    conclusion: `单因素 ANOVA: F(${dfb}, ${dfw}) = ${f.toFixed(4)}, ${pText}。${p < 0.05 ? '组间存在显著差异' : '组间无显著差异'}。`,
  };
}

export function runTukeyHSD(rows: Record<string, unknown>[], valueCol: string, groupCol: string): ResultTable {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const names = Array.from(groups.keys());
  const N = names.reduce((s, g) => s + groups.get(g)!.length, 0), k = names.length;
  let ssw = 0;
  for (const g of names) { const vals = groups.get(g)!, m = mean(vals); ssw += vals.reduce((s, v) => s + (v - m) ** 2, 0); }
  const msw = ssw / (N - k);
  const headers = ['对比', '均值差', '标准误', 'q', 'p 值', '显著'];
  const resultRows: (string | number)[][] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const v1 = groups.get(names[i])!, v2 = groups.get(names[j])!;
      const diff = mean(v1) - mean(v2);
      const se = Math.sqrt(msw * (1 / v1.length + 1 / v2.length));
      const q = Math.abs(diff) / se;
      const pAdj = Math.min(1, tTestPValue(q, N - k) * (k * (k - 1)) / 2);
      resultRows.push([`${names[i]} vs ${names[j]}`, diff, se, q, pAdj, pAdj < 0.05 ? '*' : pAdj < 0.01 ? '**' : '']);
    }
  }
  return { title: 'Tukey HSD 事后检验', headers, rows: resultRows };
}
