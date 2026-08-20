/**
 * 共享图表构建引擎：图表模块与分析模块共用同一套绘制代码，保证两模块图完全一致。
 * - contour / surface3d / heatmap：与 RSM 分析模块一致（runRSM 拟合 + buildRsmCharts）
 * - 其余图表类型：保留图表模块原有实现（平移自 ChartsPage.simpleOption）
 */
import { runRSM } from './modeling';
import { buildRsmCharts } from './rsmCharts';
import { formatNumber } from '@/utils/format';
import type { ChartType, ColorScheme } from '@/types/chart';

export interface ChartBuildParams {
  rows: Record<string, unknown>[];
  /** 列元信息（name/type/role） */
  columns: { name: string; type: string; role?: string }[];
  experimentGroupCol?: string;
  chartType: ChartType;
  title: string;
  colorScheme: ColorScheme;
  columnMapping?: Record<string, string | string[]>;
}

const GRAY = ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#d9d9d9', '#f0f0f0'];
const COLOR = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

/** 选取可作连续轴/数值序列的列（排除 metadata/unknown/实验分组列/低基数数值列） */
export function selectNumericCols(rows: Record<string, unknown>[], columns: { name: string; type: string; role?: string }[], experimentGroupCol?: string): string[] {
  return columns.filter((c) => {
    if (c.type !== 'numeric') return false;
    if (c.role === 'metadata' || c.role === 'unknown') return false;
    if (c.name === experimentGroupCol) return false;
    const vals = rows.map((r) => Number(r[c.name])).filter((v) => !isNaN(v));
    const uniqueCount = new Set(vals).size;
    if (uniqueCount <= 10 && uniqueCount < vals.length * 0.5) return false;
    return true;
  }).map((c) => c.name);
}

