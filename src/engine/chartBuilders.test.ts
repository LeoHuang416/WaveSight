import { describe, it, expect } from 'vitest';
import { buildChartOption, selectNumericCols } from './chartBuilders';
import { runRSM } from './modeling';
import { buildRsmCharts } from './rsmCharts';

// 真实 Box-Behnken 3 因子 15 次实验（编码 A/B/C → 产率 Y）
const BB: Record<string, unknown>[] = [
  { A: -1, B: -1, C: 0, Y: 66.75 }, { A: -1, B: 1, C: 0, Y: 69.79 },
  { A: 1, B: -1, C: 0, Y: 74.97 }, { A: 1, B: 1, C: 0, Y: 88.28 },
  { A: -1, B: 0, C: -1, Y: 64.15 }, { A: -1, B: 0, C: 1, Y: 73.15 },
  { A: 1, B: 0, C: -1, Y: 81.87 }, { A: 1, B: 0, C: 1, Y: 76.0 },
  { A: 0, B: -1, C: -1, Y: 72.3 }, { A: 0, B: -1, C: 1, Y: 73.81 },
  { A: 0, B: 1, C: -1, Y: 74.3 }, { A: 0, B: 1, C: 1, Y: 92.8 },
  { A: 0, B: 0, C: 0, Y: 82.36 }, { A: 0, B: 0, C: 0, Y: 79.13 },
  { A: 0, B: 0, C: 0, Y: 79.41 },
];

const columns = [
  { name: 'A', type: 'numeric' as const },
  { name: 'B', type: 'numeric' as const },
  { name: 'C', type: 'numeric' as const },
  { name: 'Y', type: 'numeric' as const },
];

/** 函数引用每次构建都不同（如 formatter/renderItem），结构比较时归一化 */
function normalize(v: unknown): unknown {
  if (typeof v === 'function') return '[fn]';
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = normalize(val);
    return out;
  }
  return v;
}

describe('buildChartOption 与 RSM 分析模块一致（问题2）', () => {
  it('contour：图表模块直接复用 buildRsmCharts 结果（custom 填充 + 等值线 + renderItem 函数）', () => {
    const opt = buildChartOption({ rows: BB, columns, chartType: 'contour', title: '等高线图', colorScheme: 'color', columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } });
    // 与分析模块 buildRsmCharts 完全一致
    const rsm = runRSM(BB, ['A', 'B'], 'Y');
    const ref = buildRsmCharts(rsm, ['A', 'B'], 'Y', BB).contour;
    expect(normalize(opt)).toEqual(normalize(ref));
    // custom 背景 series 含 renderItem 函数（可正常渲染/导出 PNG）
    const custom = (opt.series as Record<string, unknown>[]).find((s) => s.type === 'custom');
    expect(custom).toBeDefined();
    expect(typeof (custom as { renderItem?: unknown }).renderItem).toBe('function');
  });

  it('surface3d：与 RSM 分析模块 3D 响应面一致，含 grid3D 与 surface series', () => {
    const opt = buildChartOption({ rows: BB, columns, chartType: 'surface3d', title: '3D 响应面', colorScheme: 'color', columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } });
    const rsm = runRSM(BB, ['A', 'B'], 'Y');
    const ref = buildRsmCharts(rsm, ['A', 'B'], 'Y', BB).surface3d;
    expect(normalize(opt)).toEqual(normalize(ref));
    expect((opt.series as Record<string, unknown>[])[0].type).toBe('surface');
    expect(opt.grid3D).toBeDefined();
  });

  it('heatmap：与 RSM 分析模块响应面热力图一致', () => {
    const opt = buildChartOption({ rows: BB, columns, chartType: 'heatmap', title: '响应面热力图', colorScheme: 'color', columnMapping: { xCol: 'A', yCol: 'B', zCol: 'Y' } });
    const rsm = runRSM(BB, ['A', 'B'], 'Y');
    const ref = buildRsmCharts(rsm, ['A', 'B'], 'Y', BB).heatmap;
    expect(normalize(opt)).toEqual(normalize(ref));
  });

  it('X/Y 同一变量时报错提示而非崩溃', () => {
    const opt = buildChartOption({ rows: BB, columns, chartType: 'contour', title: 't', colorScheme: 'color', columnMapping: { xCol: 'A', yCol: 'A', zCol: 'Y' } });
    expect((opt.title as { text: string }).text).toContain('不能是同一变量');
  });
});

describe('selectNumericCols 排除分组/低基数列', () => {
  it('排除实验分组列与低基数数值列', () => {
    const rows = [
      { x: 1, y: 5, g: 1, meta: 1 }, { x: 2, y: 6, g: 1, meta: 2 },
      { x: 3, y: 7, g: 2, meta: 3 }, { x: 4, y: 8, g: 2, meta: 4 },
    ];
    const cols = [
      { name: 'x', type: 'numeric' as const }, { name: 'y', type: 'numeric' as const },
      { name: 'g', type: 'numeric' as const }, { name: 'meta', type: 'numeric' as const, role: 'metadata' as const },
    ];
    const nums = selectNumericCols(rows, cols, 'g');
    expect(nums).toEqual(['x', 'y']);
  });
});