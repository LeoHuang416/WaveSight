import { describe, it, expect } from 'vitest';
import { applyEditor } from './ChartsPage';
import type { ChartConfig } from '@/types/chart';

function cfg(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    id: 'c1', title: 't', chartType: 'bar', datasetId: 'd1', columnMapping: {}, echartsOption: {},
    colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12, xAxisLabel: '', yAxisLabel: '', createdAt: 0,
    ...overrides,
  };
}

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