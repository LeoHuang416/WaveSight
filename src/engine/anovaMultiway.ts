/**
 * 多因素 ANOVA（V2 新增，PRD §7.2）：
 * 两/三因素方差分析，Type I（序贯）平方和，含交互项。
 * 实现：对因素做 dummy 编码构建设计矩阵（截距 + 主效应 + 交互乘积列），
 * 按序逐个加入项，SS(项) = RSS(前) − RSS(后)，用高斯消元求解正规方程。
 */
import { mean, std, fTestPValue } from './utils';
import type { ResultTable } from '@/types/analysis';

function pStars(p: number, alpha: number): string { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < alpha ? '*' : ''; }
function pText(p: number, alpha: number): string { return p < 0.001 ? 'p < 0.001' : p < 0.01 ? 'p < 0.01' : p < alpha ? `p < ${alpha}` : `p = ${p.toFixed(3)}`; }

interface FactorLevel { name: string; }
interface Sample { y: number; factors: string[]; }

/** 收集有效样本与因素水平 */
function prepare(rows: Record<string, unknown>[], responseCol: string, factorCols: string[]): {
  samples: Sample[]; levels: string[][];
} {
  const levels = factorCols.map(() => new Set<string>());
  const samples: Sample[] = [];
  for (const r of rows) {
    const raw = r[responseCol];
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    const y = Number(raw);
    if (isNaN(y)) continue;
    const fv = factorCols.map((f) => String(r[f] ?? '').trim());
    if (fv.some((v) => v === '')) continue;
    fv.forEach((v, i) => levels[i].add(v));
    samples.push({ y, factors: fv });
  }
  return { samples, levels: levels.map((s) => [...s].sort((a, b) => a.localeCompare(b, 'zh'))) };
}

/** 高斯消元（部分主元）解 A·x = b，返回解与矩阵秩 */
function solveLinear(A: number[][], b: number[]): { x: number[]; rank: number } {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  let rank = 0;
  const pivots: number[] = [];
  for (let col = 0; col < n && rank < n; col++) {
    let piv = rank;
    for (let r = rank + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-10) continue;
    [M[rank], M[piv]] = [M[piv], M[rank]];
    const d = M[rank][col];
    for (let j = col; j <= n; j++) M[rank][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === rank) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-12) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[rank][j];
    }
    pivots.push(col);
    rank++;
  }
  const x = new Array(n).fill(0);
  pivots.forEach((col, i) => { x[col] = M[i][n]; });
  return { x, rank };
}

export interface MultiwayANOVAResult {
  anovaTable: ResultTable; meansTable: ResultTable; interactionTable: ResultTable | null;
  conclusion: string; balanced: boolean;
}

interface Term { name: string; factors: number[]; }

function termNames(factorCols: string[]): Term[] {
  if (factorCols.length === 2) {
    return [
      { name: factorCols[0], factors: [0] },
      { name: factorCols[1], factors: [1] },
      { name: `${factorCols[0]} × ${factorCols[1]}`, factors: [0, 1] },
    ];
  }
  const [a, b, c] = factorCols;
  return [
    { name: a, factors: [0] }, { name: b, factors: [1] }, { name: c, factors: [2] },
    { name: `${a} × ${b}`, factors: [0, 1] }, { name: `${a} × ${c}`, factors: [0, 2] },
    { name: `${b} × ${c}`, factors: [1, 2] }, { name: `${a} × ${b} × ${c}`, factors: [0, 1, 2] },
  ];
}

