import { describe, it, expect } from 'vitest';
import { runMannWhitneyU, runWilcoxonSignedRank, runKruskalWallis } from './nonparametric';

function rows(records: Record<string, unknown>[]): Record<string, unknown>[] { return records; }

describe('Mann-Whitney U 检验', () => {
  it('完全分离的两组：U=0，p 很小', () => {
    const r = rows([
      { g: 'A', v: 1 }, { g: 'A', v: 2 }, { g: 'A', v: 3 }, { g: 'A', v: 4 }, { g: 'A', v: 5 }, { g: 'A', v: 6 },
      { g: 'B', v: 10 }, { g: 'B', v: 11 }, { g: 'B', v: 12 }, { g: 'B', v: 13 }, { g: 'B', v: 14 }, { g: 'B', v: 15 },
    ]);
    const res = runMannWhitneyU(r, 'v', 'g');
    expect(res.u).toBe(0);
    const sigma = Math.sqrt((36 / 12) * 13);
    expect(res.z).toBeCloseTo((-18 + 0.5) / sigma, 6);
    expect(res.p).toBeLessThan(0.01);
    expect(res.statTable.headers).toEqual(['组别', 'N', '中位数', '秩均值', '秩和']);
    expect(res.statTable.rows[0][4]).toBe(21); // 组A 秩和 1..6
    expect(res.conclusion).toContain('存在显著差异');
  });

  it('手算样例：组A=[1,2,4,6,7], 组B=[3,5,8,9,10] → U=5, z=(5−12.5+0.5)/σ', () => {
    const r = rows([
      { g: 'A', v: 1 }, { g: 'A', v: 2 }, { g: 'A', v: 4 }, { g: 'A', v: 6 }, { g: 'A', v: 7 },
      { g: 'B', v: 3 }, { g: 'B', v: 5 }, { g: 'B', v: 8 }, { g: 'B', v: 9 }, { g: 'B', v: 10 },
    ]);
    const res = runMannWhitneyU(r, 'v', 'g');
    // R1 = 1+2+4+6+7 = 20 → U1 = 20−15 = 5
    expect(res.u).toBe(5);
    const sigma = Math.sqrt((25 / 12) * 11);
    expect(res.z).toBeCloseTo((5 - 12.5 + 0.5) / sigma, 6);
    expect(res.p).toBeCloseTo(0.1436, 3);
  });

  it('tie 数据：秩均分，σ 经 tie 校正', () => {
    const r = rows([
      { g: 'A', v: 1 }, { g: 'A', v: 1 }, { g: 'A', v: 2 },
      { g: 'B', v: 1 }, { g: 'B', v: 2 }, { g: 'B', v: 3 },
    ]);
    const res = runMannWhitneyU(r, 'v', 'g');
    // 合并秩: 1,1,1→2; 2,2→4.5; 3→6 → 组A 秩和 = 8.5 → U1 = 2.5
    expect(res.u).toBe(2.5);
    expect(res.p).toBeGreaterThan(0.4);
  });

  it('分组不足两个时报错', () => {
    const r = rows([{ g: 'A', v: 1 }, { g: 'A', v: 2 }]);
    const res = runMannWhitneyU(r, 'v', 'g');
    expect(res.conclusion).toContain('错误');
  });
});

