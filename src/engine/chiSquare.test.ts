import { describe, it, expect } from 'vitest';
import { runChiSquareIndependence, runChiSquareGOF } from './chiSquare';

function rows(records: Record<string, unknown>[]): Record<string, unknown>[] { return records; }

describe('卡方独立性检验', () => {
  it('2×2 列联表经典例子：χ²、df、p、Cramér V 手算验证', () => {
    const r = rows([] as Record<string, unknown>[]);
    for (let i = 0; i < 10; i++) r.push({ a: 'X', b: 'M' });
    for (let i = 0; i < 10; i++) r.push({ a: 'X', b: 'N' });
    for (let i = 0; i < 20; i++) r.push({ a: 'Y', b: 'M' });
    for (let i = 0; i < 30; i++) r.push({ a: 'Y', b: 'N' });
    // 列联表: X: M=10 N=10; Y: M=20 N=30 → 总计 70
    const res = runChiSquareIndependence(r, 'a', 'b');
    // 期望: 8.571/11.429/21.429/28.571 → χ² = 0.2381+0.1786+0.0952+0.0714 = 0.5833
    expect(res.chiSq).toBeCloseTo(0.5833, 3);
    expect(res.df).toBe(1);
    // p = 1 − F_χ²(0.5833, 1) ≈ 0.445
    expect(res.p).toBeCloseTo(0.445, 2);
    expect(res.cramersV).toBeCloseTo(Math.sqrt(0.5833 / 70), 3);
    expect(res.table.headers).toEqual(['', 'M', 'N', '合计']);
    expect(res.conclusion).toContain('无显著关联');
  });

  it('完全相关的 2×2 数据给出显著结果', () => {
    const r = rows([
      { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' },
      { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' },
      { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' },
      { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' },
    ]);
    const res = runChiSquareIndependence(r, 'a', 'b');
    expect(res.p).toBeLessThan(0.001);
    expect(res.conclusion).toContain('存在显著关联');
  });

  it('缺失样本被排除', () => {
    const r = rows([
      { a: 'X', b: 'M' }, { a: 'X', b: '' }, { a: '', b: 'M' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' },
      { a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'Y', b: 'N' }, { a: 'Y', b: 'N' },
    ]);
    const res = runChiSquareIndependence(r, 'a', 'b');
    expect(res.df).toBe(1);
    const total = res.table.rows.find((row) => row[0] === '合计')!;
    expect(total[3]).toBe(7);
  });

  it('类别不足 2 个时返回错误', () => {
    const r = rows([{ a: 'X', b: 'M' }, { a: 'X', b: 'M' }, { a: 'X', b: 'M' }]);
    const res = runChiSquareIndependence(r, 'a', 'b');
    expect(res.conclusion).toContain('错误');
  });
});

describe('卡方拟合优度检验', () => {
  it('均匀分布：手算 χ²=20, df=3', () => {
    const r = rows([
      { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' },
      { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' },
      { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' },
      { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' },
      { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' }, { c: 'C' },
      { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' },
      { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' },
      { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' },
      { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' },
      { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' }, { c: 'D' },
    ]);
    // A=10, B=20, C=20, D=50, N=100, 期望=25 → χ² = 9+1+1+25 = 36
    const res = runChiSquareGOF(r, 'c');
    expect(res.chiSq).toBeCloseTo(36, 6);
    expect(res.df).toBe(3);
    expect(res.p).toBeLessThan(0.001);
    expect(res.conclusion).toContain('不符合');
  });

  it('观察=期望 时 χ²≈0、p≈1', () => {
    const r = rows([
      { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' },
      { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' }, { c: 'B' },
    ]);
    const res = runChiSquareGOF(r, 'c');
    expect(res.chiSq).toBeCloseTo(0, 6);
    expect(res.p).toBeGreaterThan(0.99);
    expect(res.conclusion).toContain('符合');
  });

  it('自定义期望比例', () => {
    const r = rows([
      { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' }, { c: 'A' },
      { c: 'B' }, { c: 'B' },
    ]);
    // 期望 A:75% B:25% → 观察(8,2) vs 期望(7.5,2.5) → χ² ≈ 0.1333
    const res = runChiSquareGOF(r, 'c', { A: 0.75, B: 0.25 });
    expect(res.chiSq).toBeCloseTo(0.1333, 3);
    expect(res.conclusion).toContain('自定义比例');
  });
});
