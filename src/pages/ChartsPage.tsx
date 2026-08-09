import { useState } from 'react';
import { Card, Button, Input, Select, Space, Typography, Empty, Tag, Popconfirm, message, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import { useChartStore } from '@/stores/useChartStore';
import { useDataStore } from '@/stores/useDataStore';
import { exportPNG, exportCSV } from '@/utils/export';
import { generateId, formatNumber } from '@/utils/format';
import { buildContourOption } from '@/engine/rsmCharts';
import type { ChartConfig, ChartType, ColorScheme } from '@/types/chart';

const { Title, Text } = Typography;
const { Search } = Input;

const CHART_LABELS: Record<ChartType, string> = {
  bar: '柱状图', line: '折线图', scatter: '散点图', area: '面积图',
  boxplot: '箱线图', violin: '小提琴图', errorbar: '误差棒图', qq: 'Q-Q 图',
  heatmap: '热力图', contour: '等高线图', surface3d: '3D 曲面图', histogram: '直方图',
};

const GRAY = ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#d9d9d9', '#f0f0f0'];
const COLOR = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

function simpleOption(
  dataset: ReturnType<typeof useDataStore.getState>['currentDataset'],
  chartType: ChartType,
  title: string,
  colorScheme: ColorScheme,
  columnMapping?: Record<string, string>,
): Record<string, unknown> {
  const colors = colorScheme === 'grayscale' ? GRAY : COLOR;
  const base: Record<string, unknown> = { title: { text: title, left: 'center' }, color: colors, backgroundColor: '#fff' };
  if (!dataset) return base;
  const nums = dataset.columns.filter((c) => {
    if (c.type !== 'numeric') return false;
    if (c.role === 'metadata' || c.role === 'unknown') return false;
    if (c.name === dataset.experimentGroupCol) return false;
    // Exclude group-like columns: few unique numeric values → categorical, not a continuous axis
    const vals = dataset.rows.map((r) => Number(r[c.name])).filter((v) => !isNaN(v));
    const uniqueCount = new Set(vals).size;
    if (uniqueCount <= 10 && uniqueCount < vals.length * 0.5) return false;
    return true;
  }).map((c) => c.name);
  if (nums.length === 0) return base;
  const xCol = nums[0], yCol = nums[1] ?? nums[0];
  const xData = dataset.rows.map((r) => r[xCol]).slice(0, 30);
  const yVals = dataset.rows.map((r) => Number(r[yCol])).filter((v) => !isNaN(v)).slice(0, 200);
  const scatterData = dataset.rows.slice(0, 200).map((r) => [Number(r[xCol]), Number(r[yCol])]).filter((v: number[]) => !isNaN(v[0]) && !isNaN(v[1]));
  switch (chartType) {
    case 'bar': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: yVals }] };
    case 'line': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'line', data: yVals }] };
    case 'area': return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'line', areaStyle: {}, data: yVals }] };
    case 'scatter': return { ...base, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: scatterData }] };
    case 'histogram': {
      const histVals = dataset.rows.map((r) => Number(r[xCol])).filter((v) => !isNaN(v));
      if (histVals.length === 0) return { ...base, xAxis: {}, yAxis: {}, series: [{ type: 'bar', data: [] }] };
      const binCount = Math.min(20, Math.ceil(Math.sqrt(histVals.length)));
      const min = Math.min(...histVals), max = Math.max(...histVals);
      const binWidth = (max - min) / binCount || 1;
      const bins = Array(binCount).fill(0);
      histVals.forEach((v) => { const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1); bins[idx]++; });
      const binLabels = bins.map((_, i) => `${(min + i * binWidth).toFixed(1)}`);
      return { ...base, xAxis: { type: 'category', data: binLabels }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: bins, barCategoryGap: '5%' }] };
    }
    case 'boxplot': {
      const boxData = nums.slice(0, 5).map((col) => {
        const vals = dataset.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
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
      // Approximate violin as split density + boxplot overlay
      const violinCols = nums.slice(0, 4);
      const series: Record<string, unknown>[] = [];
      const allBins: { name: string; left: number[]; right: number[]; box: number[] }[] = [];
      violinCols.forEach((col) => {
        const vals = dataset.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
        if (vals.length < 4) return;
        const binCount = 20;
        const mn = vals[0], mx = vals[vals.length - 1];
        const bw = (mx - mn) / binCount || 1;
        const bins = Array(binCount).fill(0);
        vals.forEach((v) => { const idx = Math.min(Math.floor((v - mn) / bw), binCount - 1); bins[idx]++; });
        const maxBin = Math.max(...bins, 1);
        // Normalize for display
        const left = bins.map((c) => -c / maxBin * 0.5);
        const right = bins.map((c) => c / maxBin * 0.5);
        // Boxplot stats
        const q1 = vals[Math.floor(vals.length * 0.25)];
        const q2 = vals[Math.floor(vals.length * 0.5)];
        const q3 = vals[Math.floor(vals.length * 0.75)];
        allBins.push({ name: col, left, right, box: [q1, q2, q3] });
      });
      // Build a custom chart: area for density + scatter for box stats
      const grid: Record<string, unknown> = { left: 80, right: 20, top: 60, bottom: 40 };
      const xAxisVals: number[] = [];
      allBins.forEach((_, ci) => {
        for (let i = 0; i < 20; i++) xAxisVals.push(i + ci * 25);
      });
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
      // Q-Q plot: normal theoretical quantiles vs sample quantiles
      const qqCol = yCol;
      const qqVals = dataset.rows.map((r) => Number(r[qqCol])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
      if (qqVals.length < 5) return base;
      const n = qqVals.length;
      const mean = qqVals.reduce((a, b) => a + b, 0) / n;
      const std = Math.sqrt(qqVals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
      // Normal quantile function approximation
      const normQuantile = (p: number): number => {
        // Approximation of inverse normal CDF
        const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
        const sign = p < 0.5 ? -1 : 1;
        return sign * (t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
      };
      const qqData = qqVals.map((v, i) => {
        const p = (i + 0.5) / n;
        return [normQuantile(p) * std + mean, v];
      });
      // Reference line
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
    case 'heatmap': {
      // Heatmap: category x category grid
      const heatCols = nums.slice(0, 6);
      if (heatCols.length < 2) return { ...base, series: [{ type: 'bar', data: [] }] };
      // Build correlation-like heatmap between numeric columns
      const heatData: [number, number, number][] = [];
      heatCols.forEach((c1, i) => {
        heatCols.forEach((c2, j) => {
          const v1 = dataset.rows.map((r) => Number(r[c1])).filter((v) => !isNaN(v));
          const v2 = dataset.rows.map((r) => Number(r[c2])).filter((v) => !isNaN(v));
          // Pearson correlation
          const n = Math.min(v1.length, v2.length);
          if (n < 3) { heatData.push([j, i, 0]); return; }
          const m1 = v1.slice(0, n).reduce((a, b) => a + b, 0) / n;
          const m2 = v2.slice(0, n).reduce((a, b) => a + b, 0) / n;
          const s1 = Math.sqrt(v1.slice(0, n).reduce((s, v) => s + (v - m1) ** 2, 0) / n) || 1;
          const s2 = Math.sqrt(v2.slice(0, n).reduce((s, v) => s + (v - m2) ** 2, 0) / n) || 1;
          const cov = v1.slice(0, n).reduce((s, v, k) => s + (v - m1) * (v2[k] - m2), 0) / n;
          heatData.push([j, i, +(cov / (s1 * s2)).toFixed(3)]);
        });
      });
      const hmMax = Math.max(...heatData.map((d) => Math.abs(d[2])), 0.1);
      return {
        ...base,
        xAxis: { type: 'category', data: heatCols, position: 'top', axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'category', data: heatCols, inverse: true },
        visualMap: { min: -hmMax, max: hmMax, calculable: true, orient: 'vertical', right: 10,
          inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] } },
        series: [{ type: 'heatmap', data: heatData, label: { show: true, fontSize: 10 },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
      };
    }
    case 'errorbar': {
      // Error bar chart: bar with ±1 SD error bars
      const errCols = nums.slice(0, 5);
      const errMeans: number[] = [];
      const errSDs: number[] = [];
      errCols.forEach((col) => {
        const vals = dataset.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
        errMeans.push(+m.toFixed(2));
        errSDs.push(+sd.toFixed(2));
      });
      if (errMeans.length === 0) return { ...base, series: [{ type: 'bar', data: [] }] };
      // Error bar data: [yMin, yMax] for each column
      const errData = errMeans.map((m, i) => [m - errSDs[i], m + errSDs[i]]);
      return {
        ...base,
        xAxis: { type: 'category', data: errCols },
        yAxis: { type: 'value', name: '均值 ± 1 SD' },
        series: [
          { type: 'bar', data: errMeans, name: '均值', barWidth: '50%' },
          { type: 'custom', name: '误差棒', data: errData,
            renderItem: (_params: unknown, api: Record<string, CallableFunction>) => {
              const xValue = api.value(0);
              const yMin = api.value(0) - api.value(1); // This is tricky with custom renderer
              // Use a simpler approach with two scatter series
              return { type: 'group', children: [] };
            },
          },
        ],
      };
      // Simpler approach: use markPoint/markLine or a separate scatter series for error bars
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
    case 'contour': {
      // True RSM contour: 2D filled contour via polynomial fit + dense grid prediction + scatter overlay
      // Normalize columnMapping — values may be string or string[] (defensive)
      const getCol = (key: string, fallback: string): string => {
        const v = columnMapping?.[key];
        if (Array.isArray(v)) return String(v[0] || fallback);
        return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
      };
      const cx = getCol('xCol', nums[0]);
      const cy = getCol('yCol', nums[1] || nums[0]);
      const cz = getCol('zCol', nums[2] || nums[1] || nums[0]);
      if (cx === cy) return { ...base, title: { text: '错误：X轴和Y轴不能是同一变量', left: 'center', textStyle: { color: '#cf1322' } }, series: [{ type: 'scatter', data: [] }] };
      const cData = dataset.rows.slice(0, 500).map((r) => [Number(r[cx]), Number(r[cy]), Number(r[cz])] as [number, number, number]).filter((v) => !isNaN(v[0]) && !isNaN(v[1]) && !isNaN(v[2]));
      if (cData.length < 5) return { ...base, series: [{ type: 'scatter', data: [] }] };
      const xVals = cData.map((d) => d[0]), yVals = cData.map((d) => d[1]), zVals = cData.map((d) => d[2]);
      const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
      const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
      const n = cData.length;

      // 2nd-order polynomial: z = b0 + b1*x + b2*y + b3*x² + b4*y² + b5*xy
      // Inline Gaussian elimination (modeling.ts internals not exported)
      const p = 6;
      const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
      const Xtz: number[] = Array(p).fill(0);
      for (let k = 0; k < n; k++) {
        const row = [1, cData[k][0], cData[k][1], cData[k][0] ** 2, cData[k][1] ** 2, cData[k][0] * cData[k][1]];
        for (let i = 0; i < p; i++) {
          for (let j = 0; j < p; j++) XtX[i][j] += row[i] * row[j];
          Xtz[i] += row[i] * cData[k][2];
        }
      }
      const aug = XtX.map((row, i) => [...row, Xtz[i]]);
      for (let i = 0; i < p; i++) {
        let maxRow = i;
        for (let j = i + 1; j < p; j++) if (Math.abs(aug[j][i]) > Math.abs(aug[maxRow][i])) maxRow = j;
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
        if (Math.abs(aug[i][i]) < 1e-12) continue;
        for (let j = i + 1; j < p; j++) {
          const factor = aug[j][i] / aug[i][i];
          for (let k = i; k <= p; k++) aug[j][k] -= factor * aug[i][k];
        }
      }
      const beta: number[] = Array(p).fill(0);
      for (let i = p - 1; i >= 0; i--) {
        beta[i] = Math.abs(aug[i][i]) < 1e-12 ? 0 : (aug[i][p] - aug[i].slice(i + 1, p).reduce((s, v, j) => s + v * beta[i + 1 + j], 0)) / aug[i][i];
      }
      const predictZ = (x: number, y: number) => beta[0] + beta[1] * x + beta[2] * y + beta[3] * x * x + beta[4] * y * y + beta[5] * x * y;

      // R²
      const zMean = zVals.reduce((a, b) => a + b, 0) / n;
      const ssTot = zVals.reduce((s, zi) => s + (zi - zMean) ** 2, 0);
      const ssRes = cData.reduce((s, d) => { const e = d[2] - predictZ(d[0], d[1]); return s + e * e; }, 0);
      const r2 = 1 - ssRes / ssTot;

      // Dense prediction grid → 2D 数组；复用通用等高线构建器（真实等值线 + 数值标注 + 预测范围色标）
      const gridN = 60;
      const xStep = (xMax - xMin) / (gridN - 1) || 1;
      const yStep = (yMax - yMin) / (gridN - 1) || 1;
      const zGrid: number[][] = Array.from({ length: gridN }, () => Array(gridN).fill(NaN));
      for (let yi = 0; yi < gridN; yi++) {
        const yVal = yMin + yi * yStep;
        for (let xi = 0; xi < gridN; xi++) zGrid[yi][xi] = predictZ(xMin + xi * xStep, yVal);
      }
      return buildContourOption({
        zGrid, xMin, xMax, yMin, yMax, xStep, yStep,
        cx, cy, responseCol: cz,
        points: cData.map((d) => [d[0], d[1]]),
        title: `${title}  [R²=${r2.toFixed(3)}]`,
      });
    }
    case 'surface3d': {
      // 3D surface: X/Y form the plane, Z is the response height.
      const getCol3d = (key: string, fallback: string): string => {
        const v = columnMapping?.[key];
        if (Array.isArray(v)) return String(v[0] || fallback);
        return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
      };
      const sx = getCol3d('xCol', nums[0]);
      const sy = getCol3d('yCol', nums[1] || nums[0]);
      const sz = getCol3d('zCol', nums[2] || nums[1] || nums[0]);
      const sData = dataset.rows.slice(0, 500).map((r) => [Number(r[sx]), Number(r[sy]), Number(r[sz])]).filter((v) => !isNaN(v[0]) && !isNaN(v[1]) && !isNaN(v[2]));
      if (sData.length < 5) return { ...base, series: [{ type: 'bar', data: [] }] };
      const xVals = sData.map((d) => d[0]), yVals = sData.map((d) => d[1]);
      const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
      const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
      const gridSize = 25;
      const xStep = (xMax - xMin) / (gridSize - 1) || 1;
      const yStep = (yMax - yMin) / (gridSize - 1) || 1;

      // Bin (x, y, z) triples into grid, averaging z per cell
      const gridSum: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
      const gridCount: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
      sData.forEach(([x, y, z]) => {
        const xi = Math.min(Math.round((x - xMin) / xStep), gridSize - 1);
        const yi = Math.min(Math.round((y - yMin) / yStep), gridSize - 1);
        gridSum[yi][xi] += z;
        gridCount[yi][xi]++;
      });

      const zGrid: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(NaN));
      let filledCount = 0;
      for (let yi = 0; yi < gridSize; yi++) {
        for (let xi = 0; xi < gridSize; xi++) {
          if (gridCount[yi][xi] > 0) {
            zGrid[yi][xi] = gridSum[yi][xi] / gridCount[yi][xi];
            filledCount++;
          }
        }
      }
      if (filledCount < 3) return { ...base, series: [{ type: 'bar', data: [] }] };

      // Fill holes via nearest-neighbor smoothing
      for (let pass = 0; pass < 5; pass++) {
        let changed = false;
        for (let yi = 0; yi < gridSize; yi++) {
          for (let xi = 0; xi < gridSize; xi++) {
            if (!isNaN(zGrid[yi][xi])) continue;
            let sum = 0, cnt = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = xi + dx, ny = yi + dy;
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !isNaN(zGrid[ny][nx])) {
                  sum += zGrid[ny][nx]; cnt++;
                }
              }
            }
            if (cnt > 0) { zGrid[yi][xi] = sum / cnt; changed = true; }
          }
        }
        if (!changed) break;
      }

      // Build flat Row-Major array: y outer loop, x inner loop.
      // echarts-gl surface requires flat [x,y,z] triples, not nested arrays.
      const surfData: number[][] = [];
      let gridZMin = Infinity, gridZMax = -Infinity;
      for (let yi = 0; yi < gridSize; yi++) {
        const yVal = yMin + yi * yStep;
        for (let xi = 0; xi < gridSize; xi++) {
          const zVal = zGrid[yi][xi];
          if (!isNaN(zVal)) {
            if (zVal < gridZMin) gridZMin = zVal;
            if (zVal > gridZMax) gridZMax = zVal;
          }
          surfData.push([xMin + xi * xStep, yVal, isNaN(zVal) ? 0 : zVal]);
        }
      }
      if (gridZMin === Infinity) { gridZMin = 0; gridZMax = 1; }

      const zAxisMin = gridZMin - (gridZMax - gridZMin) * 0.05;

      return {
        ...base,
        backgroundColor: '#ffffff',
        title: { text: title, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
        tooltip: {},
        // 色标范围 = 曲面实际范围（与 RSM 3D 曲面一致，去掉 2% 裁剪避免误导）
        visualMap: { min: +gridZMin.toFixed(3), max: +gridZMax.toFixed(3), calculable: true, orient: 'vertical', right: 15, top: 60, bottom: 40,
          inRange: { color: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'] },
          text: [String(gridZMax.toFixed(1)), String(gridZMin.toFixed(1))], textStyle: { fontSize: 10, fontFamily: 'Times New Roman' },
          itemWidth: 14, itemHeight: 200,
        },
        xAxis3D: { type: 'value', name: sx, min: xMin, max: xMax, splitNumber: 4,
          axisLine: { lineStyle: { color: '#000' } },
          splitLine: { lineStyle: { color: '#e0e0e0' } },
          axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true },
          nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
        yAxis3D: { type: 'value', name: sy, min: yMin, max: yMax, splitNumber: 4,
          axisLine: { lineStyle: { color: '#000' } },
          splitLine: { lineStyle: { color: '#e0e0e0' } },
          axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true },
          nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
        zAxis3D: { type: 'value', name: sz, min: zAxisMin, max: gridZMax, splitNumber: 3,
          axisLine: { lineStyle: { color: '#000' } },
          splitLine: { lineStyle: { color: '#e0e0e0' } },
          axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true },
          nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
        grid3D: {
          environment: '#ffffff',
          viewControl: { autoRotate: false, alpha: 30, beta: -50, distance: 160,
            zoomSensitivity: 2, rotateSensitivity: 2 },
          boxWidth: 90, boxHeight: 90, boxDepth: 50,
          light: { main: { intensity: 1.2, shadow: true }, ambient: { intensity: 0.6 } },
        },
        series: [{
          type: 'surface',
          data: surfData,
          shading: 'realistic',
          realisticMaterial: { roughness: 0.3, metalness: 0.05 },
          itemStyle: { opacity: 0.95 },
          wireframe: { show: true, lineStyle: { color: '#cccccc', width: 0.5 } },
        }],
      };
    }
    default: return { ...base, xAxis: { type: 'category', data: xData }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: yVals }] };
  }
}

export default function ChartsPage() {
  const { charts, viewMode, editingChartId, setViewMode, setEditingChart, addChart, removeChart } = useChartStore();
  const currentDataset = useDataStore((s) => s.currentDataset);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChartType | 'all'>('all');
  const [echartsRef, setEchartsRef] = useState<ReactECharts | null>(null);
  const filtered = charts.filter((c) => (!search || c.title.includes(search)) && (typeFilter === 'all' || c.chartType === typeFilter));
  // 函数型 option（renderItem/formatter）无法持久化（存储时被剥离），读取时用图表配置重建
  const renderOption = (c: ChartConfig): Record<string, unknown> => {
    const needs = c.chartType === 'contour' || c.chartType === 'surface3d' || c.chartType === 'errorbar';
    if (needs && !c.sourceAnalysisId && currentDataset && c.datasetId === currentDataset.id) {
      try { return simpleOption(currentDataset, c.chartType, c.title, c.colorScheme, c.columnMapping as Record<string, string>); }
      catch { /* 重建失败则回退到存储的剥离版 option */ }
    }
    return c.echartsOption;
  };

  const handleNew = () => {
    if (!currentDataset) { message.warning('请先导入数据'); return; }
    const cfg: ChartConfig = {
      id: generateId(), title: '新建图表', chartType: 'bar', datasetId: currentDataset.id,
      columnMapping: {}, echartsOption: simpleOption(currentDataset, 'bar', '新建图表', 'grayscale'),
      colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12,
      xAxisLabel: '', yAxisLabel: '', createdAt: Date.now(),
    };
    addChart(cfg); setEditingChart(cfg.id);
  };

  if (viewMode === 'editor' && editingChartId) {
    const chart = charts.find((c) => c.id === editingChartId);
    if (!chart) { setViewMode('gallery'); return null; }
    return (
      <div style={{ padding: 24, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setViewMode('gallery')}>← 返回画廊</Button>
          <div className="glass-card" style={{ marginTop: 8, padding: 16, background: 'rgba(255,255,255,0.4)' }}>
            <ReactECharts ref={(e) => setEchartsRef(e as ReactECharts)} option={renderOption(chart)} style={{ height: 400, background: '#fff' }} notMerge />
          </div>
        </div>
        <div style={{ width: 220 }}>
          <Card className="glass-card" size="small" title="编辑图表" bodyStyle={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input addonBefore="标题" value={chart.title} onChange={(e) => addChart({ ...chart, title: e.target.value, echartsOption: { ...chart.echartsOption as Record<string, unknown>, title: { text: e.target.value, left: 'center' } } })} />
              <Select value={chart.chartType} style={{ width: '100%' }} onChange={(v: ChartType) => addChart({ ...chart, chartType: v, echartsOption: simpleOption(currentDataset, v, chart.title, chart.colorScheme, chart.columnMapping as Record<string, string>) })} options={Object.entries(CHART_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
              {(chart.chartType === 'surface3d' || chart.chartType === 'contour') && currentDataset && (
                <>
                  <Space style={{ width: '100%' }} direction="vertical" size={4}>
                    <Text style={{ fontSize: 12 }}>X 轴变量</Text>
                    <Select size="small" style={{ width: '100%' }} value={(chart.columnMapping as Record<string, string>)?.xCol ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[0]}
                      onChange={(v) => {
                        const cm = { ...chart.columnMapping as Record<string, string>, xCol: v };
                        addChart({ ...chart, columnMapping: cm, echartsOption: simpleOption(currentDataset, chart.chartType, chart.title, chart.colorScheme, cm) });
                      }}
                      options={currentDataset.columns.filter((c) => c.type === 'numeric' && c.role !== 'metadata' && c.role !== 'unknown').map((c) => ({ label: c.name, value: c.name }))} />
                  </Space>
                  <Space style={{ width: '100%' }} direction="vertical" size={4}>
                    <Text style={{ fontSize: 12 }}>Y 轴变量</Text>
                    <Select size="small" style={{ width: '100%' }} value={(chart.columnMapping as Record<string, string>)?.yCol ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[1] ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[0]}
                      onChange={(v) => {
                        const cm = { ...chart.columnMapping as Record<string, string>, yCol: v };
                        addChart({ ...chart, columnMapping: cm, echartsOption: simpleOption(currentDataset, chart.chartType, chart.title, chart.colorScheme, cm) });
                      }}
                      options={currentDataset.columns.filter((c) => c.type === 'numeric' && c.role !== 'metadata' && c.role !== 'unknown').map((c) => ({ label: c.name, value: c.name }))} />
                  </Space>
                  <Space style={{ width: '100%' }} direction="vertical" size={4}>
                    <Text style={{ fontSize: 12 }}>Z 轴变量（响应值）</Text>
                    <Select size="small" style={{ width: '100%' }} value={(chart.columnMapping as Record<string, string>)?.zCol ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[2] ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[1] ?? currentDataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name)[0]}
                      onChange={(v) => {
                        const cm = { ...chart.columnMapping as Record<string, string>, zCol: v };
                        addChart({ ...chart, columnMapping: cm, echartsOption: simpleOption(currentDataset, chart.chartType, chart.title, chart.colorScheme, cm) });
                      }}
                      options={currentDataset.columns.filter((c) => c.type === 'numeric' && c.role !== 'metadata' && c.role !== 'unknown').map((c) => ({ label: c.name, value: c.name }))} />
                  </Space>
                </>
              )}
              <Radio.Group value={chart.colorScheme} onChange={(e) => { const v = e.target.value as ColorScheme; addChart({ ...chart, colorScheme: v, echartsOption: simpleOption(currentDataset, chart.chartType, chart.title, v, chart.columnMapping as Record<string, string>) }); }}>
                <Radio value="grayscale">学术灰度</Radio><Radio value="color">彩色</Radio>
              </Radio.Group>
              <Button icon={<DownloadOutlined />} onClick={() => echartsRef && exportPNG(echartsRef.getEchartsInstance(), chart.title)} block>导出 PNG</Button>
              <Button icon={<DownloadOutlined />} onClick={() => { if (currentDataset) exportCSV(currentDataset.columns.map((c) => c.name), currentDataset.rows.map((r) => currentDataset.columns.map((c) => String(r[c.name] ?? ''))), chart.title); }} block>导出 CSV</Button>
              <Popconfirm title="确认删除?" onConfirm={() => { removeChart(chart.id); setViewMode('gallery'); }}><Button danger icon={<DeleteOutlined />} block>删除</Button></Popconfirm>
            </Space>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>实验图表</Title>
      <Space style={{ marginBottom: 16 }}><Search placeholder="搜索图表..." onSearch={setSearch} style={{ width: 200 }} /><Select value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }} options={[{ label: '全部', value: 'all' }, ...Object.entries(CHART_LABELS).map(([k, v]) => ({ label: v, value: k }))]} /><Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>新建图表</Button></Space>
      <div className="glass-card" style={{ padding: '24px 28px', background: 'rgba(255,255,255,0.4)' }}>
        {filtered.length === 0 ? <Empty description={charts.length === 0 ? '暂无图表，分析数据后保存图表或点击"新建图表"' : '无匹配结果'} /> :
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filtered.map((c) => (
              <Card key={c.id} className="glass-card" hoverable size="small" bodyStyle={{ padding: '16px' }} onClick={() => setEditingChart(c.id)}
                cover={<div style={{ height: 140, overflow: 'hidden' }}><ReactECharts option={renderOption(c)} style={{ height: 140 }} notMerge /></div>}>
                <Card.Meta title={c.title} description={<><Tag>{CHART_LABELS[c.chartType]}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString('zh-CN')}</Text></>} />
              </Card>
            ))}
          </div>}
      </div>
    </div>
  );
}