describe('Wilcoxon 符号秩检验', () => {
  it('全正差值：W+=n(n+1)/2, W−=0，p 很小', () => {
    const diffs = [1, 3, 5, 7, 9, 11, 13, 15, 17];
    const r = rows(diffs.map((d, i) => ({ a: d + 1, b: 1, i })));
    const res = runWilcoxonSignedRank(r, 'a', 'b');
    expect(res.wPlus).toBe(45); // 9·10/2
    expect(res.wMinus).toBe(0);
    expect(res.p).toBeLessThan(0.01);
    expect(res.conclusion).toContain('存在显著差异');
  });

  it('手算样例：差=[1,−2,3,−4,5,−6] → W+=9, W−=12, z=(9−10.5)/σ', () => {
    const r = rows([
      { a: 2, b: 1 }, { a: 1, b: 3 }, { a: 5, b: 2 }, { a: 2, b: 6 }, { a: 7, b: 2 }, { a: 1, b: 7 },
    ]);
    const res = runWilcoxonSignedRank(r, 'a', 'b');
    expect(res.wPlus).toBe(9);
    expect(res.wMinus).toBe(12);
    const sigma = Math.sqrt((6 * 7 * 13) / 24);
    expect(res.z).toBeCloseTo((9 - 10.5) / sigma, 6);
    expect(res.p).toBeGreaterThan(0.5);
    expect(res.conclusion).toContain('无显著差异');
  });

  it('零差值被排除但计入 N', () => {
    const r = rows([
      { a: 1, b: 1 }, { a: 3, b: 2 }, { a: 5, b: 3 },
    ]);
    const res = runWilcoxonSignedRank(r, 'a', 'b');
    expect(res.wPlus).toBe(3); // 差=[0,1,2] → 非零 [1,2], W+ = 1+2 = 3
    expect(res.statTable.rows[2][1]).toBe(1); // 零差值 N=1
    expect(res.statTable.rows[3][1]).toBe(3); // 合计 N=3
  });

  it('没有非零差值时报错', () => {
    const r = rows([{ a: 1, b: 1 }, { a: 2, b: 2 }]);
    const res = runWilcoxonSignedRank(r, 'a', 'b');
    expect(res.conclusion).toContain('错误');
  });

  it('配对列相同时报错', () => {
    const r = rows([{ a: 1 }, { a: 2 }]);
    const res = runWilcoxonSignedRank(r, 'a', 'a');
    expect(res.conclusion).toContain('配对列不能相同');
  });
});

describe('Kruskal-Wallis 检验', () => {
  it('手算样例：三组 [1,2,3],[4,5,6],[7,8,9] → 秩和 6/15/24, H=7.2, df=2', () => {
    const r = rows([
      { g: 'A', v: 1 }, { g: 'A', v: 2 }, { g: 'A', v: 3 },
      { g: 'B', v: 4 }, { g: 'B', v: 5 }, { g: 'B', v: 6 },
      { g: 'C', v: 7 }, { g: 'C', v: 8 }, { g: 'C', v: 9 },
    ]);
    const res = runKruskalWallis(r, 'v', 'g');
    expect(res.h).toBeCloseTo(7.2, 6);
    expect(res.statTable.rows.map((row) => row[4])).toEqual([6, 15, 24]);
    expect(res.p).toBeCloseTo(0.027, 3);
    expect(res.conclusion).toContain('存在显著差异');
  });

  it('组间无差异：H≈0，p 接近 1', () => {
    const r = rows([
      { g: 'A', v: 2 }, { g: 'A', v: 4 }, { g: 'A', v: 6 },
      { g: 'B', v: 2 }, { g: 'B', v: 4 }, { g: 'B', v: 6 },
    ]);
    const res = runKruskalWallis(r, 'v', 'g');
    expect(res.h).toBeCloseTo(0, 6);
    expect(res.p).toBeGreaterThan(0.99);
    expect(res.conclusion).toContain('无显著差异');
  });

  it('tie 数据：组A=[1,1,1], 组B=[2,2,3] → H=3.8571, H′校正=4.5', () => {
    const r = rows([
      { g: 'A', v: 1 }, { g: 'A', v: 1 }, { g: 'A', v: 1 },
      { g: 'B', v: 2 }, { g: 'B', v: 2 }, { g: 'B', v: 3 },
    ]);
    const res = runKruskalWallis(r, 'v', 'g');
    // 秩: 1,1,1→2; 2,2→4.5; 3→6 → 组A 秩和=6, 组B 秩和=15
    // H = 12/42·(12+75) − 21 = 3.8571; 校正 1−30/210 = 0.85714 → H' = 4.5
    expect(res.h).toBeCloseTo(4.5, 3);
    expect(res.statTable.rows[1][4]).toBe(15);
  });

  it('分组不足 2 个时报错', () => {
    const r = rows([{ g: 'A', v: 1 }, { g: 'A', v: 2 }]);
    const res = runKruskalWallis(r, 'v', 'g');
    expect(res.conclusion).toContain('错误');
  });
});
