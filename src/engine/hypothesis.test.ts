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
});

describe('runTukeyHSD', () => {
  it('returns pairwise comparisons', () => {
    const r = runTukeyHSD(rows, 'val', 'grp');
    expect(r.rows).toHaveLength(1); // one pair: A vs B
  });
});
