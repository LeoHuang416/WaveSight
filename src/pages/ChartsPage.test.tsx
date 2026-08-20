import { describe, it, expect } from 'vitest';
import { applyEditor, buildRenderOption } from './ChartsPage';
import type { ChartConfig } from '@/types/chart';
import type { Dataset } from '@/types/data';

function cfg(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    id: 'c1', title: 't', chartType: 'bar', datasetId: 'd1', columnMapping: {}, echartsOption: {},
    colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12, xAxisLabel: '', yAxisLabel: '', createdAt: 0,
    ...overrides,
  };
}

const ds: Dataset = {
  id: 'd1', name: 'ds', fileName: 'a.csv',
  columns: [
    { name: 'A', type: 'numeric', role: 'independent', index: 0 },
    { name: 'B', type: 'numeric', role: 'independent', index: 1 },
    { name: 'Y', type: 'numeric', role: 'dependent', index: 2 },
  ],
  rows: [
    { A: -1, B: -1, Y: 66.75 }, { A: -1, B: 1, Y: 69.79 },
    { A: 1, B: -1, Y: 74.97 }, { A: 1, B: 1, Y: 88.28 },
    { A: 0, B: 0, Y: 82.36 },
  ],
  rowCount: 5, colCount: 3, importedAt: 0,
};

describe('applyEditor（图表动画配置）', () => {
  it('注入 animationDuration 与 animationEasing', () => {
    const out = applyEditor({}, cfg({ animationDuration: 2000, animationEasing: 'elasticOut' }));
    expect(out.animationDuration).toBe(2000);
    expect(out.animationEasing).toBe('elasticOut');
  });

  it('未设置动画时不注入 animation 字段', () => {
    const out = applyEditor({}, cfg());
    expect(out.animationDuration).toBeUndefined();
    expect(out.animationEasing).toBeUndefined();
  });

  it('动画时长 0 表示关闭', () => {
    const out = applyEditor({}, cfg({ animationDuration: 0 }));
    expect(out.animationDuration).toBe(0);
  });

  it('保留原有 option 并叠加动画配置', () => {
    const out = applyEditor({ series: [{ type: 'bar', data: [1] }] }, cfg({ animationDuration: 300 }));
    expect(out.series).toEqual([{ type: 'bar', data: [1] }]);
    expect(out.animationDuration).toBe(300);
  });
});

describe('buildRenderOption（问题2：图表模块从数据集重建 RSM 类图）', () => {
  it('contour：即使存储 option 被剥离（无 renderItem），也重建出含 renderItem 函数的完整 option', () => {
    // 模拟保存时被 stripFunctions 剥离后的 echartsOption：只剩标题壳
    const stripped = { title: { text: '等高线图', left: 'center' } };
    const out = buildRenderOption(cfg({ chartType: 'contour', datasetId: 'd1', echartsOption: stripped, columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } }), ds);
    const custom = (out.series as Record<string, unknown>[]).find((s) => s.type === 'custom');
    expect(custom).toBeDefined();
    expect(typeof (custom as { renderItem?: unknown }).renderItem).toBe('function');
  });

  it('surface3d：重建出带 grid3D 的 3D 响应面 option（可导出 PNG）', () => {
    const stripped = { title: { text: '3D 响应面', left: 'center' } };
    const out = buildRenderOption(cfg({ chartType: 'surface3d', datasetId: 'd1', echartsOption: stripped, columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } }), ds);
    expect(out.grid3D).toBeDefined();
    expect((out.series as Record<string, unknown>[])[0].type).toBe('surface');
  });

  it('heatmap：重建出热力图 option', () => {
    const stripped = { title: { text: '响应面热力图', left: 'center' } };
    const out = buildRenderOption(cfg({ chartType: 'heatmap', datasetId: 'd1', echartsOption: stripped, columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } }), ds);
    expect(out.series).toBeDefined();
  });

  it('普通图（如 bar）仍使用存储的 echartsOption，不重建', () => {
    const stored = { series: [{ type: 'bar', data: [1, 2] }] };
    const out = buildRenderOption(cfg({ chartType: 'bar', datasetId: 'd1', echartsOption: stored }), ds);
    expect(out).toEqual(applyEditor(stored, cfg({ chartType: 'bar', datasetId: 'd1', echartsOption: stored })));
    expect((out.series as Record<string, unknown>[])[0].data).toEqual([1, 2]);
  });

  it('数据集不匹配时回退到存储的剥离版 option，不崩溃', () => {
    const stripped = { title: { text: '旧数据集等高线', left: 'center' } };
    const out = buildRenderOption(cfg({ chartType: 'contour', datasetId: 'other-ds', echartsOption: stripped }), ds);
    expect((out.title as { text: string }).text).toBe('旧数据集等高线');
  });
});