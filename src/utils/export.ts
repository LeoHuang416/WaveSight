/**
 * Export ECharts instance as PNG via data URL download.
 *
 * echarts-gl (3D) renders to a WebGL canvas that must be preserved at capture
 * time — force a synchronous re-render so `getDataURL` reads the current frame
 * instead of a cleared/blank buffer (P0-2).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportPNG(chartInstance: any, filename: string) {
  const zr = chartInstance?.getZr?.();
  try { zr?.refreshImmediately?.(); } catch { /* non-gl or unsupported */ }
  const url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  downloadURL(url, `${filename}.png`);
}

/** Export chart source data as CSV */
export function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  downloadURL(URL.createObjectURL(blob), `${filename}.csv`);
}

/** Download all app data as JSON backup */
export function exportAllDataJSON(data: unknown, filename = 'data-workbench-backup') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadURL(URL.createObjectURL(blob), `${filename}.json`);
}

function downloadURL(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}
