(function (global) {
  function parseNumbers(input) {
    return String(input)
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  function analyzeNumbers(input) {
    const numbers = parseNumbers(input);

    if (numbers.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: null,
        max: null,
        median: null,
      };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((acc, value) => acc + value, 0);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    return {
      count: numbers.length,
      sum,
      average: sum / numbers.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median,
    };
  }

  const api = { analyzeNumbers };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.WaveSightAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