/** 归一化 columnMapping 取值（string 或 string[]） */
function getCol(mapping: Record<string, string | string[]> | undefined, key: string, fallback: string): string {
  const v = mapping?.[key];
  if (Array.isArray(v)) return String(v[0] || fallback);
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

/** 构建 RSM 类图（等高线/3D曲面/热力图）：与分析模块完全一致（runRSM + buildRsmCharts） */
function buildRsmChartOption(
  rows: Record<string, unknown>[], numericCols: string[],
  chartType: ChartType, title: string, columnMapping?: Record<string, string | string[]>,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = { backgroundColor: '#fff', title: { text: title, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } } };
  const cx = getCol(columnMapping, 'xCol', numericCols[0] ?? '');
  const cy = getCol(columnMapping, 'yCol', numericCols[1] ?? numericCols[0] ?? '');
  const cz = getCol(columnMapping, 'zCol', numericCols[2] ?? numericCols[1] ?? numericCols[0] ?? '');
  if (!cx || !cy || !cz) return { ...base, series: [{ type: 'scatter', data: [] }] };
  if (cx === cy) return { ...base, title: { text: '错误：X轴和Y轴不能是同一变量', left: 'center', textStyle: { color: '#cf1322' } }, series: [{ type: 'scatter', data: [] }] };
  try {
    const rsm = runRSM(rows, [cx, cy], cz);
    const charts = buildRsmCharts(rsm, [cx, cy], cz, rows);
    const key = chartType === 'heatmap' ? 'heatmap' : chartType === 'surface3d' ? 'surface3d' : 'contour';
    const opt = charts[key];
    const r2suffix = `  [R²=${rsm.r2.toFixed(3)}]`;
    return {
      ...opt,
      title: { text: title.includes('R²') ? title : `${title}${r2suffix}`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    };
  } catch {
    return { ...base, series: [{ type: 'scatter', data: [] }] };
  }
}

/** 构建任意图表类型的 ECharts option（图表模块入口，分析模块 RSM 图同源） */
export function buildChartOption(p: ChartBuildParams): Record<string, unknown> {
  const { rows, columns, experimentGroupCol, chartType, title, colorScheme, columnMapping } = p;
  const colors = colorScheme === 'grayscale' ? GRAY : COLOR;
  const base: Record<string, unknown> = { title: { text: title, left: 'center' }, color: colors, backgroundColor: '#fff' };

  const nums = selectNumericCols(rows, columns, experimentGroupCol);
  if (nums.length === 0) return base;
  const xCol = nums[0], yCol = nums[1] ?? nums[0];
  const xData = rows.map((r) => r[xCol]).slice(0, 30);
  const yVals = rows.map((r) => Number(r[yCol])).filter((v) => !isNaN(v)).slice(0, 200);
  const scatterData = rows.slice(0, 200).map((r) => [Number(r[xCol]), Number(r[yCol])]).filter((v: number[]) => !isNaN(v[0]) && !isNaN(v[1]));

  // RSM 类图：与分析模块共用 buildRsmCharts
  if (chartType === 'contour' || chartType === 'surface3d' || chartType === 'heatmap') {
    return buildRsmChartOption(rows, nums, chartType, title, columnMapping) ?? base;
  }

  switch (chartType) {
    case 'bar': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: yVals }] };
    case 'line': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'line', data: yVals }] };
    case 'area': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'line', areaStyle: {}, data: yVals }] };
    case 'scatter': return { ...base, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: scatterData }] };
    case 'histogram': {
      const histVals = rows.map((r) => Number(r[xCol])).filter((v) => !isNaN(v));
      if (histVals.length === 0) return { ...base, xAxis: {}, yAxis: {}, series: [{ type: 'bar', data: [] }] };
      const binCount = Math.min(20, Math.ceil(Math.sqrt(histVals.length)));
      const min = Math.min(...histVals), max = Math.max(...histVals);
      const binWidth = (max - min) / binCount || 1;
      const bins = Array(binCount).fill(0);
      histVals.forEach((v) => { const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1); bins[idx]++; });
      const binLabels = bins.map((_, i) => `${(min + i * binWidth).toFixed(1)}`);
      const n = histVals.length;
      const kdeMean = histVals.reduce((a, b) => a + b, 0) / n;
      const kdeStd = Math.sqrt(histVals.reduce((s, v) => s + (v - kdeMean) ** 2, 0) / n) || (max - min) / 4 || 1;
      const h = 1.06 * kdeStd * Math.pow(n, -1 / 5);
      const steps = 50;
      const kdeData: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const x = min + ((max - min) * i) / steps;
        let sum = 0;
        for (const v of histVals) sum += Math.exp(-0.5 * ((x - v) / h) ** 2);
        kdeData.push([+((i * (binCount - 1)) / steps).toFixed(4), +(sum / (n * h * Math.sqrt(2 * Math.PI)) * n * binWidth).toFixed(3)]);
      }
      return {
        ...base,
        xAxis: [
          { type: 'category', data: binLabels },
          { type: 'value', min: -0.5, max: binCount - 0.5, show: false },
        ],
        yAxis: { type: 'value' },
        series: [
          { type: 'bar', data: bins, barCategoryGap: '5%' },
          { type: 'line', name: 'KDE', xAxisIndex: 1, data: kdeData, symbol: 'none', smooth: true, lineStyle: { color: '#d00', width: 2 } },
        ],
      };
    }
    case 'boxplot': {
      const boxData = nums.slice(0, 5).map((col) => {
        const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
        if (vals.length < 4) return [0, 0, 0, 0, 0];
        const q1 = vals[Math.floor(vals.length * 0.25)];
        const q2 = vals[Math.floor(vals.length * 0.5)];
        const q3 = vals[Math.floor(vals.length * 0.75)];
        const iqr = q3 - q1;
        const lower = Math.max(vals[0], q1 - 1.5 * iqr);
        const upper = Math.min(vals[vals.length - 1], q3 + 1.5 * iqr);
        return [lower, q1, q2, q3, upper];
      });
      return { ...base, xAxis: { type: 'category', data: nums.slice(0, 5) }, yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: boxData, itemStyle: { borderColor: colors?.[0] ?? '#1a1a1a' } }] };
    }
    case 'violin': {
      const violinCols = nums.slice(0, 4);
      const series: Record<string, unknown>[] = [];
      const allBins: { name: string; left: number[]; right: number[]; box: number[] }[] = [];
      violinCols.forEach((col) => {
        const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
        if (vals.length < 4) return;
        const binCount = 20;
        const mn = vals[0], mx = vals[vals.length - 1];
        const bw = (mx - mn) / binCount || 1;
        const bins = Array(binCount).fill(0);
        vals.forEach((v) => { const idx = Math.min(Math.floor((v - mn) / bw), binCount - 1); bins[idx]++; });
        const maxBin = Math.max(...bins, 1);
        const left = bins.map((c) => -c / maxBin * 0.5);
        const right = bins.map((c) => c / maxBin * 0.5);
        const q1 = vals[Math.floor(vals.length * 0.25)];
        const q2 = vals[Math.floor(vals.length * 0.5)];
        const q3 = vals[Math.floor(vals.length * 0.75)];
        allBins.push({ name: col, left, right, box: [q1, q2, q3] });
      });
      const grid: Record<string, unknown> = { left: 80, right: 20, top: 60, bottom: 40 };
      allBins.forEach((b, ci) => {
        const offset = ci * 25;
        series.push({
          type: 'bar', name: `${b.name} (密度)`, data: b.right.map((v, i) => [i + offset, v]),
          barWidth: '90%', itemStyle: { color: colors?.[ci % colors.length] ?? '#5470c6', opacity: 0.6 },
          xAxisIndex: 0, yAxisIndex: 0,
        });
        series.push({
          type: 'bar', name: `${b.name} (左)`, data: b.left.map((v, i) => [i + offset, v]),
          barWidth: '90%', itemStyle: { color: colors?.[ci % colors.length] ?? '#5470c6', opacity: 0.3 },
          xAxisIndex: 0, yAxisIndex: 0,
        });
      });
      return { ...base, grid, xAxis: { type: 'value', min: -1, max: allBins.length * 25 },
        yAxis: { type: 'value' }, series: series.length ? series : [{ type: 'bar', data: [] }] };
    }
    case 'qq': {
      const qqCol = yCol;
      const qqVals = rows.map((r) => Number(r[qqCol])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
      if (qqVals.length < 5) return base;
      const n = qqVals.length;
      const mean = qqVals.reduce((a, b) => a + b, 0) / n;
      const std = Math.sqrt(qqVals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
      const normQuantile = (p: number): number => {
        const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
        const sign = p < 0.5 ? -1 : 1;
        return sign * (t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
      };
      const qqData = qqVals.map((v, i) => {
        const p = (i + 0.5) / n;
        return [normQuantile(p) * std + mean, v];
      });
      const lineMin = Math.min(...qqData.map((d) => d[0]));
      const lineMax = Math.max(...qqData.map((d) => d[0]));
      return {
        ...base,
        xAxis: { type: 'value', name: '理论分位数' },
        yAxis: { type: 'value', name: '样本分位数' },
        series: [
          { type: 'scatter', data: qqData, symbolSize: 4, name: 'Q-Q' },
          { type: 'line', data: [[lineMin, lineMin], [lineMax, lineMax]], name: 'y=x',
            lineStyle: { color: '#ccc', type: 'dashed' as const }, symbol: 'none' as const },
        ],
      };
    }
    case 'errorbar': {
      const errCols = nums.slice(0, 5);
      const errMeans: number[] = [];
      const errSDs: number[] = [];
      errCols.forEach((col) => {
        const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
        errMeans.push(+m.toFixed(2));
        errSDs.push(+sd.toFixed(2));
      });
      if (errMeans.length === 0) return { ...base, series: [{ type: 'bar', data: [] }] };
      const errBarData = errCols.map((_col, i) => [errMeans[i], errSDs[i], i]);
      return {
        ...base,
        xAxis: { type: 'category', data: errCols },
        yAxis: { type: 'value', name: '均值 ± 1 SD' },
        series: [
          { type: 'bar', data: errMeans, name: '均值' },
          { type: 'scatter', data: errBarData.map((d) => [d[2], d[0] + d[1]]), symbolSize: 0,
            markLine: { silent: true, symbol: ['none', 'none'],
              data: errBarData.map((d, idx) => [
                { xAxis: idx, yAxis: d[0] - d[1] },
                { xAxis: idx, yAxis: d[0] + d[1] },
              ]).flat(),
              lineStyle: { color: colors?.[0] ?? '#1a1a1a', width: 2 },
            },
          },
        ],
      };
    }
    default: return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: yVals }] };
  }
}
