/**
 * 输出模块：将一次分析的结果拆分为可勾选的输出单元（借鉴 SPSS `statistics`
 * 子命令与 R jtools::summ 的 model.fit/model.info 开关设计）。
 * 用户勾选哪些模块，就只渲染/导出哪些结果（R²、回归方程、系数表…）。
 */
import type { AnalysisType, ResultTable, ChartDataSource } from '@/types/analysis';
import type { RSMResult } from './modeling';

export interface OutputModuleDef {
  key: string;
  label: string;
  /** 匹配表格（table.title 包含该关键字，取最长匹配归组） */
  tables?: string[];
  /** 匹配图表（chart title 包含该关键字） */
  charts?: string[];
  /** 特殊输出：conclusion | equation | optimal | fit */
  specials?: string[];
  /** 拆列输出：表格只保留这些列（首个必须为行名列，如 变量/项） */
  columns?: string[];
}

/** 每个分析类型的可勾选输出模块清单（按展示顺序） */
export const OUTPUT_MODULES: Record<AnalysisType, OutputModuleDef[]> = {
  descriptive: [
    { key: 'm-sample', label: '样本量 (N)', tables: ['描述统计'], columns: ['变量', 'N'] },
    { key: 'm-center', label: '集中趋势 (均值/中位数/Q1/Q3)', tables: ['描述统计'], columns: ['变量', '均值', '中位数', 'Q1', 'Q3'] },
    { key: 'm-disperse', label: '离散程度 (标准差/极值)', tables: ['描述统计'], columns: ['变量', '标准差', '最小值', '最大值'] },
    { key: 'm-shape', label: '分布形状 (偏度/峰度)', tables: ['描述统计'], columns: ['变量', '偏度', '峰度'] },
  ],
  frequency: [
    { key: 'm-table', label: '频数分布表', tables: ['频数统计'] },
  ],
  normality: [
    { key: 'm-test', label: '正态性检验表', tables: ['正态性检验'] },
    { key: 'm-qq', label: 'Q-Q 图', charts: ['Q-Q'] },
  ],
  'grouped-stats': [
    { key: 'm-table', label: '分组统计表', tables: ['分组统计'] },
  ],
  'ttest-independent': [
    { key: 'm-table', label: '检验结果表', tables: ['独立样本 t 检验'] },
    { key: 'm-box', label: '分组箱线图', charts: ['按'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'ttest-paired': [
    { key: 'm-table', label: '检验结果表', tables: ['配对 t 检验'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'anova-oneway': [
    { key: 'm-anova', label: '方差分析表', tables: ['单因素 ANOVA'] },
    { key: 'm-tukey', label: 'Tukey 事后检验', tables: ['Tukey HSD'] },
    { key: 'm-box', label: '分组箱线图', charts: ['ANOVA'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'anova-multiway': [
    { key: 'm-anova', label: '方差分析表 (Type I SS)', tables: ['多因素 ANOVA'] },
    { key: 'm-means', label: '水平均值表', tables: ['水平均值'] },
    { key: 'm-interaction', label: '交互均值表', tables: ['交互均值'] },
    { key: 'm-box', label: '分组箱线图', charts: ['多因素 ANOVA'] },
    { key: 'm-interaction-chart', label: '交互均值图', charts: ['交互均值图'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'mann-whitney': [
    { key: 'm-stats', label: '组统计 (中位数/秩和)', tables: ['组统计（Mann-Whitney）'] },
    { key: 'm-test', label: '检验结果表', tables: ['Mann-Whitney U 检验'] },
    { key: 'm-box', label: '分组箱线图', charts: ['Mann-Whitney'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  wilcoxon: [
    { key: 'm-stats', label: '秩统计表', tables: ['秩统计（Wilcoxon）'] },
    { key: 'm-test', label: '检验结果表', tables: ['Wilcoxon 符号秩检验'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'kruskal-wallis': [
    { key: 'm-stats', label: '组秩统计表', tables: ['组秩统计（Kruskal-Wallis）'] },
    { key: 'm-test', label: '检验结果表', tables: ['Kruskal-Wallis 检验'] },
    { key: 'm-box', label: '分组箱线图', charts: ['Kruskal-Wallis'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  'chi-square': [
    { key: 'm-table', label: '频数表 (观察 vs 期望)', tables: ['列联表（观察频数）', '频数分布（观察 vs 期望）'] },
    { key: 'm-test', label: '检验结果表', tables: ['卡方检验', '卡方拟合优度检验'] },
    { key: 'm-bar', label: '频数对比条形图', charts: ['卡方检验', '卡方拟合优度'] },
    { key: 'm-conclusion', label: '检验结论', specials: ['conclusion'] },
  ],
  correlation: [
    { key: 'm-matrix', label: '相关系数矩阵 (含显著性)', tables: ['相关矩阵'] },
    { key: 'm-heatmap', label: '相关热力图', charts: ['相关矩阵'] },
  ],
  'linear-regression': [
    { key: 'm-equation', label: '回归方程', specials: ['equation'] },
    { key: 'm-fit', label: '拟合优度 (R²/调整R²/F)', specials: ['fit'] },
    { key: 'm-coeff', label: '回归系数表 (含 t/p)', tables: ['线性回归'] },
    { key: 'm-resid', label: '残差诊断图', charts: ['残差诊断'] },
  ],
  'nonlinear-fit': [
    { key: 'm-equation', label: '回归方程', specials: ['equation'] },
    { key: 'm-fit', label: '拟合优度 (R²/SSE)', specials: ['fit'] },
    { key: 'm-params', label: '参数估计表', tables: ['非线性拟合'] },
    { key: 'm-curve', label: '拟合曲线图', charts: ['拟合曲线'] },
  ],
  rsm: [
    { key: 'm-equation', label: '回归方程', specials: ['equation'] },
    { key: 'm-summary', label: '模型摘要 (R²/调整R²)', tables: ['模型摘要'] },
    { key: 'm-coeff', label: '回归系数表', tables: ['回归系数'] },
    { key: 'm-anova', label: '方差分析表', tables: ['方差分析'] },
    { key: 'm-resid', label: '残差诊断表', tables: ['残差诊断'] },
    { key: 'm-optimal', label: '最优解', specials: ['optimal'] },
    { key: 'm-contour', label: '等高线图', charts: ['等高线'] },
    { key: 'm-surface', label: '3D 响应面图', charts: ['3D响应面'] },
    { key: 'm-heatmap', label: '响应面热力图', charts: ['响应面热力图'] },
    { key: 'm-diagcharts', label: '残差诊断图 (QQ/残差/Cook)', charts: ['残差正态概率图', '残差 vs 拟合值', 'Cook 距离'] },
    { key: 'm-conclusion', label: '模型结论', specials: ['conclusion'] },
  ],
  pca: [
    { key: 'm-eigen', label: '特征值与方差解释', tables: ['PCA'] },
    { key: 'm-scree', label: '碎石图', charts: ['PCA 碎石图'] },
    { key: 'm-loadings', label: '载荷图', charts: ['PCA 载荷图'] },
    { key: 'm-scores', label: '得分散点图', charts: ['PCA 得分散点图'] },
  ],
  pipeline: [
    { key: 'm-phase1', label: '阶段一：预处理与诊断', tables: ['【阶段一】'] },
    { key: 'm-phase2', label: '阶段二：基础统计与假设检验', tables: ['【阶段二】'] },
    { key: 'm-phase3', label: '阶段三：高级建模与可视化', tables: ['【阶段三】'], charts: ['PCA 得分图'] },
    { key: 'm-conclusion', label: '综合结论', specials: ['conclusion'] },
  ],
};

/** 每个分析类型的默认勾选（核心结果，避免"一下全输出"） */
export function defaultCheckedOutputs(type: AnalysisType): string[] {
  const mods = OUTPUT_MODULES[type] ?? [];
  if (mods.length === 0) return [];
  // 核心 = 按展示顺序前 2 个模块 + 结论模块
  const core = mods.slice(0, 2).map((m) => m.key);
  const conclusions = mods.filter((m) => m.specials?.includes('conclusion')).map((m) => m.key);
  return [...new Set([...core, ...conclusions])];
}

export interface RenderedModule {
  key: string;
  label: string;
  tables?: ResultTable[];
  chart?: ChartDataSource;
  conclusion?: string;
  equation?: { coded: string; actual: string; codedDefs?: string[] };
  optimal?: RSMResult['optimal'] | null;
}

export interface AnalysisResultData {
  tables: ResultTable[];
  conclusion: string;
  chartData?: ChartDataSource[];
  rsm?: RSMResult;
}

function numFmt(v: number): string {
  if (!isFinite(v)) return String(v);
  return String(Number(v.toFixed(4)));
}

/** 从系数/参数表构建回归方程文本 */
export function buildEquation(type: AnalysisType, modelName: string | undefined, tables: ResultTable[]): string | null {
  if (type === 'linear-regression') {
    const t = tables.find((tb) => tb.title.startsWith('线性回归'));
    if (!t) return null;
    const terms: string[] = [];
    for (const row of t.rows) {
      const name = String(row[0]);
      const coef = Number(row[1]);
      if (isNaN(coef)) continue;
      if (name === '(截距)') { terms.push(numFmt(coef)); continue; }
      const sign = coef < 0 ? ' - ' : ' + ';
      const abs = numFmt(Math.abs(coef));
      terms.push(`${sign}${abs}·${name}`);
    }
    return `ŷ = ${terms.join('')}`;
  }
  if (type === 'nonlinear-fit') {
    const t = tables.find((tb) => tb.title.startsWith('非线性拟合'));
    if (!t) return null;
    const p: Record<string, number> = {};
    t.rows.forEach((row) => { const n = String(row[0]); const v = Number(row[1]); if (!isNaN(v)) p[n] = v; });
    const templates: Record<string, (p: Record<string, number>) => string> = {
      linear: (q) => `y = ${numFmt(q.a)}·x ${q.b >= 0 ? '+ ' : '- '}${numFmt(Math.abs(q.b))}`,
      exp: (q) => `y = ${numFmt(q.a)}·e^(${numFmt(q.b)}·x) ${q.c >= 0 ? '+ ' : '- '}${numFmt(Math.abs(q.c))}`,
      power: (q) => `y = ${numFmt(q.a)}·x^${numFmt(q.b)} ${q.c >= 0 ? '+ ' : '- '}${numFmt(Math.abs(q.c))}`,
      gauss: (q) => `y = ${numFmt(q.amp)}·exp(-(x-${numFmt(q.cen)})²/(2·${numFmt(q.wid)}²)) ${q.offset >= 0 ? '+ ' : '- '}${numFmt(Math.abs(q.offset))}`,
    };
    return templates[modelName ?? 'exp']?.(p) ?? null;
  }
  return null;
}

/** 按勾选模块过滤结果 → 渲染模块列表（保持模块定义顺序） */
export function applyOutputFilter(
  type: AnalysisType,
  result: AnalysisResultData,
  checked: string[],
  opts?: { modelName?: string },
): RenderedModule[] {
  const mods = OUTPUT_MODULES[type] ?? [];
  const checkedSet = new Set(checked);
  const out: RenderedModule[] = [];

  // 表格 → 归属"最长匹配关键字"的模块；带 columns 的模块共享同表（列拆分）
  const tableModules = mods.map((m, i) => ({ m, i })).filter(({ m }) => m.tables?.length);
  for (const tb of result.tables) {
    const cands: { m: OutputModuleDef; i: number; len: number }[] = [];
    for (const { m, i } of tableModules) {
      for (const p of m.tables!) {
        // 用子串匹配（而非仅前缀），兼容标题以方法名/列名等动态信息开头的情况（如 "pearson 相关矩阵"）
        if (tb.title.includes(p)) cands.push({ m, i, len: p.length });
      }
    }
    if (cands.length === 0) continue; // 无模块归属的表直接跳过
    cands.sort((a, b) => b.len - a.len || a.i - b.i);
    const splitCands = cands.filter((c) => c.m.columns?.length && checkedSet.has(c.m.key));
    const wholeCand = cands.find((c) => !c.m.columns?.length && checkedSet.has(c.m.key));
    if (splitCands.length > 0) {
      // 列拆分优先：每个勾选的拆列模块都输出该表的对应列
      for (const c of splitCands) {
        const keepIdx = tb.headers.map((h, hi) => (c.m.columns!.includes(h) ? hi : -1)).filter((i) => i >= 0);
        const table = { title: tb.title, headers: keepIdx.map((i) => tb.headers[i]), rows: tb.rows.map((r) => keepIdx.map((i) => r[i])) };
        let mod = out.find((o) => o.key === c.m.key);
        if (!mod) { mod = { key: c.m.key, label: c.m.label }; out.push(mod); }
        (mod.tables ??= []).push(table);
      }
    } else if (wholeCand) {
      let mod = out.find((o) => o.key === wholeCand.m.key);
      if (!mod) { mod = { key: wholeCand.m.key, label: wholeCand.m.label }; out.push(mod); }
      (mod.tables ??= []).push(tb);
    }
  }

  // 图表
  const chartModules = mods.filter((m) => m.charts?.length);
  for (const cd of result.chartData ?? []) {
    let best: OutputModuleDef | null = null;
    let bestLen = 0;
    for (const m of chartModules) {
      for (const p of m.charts!) {
        if (cd.title.includes(p) && p.length > bestLen) { best = m; bestLen = p.length; }
      }
    }
    if (!best || !checkedSet.has(best.key)) continue;
    let mod = out.find((o) => o.key === best!.key);
    if (!mod) { mod = { key: best.key, label: best.label }; out.push(mod); }
    if (!mod.chart) mod.chart = cd;
  }

  // 特殊输出
  for (const m of mods) {
    if (!m.specials?.length) continue;
    if (!checkedSet.has(m.key)) continue;
    let mod: RenderedModule | undefined;
    for (const s of m.specials) {
      if (s === 'conclusion' && result.conclusion) {
        mod ??= out.find((o) => o.key === m.key);
        if (!mod) { mod = { key: m.key, label: m.label }; out.push(mod); }
        mod.conclusion = result.conclusion;
      } else if (s === 'fit' && result.conclusion) {
        mod ??= out.find((o) => o.key === m.key);
        if (!mod) { mod = { key: m.key, label: m.label }; out.push(mod); }
        mod.conclusion = result.conclusion;
      } else if (s === 'equation') {
        mod ??= out.find((o) => o.key === m.key);
        if (!mod) { mod = { key: m.key, label: m.label }; out.push(mod); }
        if (type === 'rsm') {
          if (result.rsm?.equation) mod.equation = { coded: result.rsm.equation, actual: result.rsm.equationActual, codedDefs: result.rsm.codedDefs };
        } else {
          const simple = buildEquation(type, opts?.modelName, result.tables);
          if (simple) mod.equation = { coded: simple, actual: simple };
        }
      } else if (s === 'optimal') {
        mod ??= out.find((o) => o.key === m.key);
        if (!mod) { mod = { key: m.key, label: m.label }; out.push(mod); }
        mod.optimal = result.rsm?.optimal ?? null;
      }
    }
  }

  return out;
}

/** 单模块导出 CSV（表格：headers+rows；方程/结论/最优解：键值行） */
/** 模块 → 结构化行数据（表格/方程/最优解/结论），供 CSV 与 Excel 导出复用 */
export function moduleToRows(mod: RenderedModule, rsmEqForm: 'coded' | 'actual' = 'coded'): (string | number)[][] {
  const rows: (string | number)[][] = [];
  if (mod.tables?.length) {
    for (const t of mod.tables) {
      rows.push([t.title]);
      rows.push(t.headers.map((h) => String(h)));
      t.rows.forEach((r) => rows.push(r.map((v) => v ?? '')));
    }
  } else if (mod.equation) {
    rows.push(['输出项', '内容']);
    rows.push(['回归方程', mod.equation[rsmEqForm] || mod.equation.coded]);
    (mod.equation.codedDefs ?? []).forEach((d) => rows.push(['编码定义', d]));
  } else if (mod.optimal) {
    rows.push(['输出项', '内容']);
    rows.push(['最优响应', mod.optimal.y]);
    rows.push(['条件', mod.optimal.values]);
    rows.push(['类型', mod.optimal.boundary ? '边界最优' : '域内驻点']);
    rows.push(['95% 预测区间', mod.optimal.predInterval]);
  } else if (mod.conclusion) {
    rows.push(['输出项', '内容']);
    rows.push([mod.label, mod.conclusion]);
  }
  return rows;
}

export function moduleToCsv(mod: RenderedModule, rsmEqForm: 'coded' | 'actual' = 'coded'): string {
  return moduleToRows(mod, rsmEqForm).map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}