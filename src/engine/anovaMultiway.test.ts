import { describe, it, expect } from 'vitest';
import { runMultiwayANOVA } from './anovaMultiway';

function rows(records: Record<string, unknown>[]): Record<string, unknown>[] { return records; }

describe('多因素 ANOVA（Type I SS）', () => {
  it('平衡 2×2 设计手算验证：SSA=200, SSB=8, SSAB=0, SSE=8, TSS=216', () => {
    const r = rows([
      { a: 'a1', b: 'b1', y: 1 }, { a: 'a1', b: 'b1', y: 3 },
      { a: 'a1', b: 'b2', y: 3 }, { a: 'a1', b: 'b2', y: 5 },
      { a: 'a2', b: 'b1', y: 11 }, { a: 'a2', b: 'b1', y: 13 },
      { a: 'a2', b: 'b2', y: 13 }, { a: 'a2', b: 'b2', y: 15 },
    ]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b']);
    const anova = res.anovaTable.rows;
    // 主效应 A
    expect(anova[0][0]).toBe('a');
    expect(anova[0][1]).toBeCloseTo(200, 6);
    expect(anova[0][2]).toBe(1);
    expect(anova[0][3]).toBeCloseTo(200, 6);
    expect(anova[0][4]).toBeCloseTo(100, 6);
    expect(anova[0][5]).toBeCloseTo(0.00057, 3);
    // 主效应 B
    expect(anova[1][0]).toBe('b');
    expect(anova[1][1]).toBeCloseTo(8, 6);
    expect(anova[1][4]).toBeCloseTo(4, 6);
    expect(anova[1][5]).toBeCloseTo(0.116, 3);
    // 交互
    expect(anova[2][0]).toBe('a × b');
    expect(anova[2][1]).toBeCloseTo(0, 6);
    expect(anova[2][5]).toBeCloseTo(1, 6);
    // 残差 / 总计
    expect(anova[3][1]).toBeCloseTo(8, 6);
    expect(anova[3][2]).toBe(4);
    expect(anova[4][1]).toBeCloseTo(216, 6);
    expect(anova[4][2]).toBe(7);
    // SS 分解恒等式
    expect(res.anovaTable.rows.slice(0, 3).reduce((s, row) => s + (row[1] as number), 0)).toBeCloseTo(208, 6);
    expect(res.balanced).toBe(true);
    expect(res.conclusion).toContain('a ***'); // p≈0.0006 < 0.001
    expect(res.conclusion).toContain('1 个效应显著');
  });

  it('构造交互效应：A×B 显著且 SSAB > 0', () => {
    const r = rows([
      { a: 'a1', b: 'b1', y: 10 }, { a: 'a1', b: 'b1', y: 12 },
      { a: 'a1', b: 'b2', y: 12 }, { a: 'a1', b: 'b2', y: 14 },   // B 增加 +2
      { a: 'a2', b: 'b1', y: 22 }, { a: 'a2', b: 'b1', y: 24 },
      { a: 'a2', b: 'b2', y: 12 }, { a: 'a2', b: 'b2', y: 14 },   // B 减少 −10（交互翻转）
    ]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b']);
    const anova = res.anovaTable.rows;
    const ssAB = anova[2][1] as number;
    expect(ssAB).toBeCloseTo(72, 6); // TSS 184 − SSA 72 − SSB 32 − SSE 8
    expect(anova[2][5] as number).toBeLessThan(0.01); // F(36,1,4) p≈0.0038
    // 交互均值表应存在且为 2×3
    expect(res.interactionTable).not.toBeNull();
    expect(res.interactionTable!.headers).toEqual(['', 'b1', 'b2']);
    expect(res.interactionTable!.rows[0]).toEqual(['a1', 11, 13]);
    expect(res.interactionTable!.rows[1]).toEqual(['a2', 23, 13]);
    expect(res.conclusion).toContain('个效应显著');
  });

  it('三因素 ANOVA 冒烟：SS 分解成立', () => {
    const r = rows([] as Record<string, unknown>[]);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const base = a * 10 + b * 2 + c * 5;
      r.push({ a: `a${a}`, b: `b${b}`, c: `c${c}`, y: base + 1 });
      r.push({ a: `a${a}`, b: `b${b}`, c: `c${c}`, y: base - 1 });
    }
    const res = runMultiwayANOVA(r, 'y', ['a', 'b', 'c']);
    const rows0 = res.anovaTable.rows;
    expect(rows0).toHaveLength(9); // 7 项 + 残差 + 总计
    const totalSs = rows0[8][1] as number;
    const sumTerms = rows0.slice(0, 7).reduce((s, row) => s + (row[1] as number), 0);
    const sse = rows0[7][1] as number;
    expect(sumTerms + sse).toBeCloseTo(totalSs, 6);
    // 主效应 a 最强
    expect(rows0[0][0]).toBe('a');
    expect((rows0[0][1] as number) > (rows0[1][1] as number)).toBe(true);
  });

  it('非平衡设计给出警告提示', () => {
    const r = rows([
      { a: 'a1', b: 'b1', y: 1 }, { a: 'a1', b: 'b1', y: 3 },
      { a: 'a1', b: 'b2', y: 5 },
      { a: 'a2', b: 'b1', y: 11 }, { a: 'a2', b: 'b2', y: 13 },
    ]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b']);
    expect(res.balanced).toBe(false);
    expect(res.conclusion).toContain('非平衡');
  });

  it('因素水平不足 2 个时报错', () => {
    const r = rows([
      { a: 'a1', b: 'b1', y: 1 }, { a: 'a1', b: 'b1', y: 2 },
      { a: 'a1', b: 'b2', y: 3 }, { a: 'a1', b: 'b2', y: 4 },
    ]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b']);
    expect(res.conclusion).toContain('错误');
  });

  it('因素数量超出 2-3 时报错', () => {
    const r = rows([{ a: 'a1', b: 'b1', c: 'c1', y: 1 }]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b', 'c', 'd']);
    expect(res.conclusion).toContain('错误');
  });

  it('缺失响应或因素被排除', () => {
    const r = rows([
      { a: 'a1', b: 'b1', y: 1 }, { a: 'a1', b: 'b1', y: 3 },
      { a: 'a1', b: 'b2', y: 3 }, { a: 'a1', b: 'b2', y: '' },
      { a: 'a2', b: 'b1', y: 11 }, { a: '', b: 'b2', y: 13 },
    ]);
    const res = runMultiwayANOVA(r, 'y', ['a', 'b']);
    // 有效样本 4 个（a1b1×2, a1b2×1, a2b1×1），a2b2 无样本 → 非平衡
    expect(res.balanced).toBe(false);
    expect(res.anovaTable.rows[4][2]).toBe(3); // 总计 df = N−1 = 3
  });
});
