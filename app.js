(function () {
  const input = document.getElementById('numbers');
  const button = document.getElementById('analyzeBtn');
  const result = document.getElementById('result');

  function renderStats(stats) {
    if (stats.count === 0) {
      result.textContent = '请输入至少一个有效数字。';
      return;
    }

    result.innerHTML = `
      <div class="stat-grid">
        <p><strong>数量：</strong>${stats.count}</p>
        <p><strong>总和：</strong>${stats.sum}</p>
        <p><strong>平均值：</strong>${stats.average.toFixed(2)}</p>
        <p><strong>最小值：</strong>${stats.min}</p>
        <p><strong>最大值：</strong>${stats.max}</p>
        <p><strong>中位数：</strong>${stats.median}</p>
      </div>
    `;
  }

  button.addEventListener('click', function () {
    const stats = window.WaveSightAnalysis.analyzeNumbers(input.value);
    renderStats(stats);
  });
})();
