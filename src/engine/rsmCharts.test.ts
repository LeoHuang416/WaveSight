import { describe, it, expect } from 'vitest';
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

describe('buildRsmCharts contour', () => {
  it('draws real contour lines with value labels, predicted-range colorbar, and a center star', () => {
    const rsm = runRSM(BB, ['A', 'B', 'C'], 'Y');
    const c = buildRsmCharts(rsm, ['A', 'B', 'C'], 'Y', BB);
    const series = c.contour.series as Record<string, unknown>[];
    // 填充背景为 custom series
    expect(series[0].type).toBe('custom');
    // 真实等值线（多等级，且有数据点）
    const lines = series.filter((s) => s.type === 'line');
    expect(lines.length).toBeGreaterThan(1);
    expect((lines[0].data as unknown[]).length).toBeGreaterThan(2);
    // 等值线数值标注：每条等值线带 markPoint 数值标签
    const labeled = lines.filter((s) => {
      const mp = (s as { markPoint?: { data?: { value?: number }[] } }).markPoint;
      return Array.isArray(mp?.data) && mp.data.length > 0 && typeof mp.data[0].value === 'number';
    });
    expect(labeled.length).toBeGreaterThan(0);
    // 色标范围 = A×B 域内模型预测范围（约 64–86），而非观测范围（64–92.8）
    const vm = c.contour.visualMap as { min: number; max: number };
    expect(vm.max).toBeGreaterThan(84);
    expect(vm.max).toBeLessThan(88);
    expect(vm.min).toBeLessThan(65);
    // 中心点用星号标记
    const star = series.filter((s) => s.type === 'scatter' && String(s.symbol).startsWith('path://'));
    expect(star.length).toBe(1);
    expect((star[0].data as unknown[]).length).toBeGreaterThan(0);
  });
  it('forms closed contour rings around an interior optimum (dome)', () => {
    // 穹顶 z = 85 − 5x² − 4y²：等值线为椭圆环
    const rows: Record<string, unknown>[] = [];
    for (let x = -1; x <= 1; x += 0.5) for (let y = -1; y <= 1; y += 0.5) rows.push({ x, y, z: 85 - 5 * x * x - 4 * y * y });
    const rsm = runRSM(rows, ['x', 'y'], 'z');
    const series = buildRsmCharts(rsm, ['x', 'y'], 'z', rows).contour.series as Record<string, unknown>[];
    const runs = (data: unknown[]): number[][][] => {
      const out: number[][][] = []; let cur: number[][] = [];
      for (const it of data) { if (it === null) { if (cur.length) { out.push(cur); cur = []; } } else cur.push(it as number[]); }
      if (cur.length) out.push(cur);
      return out;
    };
    const closed = series.filter((s) => s.type === 'line').some((s) =>
      runs(s.data as unknown[]).some((p) => p.length > 4 && Math.abs(p[0][0] - p[p.length - 1][0]) < 1e-6 && Math.abs(p[0][1] - p[p.length - 1][1]) < 1e-6));
    expect(closed).toBe(true);
  });
});
