import { mean, std, min, max, quantile, extractNumericColumn } from './utils';
import type { ResultTable } from '@/types/analysis';

// ── 1. Missing values diagnostic ────────────────────────────────────

export function runMissingDiagnostic(
  rows: Record<string, unknown>[],
  cols: string[],
): { table: ResultTable; missingCounts: Record<string, number> } {
  const headers = ['变量', '总数', '缺失数', '缺失率(%)', '状态'];
  const resultRows: (string | number)[][] = [];
  const missingCounts: Record<string, number> = {};

  for (const col of cols) {
    let missing = 0;
    for (const row of rows) {
      const v = row[col];
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) missing++;
    }
    const pct = (missing / rows.length) * 100;
    let status: string;
    if (missing === 0) status = '无缺失';
    else if (pct < 5) status = '可插补 (< 5%)';
    else status = '⚠ 缺失率偏高，建议确认';

    resultRows.push([col, rows.length, missing, +pct.toFixed(1), status]);
    missingCounts[col] = missing;
  }

  return {
    table: { title: '缺失值诊断', headers, rows: resultRows },
    missingCounts,
  };
}

// ── 2. Outlier detection (IQR × 1.5) + capping ──────────────────────

export function runOutlierDetection(
  rows: Record<string, unknown>[],
  cols: string[],
): { table: ResultTable; cappedRows: Record<string, unknown>[]; totalOutliers: number } {
  // Deep copy rows so we don't mutate the original
  const cappedRows: Record<string, unknown>[] = rows.map((r) => ({ ...r }));
  const headers = ['变量', '下界', '上界', '异常值数', '处理方式'];
  const resultRows: (string | number)[][] = [];
  let totalOutliers = 0;

  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    if (values.length < 4) {
      resultRows.push([col, '-', '-', 0, '样本量不足，跳过']);
      continue;
    }

    const Q1 = quantile(values, 0.25);
    const Q3 = quantile(values, 0.75);
    const IQR = Q3 - Q1;
    const lower = Q1 - 1.5 * IQR;
    const upper = Q3 + 1.5 * IQR;

    let nOutliers = 0;
    for (let i = 0; i < cappedRows.length; i++) {
      const raw = Number(cappedRows[i][col]);
      if (isNaN(raw)) continue;
      if (raw < lower) {
        cappedRows[i][col] = lower;
        nOutliers++;
      } else if (raw > upper) {
        cappedRows[i][col] = upper;
        nOutliers++;
      }
    }

    totalOutliers += nOutliers;
    resultRows.push([
      col,
      +lower.toPrecision(4),
      +upper.toPrecision(4),
      nOutliers,
      nOutliers > 0 ? '盖帽处理' : '无异常',
    ]);
  }

  return {
    table: {
      title: `异常值检测 (IQR × 1.5) — 共 ${totalOutliers} 个异常值，已盖帽`,
      headers,
      rows: resultRows,
    },
    cappedRows,
    totalOutliers,
  };
}

// ── 3. Z-score standardization ──────────────────────────────────────

export function runStandardization(
  rows: Record<string, unknown>[],
  cols: string[],
): { table: ResultTable; standardizedRows: Record<string, unknown>[] } {
  // Compute before stats
  const beforeMeans: number[] = [];
  const beforeStds: number[] = [];

  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    beforeMeans.push(values.length > 0 ? mean(values) : 0);
    beforeStds.push(values.length > 1 ? std(values) : 1);
  }

  // Deep copy and standardize
  const standardizedRows: Record<string, unknown>[] = rows.map((r) => ({ ...r }));

  for (let i = 0; i < standardizedRows.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      const col = cols[j];
      const raw = Number(standardizedRows[i][col]);
      if (!isNaN(raw) && beforeStds[j] > 0) {
        standardizedRows[i][col] = (raw - beforeMeans[j]) / beforeStds[j];
      } else {
        standardizedRows[i][col] = 0;
      }
    }
  }

  // Compute after stats (should be ~0 mean, ~1 std)
  const afterMeans: number[] = [];
  const afterStds: number[] = [];
  for (const col of cols) {
    const values = standardizedRows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    afterMeans.push(values.length > 0 ? mean(values) : 0);
    afterStds.push(values.length > 1 ? std(values) : 1);
  }

  // Build comparison table
  const headers = ['变量', '标准化前均值', '标准化前标准差', '标准化后均值', '标准化后标准差'];
  const resultRows: (string | number)[][] = cols.map((col, i) => [
    col,
    +beforeMeans[i].toPrecision(4),
    +beforeStds[i].toPrecision(4),
    +afterMeans[i].toPrecision(4),
    +afterStds[i].toPrecision(4),
  ]);

  return {
    table: {
      title: 'Z-score 标准化 (μ=0, σ=1)',
      headers,
      rows: resultRows,
    },
    standardizedRows,
  };
}
