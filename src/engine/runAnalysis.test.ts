import { describe, it, expect } from 'vitest';
import { computeAnalysis, type AnalysisInput } from './runAnalysis';
import { applyOutputFilter, defaultCheckedOutputs } from './outputModules';
import type { AnalysisType } from '@/types/analysis';

function base(overrides: Partial<AnalysisInput>): AnalysisInput {
  return {
    analysisType: 'descriptive',
    rows: [
      { x: '1', y: '2', g: 'A' },
      { x: '2', y: '4', g: 'A' },
      { x: '3', y: '6', g: 'B' },
      { x: '4', y: '8', g: 'B' },
      { x: '5', y: '10', g: 'B' },
    ],
    alpha: 0.05,
    numericCols: ['x', 'y'],
    valueCols: [],
    xCols: [],
    factorCols: [],
    corrMethod: 'pearson',
    modelName: 'linear',
    pipelineModels: [],
    ...overrides,
  };
}

describe('computeAnalysis', () => {
  it('descriptive: uses numericCols fallback', () => {
    const r = computeAnalysis(base({ analysisType: 'descriptive' }));
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].headers).toContain('变量');
    expect(r.tables[0].rows).toHaveLength(2);
  });

  it('linear-regression: returns coefficient table + conclusion + residual chart', () => {
    const r = computeAnalysis(base({ analysisType: 'linear-regression', xCols: ['x'], yCol: 'y' }));
    expect(r.tables).toHaveLength(1);
    expect(r.conclusion).toContain('R²');
    expect(r.chartData).toHaveLength(1);
    expect(r.chartData![0].title).toContain('残差诊断图');
  });

  it('nonlinear-fit: uses modelName for curve title', () => {
    const r = computeAnalysis(base({ analysisType: 'nonlinear-fit', xCols: ['x'], yCol: 'y', modelName: 'exp' }));
    expect(r.chartData![0].title).toContain('拟合曲线');
  });

  it('rsm: returns 4 tables + 6 charts + rsm object', () => {
    const rows = [
      { A: '-1', B: '-1', Y: '80.5' },
      { A: '1', B: '-1', Y: '81.5' },
      { A: '-1', B: '1', Y: '83.0' },
      { A: '1', B: '1', Y: '84.0' },
      { A: '0', B: '0', Y: '82.0' },
    ];
    const r = computeAnalysis(base({ analysisType: 'rsm', rows, factorCols: ['A', 'B'], responseCol: 'Y' }));
    expect(r.tables.length).toBeGreaterThanOrEqual(4);
    expect(r.chartData!.length).toBe(6);
    expect(r.rsm?.equation).toBeTruthy();
    expect(r.rsm?.equationActual).toBeTruthy();
    expect(r.rsm?.codedDefs).toBeDefined();
  });

  it('pca: returns eigen table + 3 charts', () => {
    const r = computeAnalysis(base({ analysisType: 'pca' }));
    expect(r.tables).toHaveLength(1);
    expect(r.chartData!.map((c) => c.title)).toEqual(['PCA 碎石图', 'PCA 载荷图', 'PCA 得分散点图']);
  });

  it('pipeline: phases tables prefixed, runs end to end', () => {
    const r = computeAnalysis(base({ analysisType: 'pipeline', groupCol: 'g', pipelineModels: ['correlation', 'pca'] }));
    const titles = r.tables.map((t) => t.title);
    expect(titles.some((t) => t.startsWith('【阶段一】'))).toBe(true);
    expect(titles.some((t) => t.startsWith('【阶段二】'))).toBe(true);
    expect(titles.some((t) => t.startsWith('【阶段三】'))).toBe(true);
    expect(r.chartData![0].title).toContain('PCA 得分图');
  });

  it('ttest-independent: returns table, conclusion and boxplot chart', () => {
    const r = computeAnalysis(base({ analysisType: 'ttest-independent', valueCols: ['x'], groupCol: 'g' }));
    expect(r.tables).toHaveLength(1);
    expect(r.conclusion).toBeTruthy();
    expect(r.chartData).toHaveLength(1);
    expect(r.chartData![0].chartType).toBe('boxplot');
  });

  it('anova-oneway: returns ANOVA + Tukey tables', () => {
    const r = computeAnalysis(base({ analysisType: 'anova-oneway', valueCols: ['x'], groupCol: 'g' }));
    expect(r.tables).toHaveLength(2);
    expect(r.tables[1].title).toContain('Tukey');
  });

  it('correlation: returns matrix table + heatmap', () => {
    const r = computeAnalysis(base({ analysisType: 'correlation', corrMethod: 'spearman' }));
    expect(r.tables).toHaveLength(1);
    expect(r.chartData![0].title).toContain('spearman');
  });

  it('frequency: returns frequency table for valueCols[0]', () => {
    const r = computeAnalysis(base({ analysisType: 'frequency', valueCols: ['g'] }));
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].title).toContain('频数统计');
  });

  it('grouped-stats: returns grouped table', () => {
    const r = computeAnalysis(base({ analysisType: 'grouped-stats', groupCol: 'g' }));
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].title).toContain('分组统计');
  });

  it('normality: returns test table + QQ charts', () => {
    const r = computeAnalysis(base({ analysisType: 'normality' }));
    expect(r.tables).toHaveLength(1);
    expect(r.chartData!.every((c) => c.chartType === 'qq')).toBe(true);
    expect(r.chartData).toHaveLength(2);
  });

  it('paired ttest: requires both columns', () => {
    const r = computeAnalysis(base({ analysisType: 'ttest-paired', pairedCol1: 'x', pairedCol2: 'y' }));
    expect(r.tables).toHaveLength(1);
    expect(r.conclusion).toBeTruthy();
  });

  it('mann-whitney: stat + test tables and boxplot', () => {
    const r = computeAnalysis(base({ analysisType: 'mann-whitney', valueCols: ['x'], groupCol: 'g' }));
    expect(r.tables.map((t) => t.title)).toEqual(['组统计（Mann-Whitney）', 'Mann-Whitney U 检验']);
    expect(r.conclusion).toContain('Mann-Whitney');
    expect(r.chartData![0].chartType).toBe('boxplot');
  });

  it('wilcoxon: rank stat + test tables', () => {
    const r = computeAnalysis(base({ analysisType: 'wilcoxon', pairedCol1: 'x', pairedCol2: 'y' }));
    expect(r.tables.map((t) => t.title)).toEqual(['秩统计（Wilcoxon）', 'Wilcoxon 符号秩检验']);
    expect(r.conclusion).toContain('Wilcoxon');
  });

  it('kruskal-wallis: rank stat + test tables and boxplot', () => {
    const r = computeAnalysis(base({ analysisType: 'kruskal-wallis', valueCols: ['x'], groupCol: 'g' }));
    expect(r.tables.map((t) => t.title)).toEqual(['组秩统计（Kruskal-Wallis）', 'Kruskal-Wallis 检验']);
    expect(r.conclusion).toContain('Kruskal-Wallis');
    expect(r.chartData).toHaveLength(1);
  });

  it('chi-square independence: two categorical columns → contingency + test + bar chart', () => {
    const rows = [
      { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'N' },
      { a: 'Y', b: 'M' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' },
    ];
    const r = computeAnalysis(base({ analysisType: 'chi-square', rows, valueCols: ['a', 'b'] }));
    expect(r.tables[0].title).toContain('列联表');
    expect(r.tables[1].title).toContain('卡方检验');
    expect(r.conclusion).toContain('卡方检验');
    expect(r.chartData![0].title).toContain('观察 vs 期望');
  });

  it('chi-square GOF: single column → uniform expectation + bar chart', () => {
    const rows = [
      { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' },
      { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' },
    ];
    const r = computeAnalysis(base({ analysisType: 'chi-square', rows, valueCols: ['c'] }));
    expect(r.tables[0].title).toContain('频数分布');
    expect(r.tables[1].title).toContain('拟合优度');
    expect(r.chartData![0].title).toContain('拟合优度');
  });

  it('anova-multiway: ANOVA + means + interaction tables and charts', () => {
    const rows = [
      { a: 'a1', b: 'b1', y: 1 }, { a: 'a1', b: 'b1', y: 3 },
      { a: 'a1', b: 'b2', y: 3 }, { a: 'a1', b: 'b2', y: 5 },
      { a: 'a2', b: 'b1', y: 11 }, { a: 'a2', b: 'b1', y: 13 },
      { a: 'a2', b: 'b2', y: 13 }, { a: 'a2', b: 'b2', y: 15 },
    ];
    const r = computeAnalysis(base({ analysisType: 'anova-multiway', rows, factorCols: ['a', 'b'], responseCol: 'y' }));
    expect(r.tables.map((t) => t.title)).toEqual(['多因素 ANOVA', '水平均值', '交互均值（两因素）']);
    expect(r.conclusion).toContain('多因素 ANOVA');
    expect(r.chartData!.map((c) => c.chartType)).toEqual(['boxplot', 'line']);
    expect(r.chartData![1].title).toContain('交互均值图');
  });

  it('every analysis type renders all default-checked output modules (无"勾选却无输出"回归)', () => {
    // 回归保护：曾出现标题以方法名/列名/模型名开头（如 "pearson 相关矩阵"）导致
    // 模块匹配失败、勾选了也不输出任何内容的问题。这里对全部 18 种分析做端到端校验。
    const rows = [
      { x: '1', y: '2', g: 'A', A: '-1', B: '-1', Y: '80.5' },
      { x: '2', y: '4', g: 'A', A: '1', B: '-1', Y: '81.5' },
      { x: '3', y: '6', g: 'B', A: '-1', B: '1', Y: '83.0' },
      { x: '4', y: '8', g: 'B', A: '1', B: '1', Y: '84.0' },
      { x: '5', y: '10', g: 'B', A: '0', B: '0', Y: '82.0' },
    ];
    const cases: { type: AnalysisType; input: Partial<AnalysisInput> }[] = [
      { type: 'descriptive', input: {} },
      { type: 'frequency', input: { valueCols: ['g'] } },
      { type: 'normality', input: {} },
      { type: 'grouped-stats', input: { groupCol: 'g' } },
      { type: 'ttest-independent', input: { valueCols: ['x'], groupCol: 'g' } },
      { type: 'ttest-paired', input: { pairedCol1: 'x', pairedCol2: 'y' } },
      { type: 'anova-oneway', input: { valueCols: ['x'], groupCol: 'g' } },
      { type: 'anova-multiway', input: { factorCols: ['g', 'A'], responseCol: 'Y' } },
      { type: 'mann-whitney', input: { valueCols: ['x'], groupCol: 'g' } },
      { type: 'wilcoxon', input: { pairedCol1: 'x', pairedCol2: 'y' } },
      { type: 'kruskal-wallis', input: { valueCols: ['x'], groupCol: 'g' } },
      { type: 'chi-square', input: { valueCols: ['g'] } },
      { type: 'correlation', input: { corrMethod: 'pearson' } },
      { type: 'linear-regression', input: { xCols: ['x'], yCol: 'y' } },
      { type: 'nonlinear-fit', input: { xCols: ['x'], yCol: 'y', modelName: 'linear' } },
      { type: 'rsm', input: { factorCols: ['A', 'B'], responseCol: 'Y' } },
      { type: 'pca', input: {} },
      { type: 'pipeline', input: { groupCol: 'g', pipelineModels: ['correlation', 'pca'] } },
    ];
    for (const { type, input } of cases) {
      const result = computeAnalysis(base({ analysisType: type, rows, ...input }));
      const checked = defaultCheckedOutputs(type);
      const mods = applyOutputFilter(type, result, checked, { modelName: input.modelName });
      const missing = checked.filter((k) => !mods.some((m) => m.key === k));
      expect(missing, `${type}: 默认勾选但未输出的模块: ${missing.join(', ')}`).toEqual([]);
      expect(mods.length, `${type}: 未渲染任何输出模块`).toBeGreaterThan(0);
    }
  });
});