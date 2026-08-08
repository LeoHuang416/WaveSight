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
});

describe('generateId', () => {
  it('returns unique strings', () => {
    const a = generateId(), b = generateId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });
});
