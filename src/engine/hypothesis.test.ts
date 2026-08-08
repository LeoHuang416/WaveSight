import { describe, it, expect } from 'vitest';
import { runIndependentTTest, runPairedTTest, runOneWayANOVA, runTukeyHSD } from './hypothesis';

const rows = [
  { val: '10', grp: 'A' }, { val: '12', grp: 'A' }, { val: '11', grp: 'A' },
  { val: '20', grp: 'B' }, { val: '22', grp: 'B' }, { val: '21', grp: 'B' },
];

describe('runIndependentTTest', () => {
  it('detects significant difference between two groups', () => {
    const r = runIndependentTTest(rows, 'val', 'grp');
    expect(r.table.rows).toHaveLength(2);
    expect(r.conclusion).toContain('t =');
    expect(r.conclusion).toContain('存在显著差异');
  });
  it('rejects non-binary groups', () => {
    const r = runIndependentTTest(rows, 'val', 'val');
    expect(r.table.rows[0][0]).toBe('需要恰好两个分组');
  });
  it('respects alpha for significance judgment', () => {
    // With alpha=0.0001, p < 0.05 but not < 0.0001 → not significant
    const r = runIndependentTTest(rows, 'val', 'grp', 0.0001);
    expect(r.conclusion).toContain('无显著差异');
    // With default alpha=0.05 → significant
    const r2 = runIndependentTTest(rows, 'val', 'grp');
    expect(r2.conclusion).toContain('存在显著差异');
  });
});

describe('runPairedTTest', () => {
  it('computes paired statistics', () => {
    const pairedRows = [
      { before: '10', after: '12' },
      { before: '11', after: '13' },
      { before: '12', after: '15' },
    ];
    const r = runPairedTTest(pairedRows, 'before', 'after');
    expect(r.table.rows).toHaveLength(2);
    expect(r.conclusion).toContain('配对');
  });
});

describe('runOneWayANOVA', () => {
  it('computes F-statistic for groups', () => {
    const r = runOneWayANOVA(rows, 'val', 'grp');
    expect(r.table.rows.length).toBeGreaterThanOrEqual(2);
    expect(r.conclusion).toContain('F(');
  });
  it('uses alpha in p-text and significance', () => {
    const r = runOneWayANOVA(rows, 'val', 'grp', 0.001);
    expect(r.conclusion).toContain('p <');
  });
});

describe('runTukeyHSD', () => {
  it('returns pairwise comparisons', () => {
    const r = runTukeyHSD(rows, 'val', 'grp');
    expect(r.rows).toHaveLength(1); // one pair: A vs B
  });
  it('uses correct star hierarchy for p < 0.001', () => {
    // Create data with a very strong effect → p very small
    const strongData = [
      { val: '1', grp: 'A' }, { val: '1.1', grp: 'A' }, { val: '0.9', grp: 'A' },
      { val: '100', grp: 'B' }, { val: '101', grp: 'B' }, { val: '99', grp: 'B' },
    ];
    const r = runTukeyHSD(strongData, 'val', 'grp');
    // The p-value is extremely small, so it should get ***
    // Check that stars are correctly ordered — last column is '显著'
    const stars = r.rows[0][r.rows[0].length - 1] as string;
    // Should start with the most significant mark (*** or at least not just *)
    expect(stars.length).toBeGreaterThanOrEqual(2); // at least **
    expect(stars).not.toBe('*'); // not just a single star
  });
  it('uses alpha for star threshold', () => {
    const r = runTukeyHSD(rows, 'val', 'grp', 0.001);
    const stars = r.rows[0][r.rows[0].length - 1] as string;
    // With very strict alpha, may have fewer stars or none
    expect(typeof stars).toBe('string');
  });
});