export function runMultiwayANOVA(
  rows: Record<string, unknown>[], responseCol: string, factorCols: string[], alpha = 0.05,
): MultiwayANOVAResult {
  const { samples, levels } = prepare(rows, responseCol, factorCols);
  const err = (msg: string): MultiwayANOVAResult => ({
    anovaTable: { title: '多因素 ANOVA', headers: ['错误'], rows: [[msg]] },
    meansTable: { title: '水平均值', headers: ['错误'], rows: [[msg]] },
    interactionTable: null, conclusion: `错误：${msg}`, balanced: true,
  });
  if (factorCols.length < 2 || factorCols.length > 3) return err('需要 2-3 个因素列');
  if (levels.some((lv) => lv.length < 2)) return err('每个因素至少需要 2 个水平');
  if (samples.length === 0) return err('没有有效样本');

  const terms = termNames(factorCols);
  const n = samples.length;
  const y = samples.map((s) => s.y);
  const yMean = mean(y);
  const tss = y.reduce((s, v) => s + (v - yMean) ** 2, 0);

  // 水平组合计数（平衡性检查）
  const cellCounts = new Map<string, number>();
  for (const s of samples) {
    const key = s.factors.join('|');
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }
  const counts = [...cellCounts.values()];
  const balanced = counts.every((c) => c === counts[0]);

  // 序贯构建设计矩阵并计算各项 SS
  const rows2: (string | number)[][] = [];
  let rssPrev = tss;
  let rankFinal = 0;
  let allCols: number[][] = [new Array(n).fill(1)]; // 截距列
  for (const term of terms) {
    const newCols: number[][] = [];
    if (term.factors.length === 1) {
      const f = term.factors[0];
      for (let l = 1; l < levels[f].length; l++) {
        const lv = levels[f][l];
        newCols.push(samples.map((s) => (s.factors[f] === lv ? 1 : 0)));
      }
    } else {
      // 交互项：所涉因素 dummy 列的逐元素乘积
      const parts = term.factors.map((f) => {
        const cols: number[][] = [];
        for (let l = 1; l < levels[f].length; l++) {
          const lv = levels[f][l];
          cols.push(samples.map((s) => (s.factors[f] === lv ? 1 : 0)));
        }
        return cols;
      });
      const combos: number[][][] = [[]];
      for (const pc of parts) {
        const next: number[][][] = [];
        for (const combo of combos) for (const c of pc) next.push([...combo, c]);
        combos.length = 0;
        combos.push(...next);
      }
      for (const combo of combos) newCols.push(samples.map((_, i) => combo.reduce((acc, col) => acc * col[i], 1)));
    }
    allCols = [...allCols, ...newCols];

    const XtX: number[][] = allCols.map((_, i) => allCols.map((_, j) => {
      let s = 0;
      for (let k = 0; k < n; k++) s += allCols[i][k] * allCols[j][k];
      return s;
    }));
    const Xty = allCols.map((col) => col.reduce((s, v, i) => s + v * y[i], 0));
    const { rank } = solveLinear(XtX, Xty);
    rankFinal = rank;

    const beta = solveLinear(XtX, Xty).x;
    const residuals = y.map((yi, i) => yi - allCols.reduce((s, col, j) => s + beta[j] * col[i], 0));
    const rssNow = residuals.reduce((s, e) => s + e * e, 0);
    const ss = rssPrev - rssNow;
    const dfTerm = newCols.length;
    rssPrev = rssNow;
    rows2.push([term.name, ss, dfTerm, ss / dfTerm, '', '']);
  }

  // 残差与总计
  const sse = rssPrev;
  const dfE = n - rankFinal;
  const mse = sse / dfE;
  const anovaRows = rows2.map((r) => {
    const ms = r[3] as number;
    const f = ms / mse;
    const p = fTestPValue(f, r[2] as number, dfE);
    return [r[0], r[1], r[2], ms, f, p];
  });
  anovaRows.push(['残差', sse, dfE, mse, '', '']);
  anovaRows.push(['总计', tss, n - 1, '', '', '']);
  const anovaTable: ResultTable = {
    title: '多因素 ANOVA',
    headers: ['来源', 'SS（Type I）', 'df', 'MS', 'F', 'p'],
    rows: anovaRows,
  };

  // 水平均值表
  const meansRows: (string | number)[][] = [];
  factorCols.forEach((f, i) => {
    for (const lv of levels[i]) {
      const vals = samples.filter((s) => s.factors[i] === lv).map((s) => s.y);
      meansRows.push([f, lv, vals.length, +mean(vals).toFixed(4), +std(vals).toFixed(4)]);
    }
  });
  const meansTable: ResultTable = {
    title: '水平均值',
    headers: ['因素', '水平', 'N', '均值', '标准差'],
    rows: meansRows,
  };

  // 交互均值表（仅两因素时输出交叉矩阵）
  let interactionTable: ResultTable | null = null;
  if (factorCols.length === 2) {
    const lvA = levels[0], lvB = levels[1];
    const headers = ['', ...lvB];
    const itRows: (string | number)[][] = lvA.map((a) => {
      const cells = lvB.map((b) => {
        const vals = samples.filter((s) => s.factors[0] === a && s.factors[1] === b).map((s) => s.y);
        return vals.length ? +mean(vals).toFixed(4) : '';
      });
      return [a, ...cells];
    });
    interactionTable = { title: '交互均值（两因素）', headers, rows: itRows };
  }

  // 结论
  const sigParts = anovaRows.slice(0, terms.length).map((r, i) => {
    const p = r[5] as number;
    const stars = pStars(p, alpha);
    return `${String(r[0])}${stars ? ` ${stars}` : ''}`;
  });
  const sigCount = anovaRows.slice(0, terms.length).filter((r) => (r[5] as number) < alpha).length;
  const conclusion =
    `多因素 ANOVA（Type I 序贯平方和，${factorCols.length} 因素）：${sigParts.join('、')}。` +
    `共 ${sigCount} 个效应${sigCount ? '显著' : '均不显著'}。` +
    (balanced ? '' : '（注意：非平衡设计，序贯 SS 依赖因素输入顺序）');

  return { anovaTable, meansTable, interactionTable, conclusion, balanced };
}