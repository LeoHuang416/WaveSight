/**
 * Export ECharts instance as PNG via data URL download.
 *
 * echarts-gl (3D) renders to a WebGL canvas that must be preserved at capture
 * time — force a synchronous re-render so `getDataURL` reads the current frame
 * instead of a cleared/blank buffer (P0-2).
 */
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportPNG(chartInstance: any, filename: string) {
  const zr = chartInstance?.getZr?.();
  try { zr?.refreshImmediately?.(); } catch { /* non-gl or unsupported */ }
  const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  downloadURL(url, `${filename}.png`);
}

/** Export chart as vector SVG via a temporary SVG-renderer instance */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportSVG(chartInstance: any, filename: string): boolean {
  try {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;height:600px;';
    document.body.appendChild(div);
    const svgChart = echarts.init(div, undefined, { renderer: 'svg' });
    svgChart.setOption(chartInstance.getOption());
    const svgStr = svgChart.renderToSVGString();
    svgChart.dispose();
    div.remove();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    downloadURL(URL.createObjectURL(blob), `${filename}.svg`);
    return true;
  } catch {
    return false;
  }
}

/** Export chart source data as CSV */
export function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  downloadURL(URL.createObjectURL(blob), `${filename}.csv`);
}

/** Export tabular data as Excel (.xlsx) via the bundled SheetJS library */
export function exportXLSX(headers: string[], rows: (string | number)[][], filename: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Download all app data as JSON backup */
export function exportAllDataJSON(data: unknown, filename = 'data-workbench-backup') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadURL(URL.createObjectURL(blob), `${filename}.json`);
}

/** Export all app data as a multi-sheet Excel workbook */
export function exportAllDataXLSX(data: { datasets: { name: string; columns: { name: string }[]; rows: Record<string, unknown>[] }[]; charts: { title: string; chartType: string }[]; history: object[] }, filename = 'data-workbench-export') {
  const wb = XLSX.utils.book_new();
  data.datasets.forEach((ds, i) => {
    const sheetName = `数据集${i + 1}`;
    const ws = XLSX.utils.aoa_to_sheet([
      ds.columns.map((c) => c.name),
      ...ds.rows.map((r) => ds.columns.map((c) => (r[c.name] ?? '') as string | number)),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  if (data.charts.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['标题', '类型'], ...data.charts.map((c) => [c.title, c.chartType])]), '图表');
  }
  if (data.history.length) {
    const headers = Object.keys(data.history[0] ?? {});
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...data.history.map((h) => headers.map((k) => (h[k as keyof typeof h] ?? '') as string | number))]), '历史记录');
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function downloadURL(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}
