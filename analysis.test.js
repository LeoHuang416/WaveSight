const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeNumbers } = require('./analysis');

test('ignores invalid and empty values (bug fix)', () => {
  const stats = analyzeNumbers('1, 2, x, , 3');
  assert.equal(stats.count, 3);
  assert.equal(stats.sum, 6);
  assert.equal(stats.average, 2);
});

test('supports semicolon and newline as separators (new feature)', () => {
  const stats = analyzeNumbers('10;20\n30');
  assert.equal(stats.count, 3);
  assert.equal(stats.median, 20);
});

test('returns empty result for no valid numbers', () => {
  const stats = analyzeNumbers('abc, , ???');
  assert.equal(stats.count, 0);
  assert.equal(stats.median, null);
});
