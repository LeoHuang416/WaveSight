import { describe, it, expect } from 'vitest';
import { formatNumber, formatPValue, generateId } from './format';

describe('formatNumber', () => {
  it('formats to 3 significant digits by default', () => {
    expect(formatNumber(1.23456)).toBe('1.23');
    expect(formatNumber(123.456)).toBe('123');
    expect(formatNumber(0.0012345)).toBe('0.00123');
  });
  it('handles zero', () => { expect(formatNumber(0)).toBe('0'); });
  it('handles NaN/Infinity', () => {
    expect(formatNumber(NaN)).toBe('NaN');
    expect(formatNumber(Infinity)).toBe('Infinity');
  });
});

describe('formatPValue', () => {
  it('marks p < 0.001 with ***', () => {
    expect(formatPValue(0.0005)).toContain('***');
  });
  it('marks p < 0.01 with **', () => {
    expect(formatPValue(0.005)).toContain('**');
  });
  it('marks p < 0.05 with *', () => {
    expect(formatPValue(0.03)).toContain('*');
  });
  it('no star for p >= 0.05', () => {
    const s = formatPValue(0.07);
    expect(s).not.toContain('*');
  });
  it('uses correct star hierarchy (*** before ** before *)', () => {
    // 0.0005 < 0.001 → ***
    expect(formatPValue(0.0005)).toContain('***');
    // 0.005 < 0.01 → ** (two stars only, note: '**' ⊂ '***' so check 'p < 0.01 **')
    expect(formatPValue(0.005)).toContain('p < 0.01 **');
    // 0.03 < 0.05 → * (one star, default alpha=0.05)
    expect(formatPValue(0.03)).toContain('p < 0.05 *');
    expect(formatPValue(0.03)).not.toContain('**');
  });
  it('respects custom alpha threshold for single star', () => {
    // alpha=0.01: 0.03 >= 0.01 → no stars
    expect(formatPValue(0.03, 0.01)).not.toContain('*');
    // alpha=0.01: 0.008 < 0.01 → single star
    expect(formatPValue(0.008, 0.01)).toContain('*');
    // alpha=0.01: 0.008 is NOT < 0.001 so no ***
    expect(formatPValue(0.008, 0.01)).not.toContain('***');
    // alpha=0.01: 0.008 IS < 0.01 so **
    expect(formatPValue(0.008, 0.01)).toContain('**');
  });
});

describe('generateId', () => {
  it('returns unique strings', () => {
    const a = generateId(), b = generateId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });
});
