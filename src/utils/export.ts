/**
 * Export ECharts instance as PNG via data URL download.
 *
 * echarts-gl (3D) renders to a WebGL canvas that must be preserved at capture
 * time — force a synchronous re-render so `getDataURL` reads the current frame
 * instead of a cleared/blank buffer (P0-2).
 *
 * 3D 曲面图导出修复（问题1）：
 * - echarts-gl 将 3D 场景绘制在独立的 WebGL canvas 上（叠加在 2D 主 canvas 之下），
 *   而 ECharts `getDataURL` 只捕获 2D 主 canvas（标题/图例），导致主体空白。
 * - 社区标准做法（StackOverflow 高赞 / kepler.gl）：初始化 WebGL 上下文时
 *   `preserveDrawingBuffer: true`（见 `patchWebGLContext`），导出时把
 *   两个 canvas 合成（GL 底层 + 2D 覆盖层）输出为一张 PNG。
 */
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

/** 让所有 WebGL 上下文保留绘制缓冲（echarts-gl 导出 PNG 的前提）。应用启动时调用一次。 */
export function patchWebGLContext(): void {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  const orig = proto.getContext;
  if (!orig || (orig as unknown as { __patched?: boolean }).__patched) return;
  (orig as unknown as { __patched?: boolean }).__patched = true;
  proto.getContext = function (this: HTMLCanvasElement, ...args: unknown[]): unknown {
    const type = String(args[0] ?? '');
    let attrs = (args[1] ?? {}) as Record<string, unknown>;
    if (type === 'webgl' || type === 'experimental-webgl') {
      attrs = { ...attrs, preserveDrawingBuffer: true };
    }
    return orig.apply(this, [type, attrs]);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportPNG(chartInstance: any, filename: string) {
  const zr = chartInstance?.getZr?.();
  try { zr?.refreshImmediately?.(); } catch { /* non-gl or unsupported */ }

  // 3D/GL 图：合成 GL canvas（底层）与 2D canvas（标题/图例/坐标轴覆盖层）
  const dom = chartInstance?.getDom?.();
  if (dom && typeof document !== 'undefined') {
    const canvases = Array.from(dom.querySelectorAll('canvas'));
    const glCanvas = canvases.find((cv) => {
      const ctx = (cv as HTMLCanvasElement).getContext('webgl') ?? (cv as HTMLCanvasElement).getContext('experimental-webgl');
      return !!ctx;
    });
    const mainCanvas = canvases[0];
    if (glCanvas && mainCanvas) {
      const w = (glCanvas as HTMLCanvasElement).width || 800;
      const h = (glCanvas as HTMLCanvasElement).height || 600;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        try { ctx.drawImage(glCanvas as HTMLCanvasElement, 0, 0, w, h); } catch { /* ignore */ }
        try { ctx.drawImage(mainCanvas as HTMLCanvasElement, 0, 0, w, h); } catch { /* ignore */ }
        downloadURL(out.toDataURL('image/png'), `${filename}.png`);
        return;
      }
    }
  }

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
