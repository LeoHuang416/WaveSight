import { describe, it, expect } from 'vitest';
import {
  OUTPUT_MODULES, defaultCheckedOutputs, applyOutputFilter, buildEquation, moduleToCsv,
  type AnalysisResultData,
} from './outputModules';

function result(overrides: Partial<AnalysisResultData> = {}): AnalysisResultData {
  return {
    tables: [
      { title: '描述统计', headers: ['变量', 'N', '均值', '中位数', 'Q1', 'Q3', '标准差', '最小值', '最大值', '偏度', '峰度'], rows: [['x', 5, 3, 3, 2, 4, 1.5811, 1, 5, 0, -1.3]] },
      { title: '线性回归 (OLS)', headers: ['项', '系数', 'SE', 't', 'p'], rows: [['(截距)', 0, 0.5, 0, 1], ['x1', 2, 0.2, 10, 0.001]] },
    ],
    conclusion: '模型显著：R²=0.98，F=100.0 (p<0.001)，x1 显著 (p=0.001)',
    ...overrides,
  };
}

describe('OUTPUT_MODULES', () => {
  it('covers every AnalysisType', () => {
    const types = ['descriptive', 'frequency', 'normality', 'grouped-stats', 'ttest-independent', 'ttest-paired', 'anova-oneway', 'correlation', 'linear-regression', 'nonlinear-fit', 'rsm', 'pca', 'pipeline'];
    for (const t of types) expect(OUTPUT_MODULES[t as keyof typeof OUTPUT_MODULES]).toBeDefined();
  });

  it('defaultCheckedOutputs returns subset (not all modules)', () => {
    const d = defaultCheckedOutputs('linear-regression');
    expect(d.length).toBeLessThan(OUTPUT_MODULES['linear-regression'].length);
    expect(d).toContain('m-equation');
    expect(d).toContain('m-fit');
  });
});

describe('applyOutputFilter', () => {
  it('descriptive: column-split keeps only checked columns', () => {
    const r = result({ tables: [result().tables[0]] });
    const mods = applyOutputFilter('descriptive', r, ['m-sample', 'm-center']);
    expect(mods).toHaveLength(2);
    const sample = mods.find((m) => m.key === 'm-sample')!;
    expect(sample.tables![0].headers).toEqual(['变量', 'N']);
    expect(sample.tables![0].rows[0]).toEqual(['x', 5]);
    const center = mods.find((m) => m.key === 'm-center')!;
    expect(center.tables![0].headers).toEqual(['变量', '均值', '中位数', 'Q1', 'Q3']);
  });

  it('pipeline module collects multiple tables per phase', () => {
    const r: AnalysisResultData = {
      tables: [
        { title: '【阶段一】缺失值诊断', headers: ['列', '缺失数'], rows: [['a', 0]] },
        { title: '【阶段一】异常值检测', headers: ['列', '异常数'], rows: [['a', 1]] },
        { title: '【阶段三】相关矩阵', headers: ['a', 'b'], rows: [['a', 1]] },
      ],
      conclusion: 'ok',
    };
    const mods = applyOutputFilter('pipeline', r, ['m-phase1', 'm-phase3', 'm-conclusion']);
    const phase1 = mods.find((m) => m.key === 'm-phase1')!;
    expect(phase1.tables).toHaveLength(2);
    expect(mods.find((m) => m.key === 'm-phase3')!.tables).toHaveLength(1);
    expect(mods.find((m) => m.key === 'm-conclusion')!.conclusion).toBe('ok');
  });

  it('unchecked modules are dropped', () => {
    const mods = applyOutputFilter('linear-regression', result(), ['m-equation']);
    expect(mods).toHaveLength(1);
    expect(mods[0].key).toBe('m-equation');
    expect(mods[0].equation?.coded).toBe('ŷ = 0 + 2·x1');
  });

  it('table assigned to longest prefix match only', () => {
    // RSM: '方差分析' 只归属 m-anova，不出现在其他模块
    const r: AnalysisResultData = {
      tables: [{ title: '方差分析', headers: ['源', 'SS'], rows: [['回归', 10]] }],
      conclusion: '',
    };
    const mods = applyOutputFilter('rsm', r, ['m-anova', 'm-coeff']);
    expect(mods).toHaveLength(1);
    expect(mods[0].key).toBe('m-anova');
  });

  it('chart prefix matching works', () => {
    const r: AnalysisResultData = {
      tables: [],
      conclusion: '',
      chartData: [
        { chartType: 'qq', title: '残差正态概率图', data: {} },
        { chartType: 'scatter', title: '残差 vs 拟合值', data: {} },
        { chartType: 'bar', title: 'Cook 距离', data: {} },
      ],
    };
    const mods = applyOutputFilter('rsm', r, ['m-diagcharts']);
    expect(mods).toHaveLength(1);
    expect(mods[0].chart).toBeDefined();
    expect(mods[0].chart!.title).toBe('残差正态概率图');
  });

  it('conclusion module renders conclusion text', () => {
    const mods = applyOutputFilter('linear-regression', result(), ['m-fit']);
    expect(mods[0].conclusion).toContain('R²=0.98');
  });

  it('rsm equation uses coded/actual forms', () => {
    const r: AnalysisResultData = {
      tables: [],
      conclusion: '',
      rsm: {
        equation: 'ŷ = 80.0 + 1.5A + 2.0B',
        equationActual: 'ŷ = 70.0 + 0.5·温度 + 0.3·压力',
        codedDefs: ['A=(温度-50)/10', 'B=(压力-100)/20'],
      } as never,
    };
    const mods = applyOutputFilter('rsm', r, ['m-equation']);
    expect(mods[0].equation!.coded).toBe('ŷ = 80.0 + 1.5A + 2.0B');
    expect(mods[0].equation!.actual).toContain('温度');
  });
});

describe('buildEquation', () => {
  it('linear regression equation from coefficient table', () => {
    const eq = buildEquation('linear-regression', undefined, result().tables);
    expect(eq).toBe('ŷ = 0 + 2·x1');
  });

  it('nonlinear gauss equation from params', () => {
    const tables = [{ title: '非线性拟合 (gauss)', headers: ['参数', '估计值'], rows: [['amp', 1.5], ['cen', 0], ['wid', 1], ['offset', 0.2]] }];
    const eq = buildEquation('nonlinear-fit', 'gauss', tables);
    expect(eq).toContain('exp');
    expect(eq).toContain('1.5');
  });

  it('returns null for unknown type', () => {
    expect(buildEquation('descriptive', undefined, [])).toBeNull();
  });
});

describe('moduleToCsv', () => {
  it('table module exports title + headers + rows', () => {
    const mods = applyOutputFilter('descriptive', result(), ['m-sample']);
    const csv = moduleToCsv(mods[0]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"变量","N"');
  });

  it('equation module exports chosen eq form', () => {
    const r: AnalysisResultData = {
      tables: [],
      conclusion: '',
      rsm: { equation: 'coded', equationActual: 'actual', codedDefs: [] } as never,
    };
    const mods = applyOutputFilter('rsm', r, ['m-equation']);
    expect(moduleToCsv(mods[0], 'actual')).toContain('actual');
  });

  it('conclusion module exports single row', () => {
    const mods = applyOutputFilter('linear-regression', result(), ['m-fit']);
    expect(moduleToCsv(mods[0])).toContain('R²=0.98');
  });
});