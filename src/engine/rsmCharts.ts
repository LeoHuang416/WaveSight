import { formatNumber } from '@/utils/format';
import { mean, std } from './utils';
import type { RSMResult } from './modeling';

const VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
const GRID_N = 60;

// normal quantile (Beasley–Springer / Acklam style approximation of Φ⁻¹)
function normQuantile(p: number): number {
  if (p <= 0) return -10; if (p >= 1) return 10;
  const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
  const sign = p < 0.5 ? -1 : 1;
  return sign * (t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
}

/** 取“好看”的等值线步长（1/2/5×10ᵏ） */
function niceStep(range: number, target = 8): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / mag;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * mag;
}

/**
 * 在预测网格上提取 level 的等值线折线（marching squares）。
 * 返回若干条折线，每条为实际单位的 [x,y] 序列；闭合环首尾同点。
 */
function contourPolylines(
  zGrid: number[][], xMin: number, xMax: number, yMin: number, yMax: number, level: number,
): number[][][] {
  const nx = zGrid[0].length, ny = zGrid.length;
  const xStep = (xMax - xMin) / (nx - 1), yStep = (yMax - yMin) / (ny - 1);
  const interp = (za: number, zb: number, pa: number, pb: number): number => pa + ((level - za) / (zb - za)) * (pb - pa);
  const segs: [number[], number[]][] = [];
  for (let yi = 0; yi < ny - 1; yi++) for (let xi = 0; xi < nx - 1; xi++) {
    const zBL = zGrid[yi][xi], zBR = zGrid[yi][xi + 1], zTR = zGrid[yi + 1][xi + 1], zTL = zGrid[yi + 1][xi];
    const x0 = xMin + xi * xStep, x1 = x0 + xStep, y0 = yMin + yi * yStep, y1 = y0 + yStep;
    const pts: (number[] | null)[] = [
      (zBL - level) * (zBR - level) < 0 ? [interp(zBL, zBR, x0, x1), y0] : null,
      (zBR - level) * (zTR - level) < 0 ? [x1, interp(zBR, zTR, y0, y1)] : null,
      (zTL - level) * (zTR - level) < 0 ? [interp(zTL, zTR, x0, x1), y1] : null,
      (zTL - level) * (zBL - level) < 0 ? [x0, interp(zBL, zTL, y0, y1)] : null,
    ];
    const e = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    if (e.length === 2) segs.push([pts[e[0]]!, pts[e[1]]!]);
    else if (e.length === 4) { segs.push([pts[0]!, pts[1]!]); segs.push([pts[2]!, pts[3]!]); }
  }
  // 把共享端点的线段连成折线
  const key = (p: number[]): string => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const adj = new Map<string, number[]>();
  const add = (k: string, i: number) => { const a = adj.get(k); if (a) a.push(i); else adj.set(k, [i]); };
  segs.forEach((s, i) => { add(key(s[0]), i); add(key(s[1]), i); });
  const used = new Set<number>();
  const polys: number[][][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const line: number[][] = [segs[i][0].slice(), segs[i][1].slice()];
    for (;;) {
      const a = (adj.get(key(line[0])) ?? []).find((j) => !used.has(j));
      const b = (adj.get(key(line[line.length - 1])) ?? []).find((j) => !used.has(j));
      let grew = false;
      if (a !== undefined) { used.add(a); line.unshift(key(segs[a][0]) === key(line[0]) ? segs[a][1].slice() : segs[a][0].slice()); grew = true; }
      if (b !== undefined && b !== a) { used.add(b); line.push(key(segs[b][0]) === key(line[line.length - 1]) ? segs[b][1].slice() : segs[b][0].slice()); grew = true; }
      if (!grew) break;
    }
    const out: number[][] = [];
    for (const p of line) { const last = out[out.length - 1]; if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) out.push(p); }
    if (out.length > 1) polys.push(out);
  }
  return polys;
}

/**
 * 通用等高线图 option：值轴 + marching-squares 等值线 + 数值标注 + 填充背景。
 * 色标范围取域内预测值范围。RSM 与通用图表模块共用，保证两处外观一致。
 * ponytail: marching squares 用基本 saddle 连接（非渐近判据），光滑曲面上差异可忽略
 */
export function buildContourOption(inp: {
  zGrid: number[][];
  xMin: number; xMax: number; yMin: number; yMax: number;
  xStep: number; yStep: number;
  cx: string; cy: string; responseCol: string;
  points: number[][];
  centerPts?: number[][];
  title: string;
}): Record<string, unknown> {
  const { zGrid, xMin, xMax, yMin, yMax, xStep, yStep, cx, cy, responseCol, points, centerPts, title } = inp;
  const GRID_N = zGrid.length;
  const zVals = zGrid.flat().filter((v) => isFinite(v));
  const zMinPred = zVals.length ? Math.min(...zVals) : 0;
  const zMaxPred = zVals.length ? Math.max(...zVals) : 1;
  const contourStep = niceStep(Math.max(zMaxPred - zMinPred, 1e-9));
  const lvStart = Math.ceil(zMinPred / contourStep) * contourStep;
  const lvCount = Math.max(1, Math.floor((zMaxPred - lvStart) / contourStep) + 1);
  const lineSeries: { level: number; data: (number[] | null)[]; labelPt: number[] }[] = [];
  for (let i = 0; i < lvCount; i++) {
    const L = lvStart + i * contourStep;
    const polys = contourPolylines(zGrid, xMin, xMax, yMin, yMax, L);
    const data: (number[] | null)[] = [];
    for (const p of polys) { if (data.length) data.push(null); data.push(...p); }
    let labelPt: number[] = [(xMin + xMax) / 2, (yMin + yMax) / 2];
    let best = polys[0] ?? [];
    for (const p of polys) if (p.length > best.length) best = p;
    if (best.length) labelPt = best[Math.floor(best.length / 2)];
    lineSeries.push({ level: +L.toFixed(6), data, labelPt });
  }
  const bgData: number[][] = [];
  for (let yi = 0; yi < GRID_N; yi++) for (let xi = 0; xi < GRID_N; xi++) bgData.push([xMin + xi * xStep, yMin + yi * yStep, +zGrid[yi][xi].toFixed(5)]);
  const starSeries = (centerPts && centerPts.length) ? [{
    type: 'scatter', z: 6, silent: true, data: centerPts,
    symbol: 'path://M20,3L22.8,11.8L32,12.5L24.9,18.4L27.2,27L20,21.8L12.8,27L15.1,18.4L8,12.5L17.2,11.8Z',
    symbolSize: 16, itemStyle: { color: '#d00', borderColor: '#fff', borderWidth: 1.5 },
  }] : [];
  return {
    backgroundColor: '#fff',
    title: { text: title, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    tooltip: { formatter: (p: unknown) => { const v = (p as { value: number[] }).value; let s = `${cx}: ${formatNumber(v?.[0], 4)}<br/>${cy}: ${formatNumber(v?.[1], 4)}`; if (v?.[2] !== undefined && isFinite(v[2])) s += `<br/>${responseCol}: ${formatNumber(v[2], 4)}`; return s; } },
    grid: { left: 70, right: 85, top: 55, bottom: 60 },
    xAxis: { type: 'value', name: cx, nameLocation: 'middle', nameGap: 32, min: xMin, max: xMax, splitNumber: 6, axisLine: { lineStyle: { color: '#000' } }, axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' }, splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.12)', type: 'dashed' as const } } },
    yAxis: { type: 'value', name: cy, nameLocation: 'middle', nameGap: 48, min: yMin, max: yMax, splitNumber: 5, axisLine: { lineStyle: { color: '#000' } }, axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' }, splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.12)', type: 'dashed' as const } } },
    visualMap: { min: +zMinPred.toFixed(4), max: +zMaxPred.toFixed(4), dimension: 2, seriesIndex: 0, calculable: true, orient: 'vertical', right: 10, top: 60, bottom: 50, splitNumber: 6, inRange: { color: VIRIDIS }, text: [String(+zMaxPred.toFixed(1)), String(+zMinPred.toFixed(1))], textStyle: { fontSize: 10, fontFamily: 'Times New Roman' }, itemWidth: 14, itemHeight: 180 },
    series: [
      { type: 'custom', z: 1, clip: true, data: bgData, renderItem: (params: unknown, api: unknown) => {
          const a = api as { value: (i: number) => number; coord: (v: number[]) => number[]; visual: (k: string) => string };
          const x = a.value(0), y = a.value(1);
          if (!isFinite(x) || !isFinite(y)) return undefined;
          const p1 = a.coord([x - xStep / 2, y - yStep / 2]);
          const p2 = a.coord([x + xStep / 2, y + yStep / 2]);
          return { type: 'rect', shape: { x: p1[0] - 0.5, y: p1[1] - 0.5, width: p2[0] - p1[0] + 1, height: p2[1] - p1[1] + 1 }, style: { fill: a.visual('color') } };
        } },
      ...lineSeries.map((ls) => ({
        type: 'line', z: 2, silent: true, showSymbol: false, connectNulls: false, data: ls.data,
        lineStyle: { color: 'rgba(0,0,0,0.55)', width: 1.3 },
        // 等值线数值标注：markPoint 保证 label 可靠渲染（scatter+symbol:none 会丢标签）
        markPoint: { symbol: 'none', data: [{ coord: ls.labelPt, value: ls.level, label: { show: true, formatter: () => formatNumber(ls.level, 6), color: '#000', fontSize: 11, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 3, padding: [1, 5] } }] },
      })),
      { type: 'scatter', z: 5, silent: true, data: points, symbolSize: 6, itemStyle: { color: '#fff', borderColor: '#000', borderWidth: 1.5 } },
      ...starSeries,
    ],
  };
}

/**
 * 残差诊断图：残差正态概率图、残差 vs 拟合值、Cook 距离。
 * 输入为 runRSM 返回的 fitted / residuals / cooksD。
 */
export function buildRsmDiagnostics(rsm: RSMResult): {
  qq: Record<string, unknown>; residFit: Record<string, unknown>; cooksD: Record<string, unknown>;
} {
  const n = rsm.residuals.length;
  const empty = (title: string): Record<string, unknown> => ({ backgroundColor: '#fff', title: { text: title, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } }, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: [] }] });
  if (n < 3) return { qq: empty('残差正态概率图'), residFit: empty('残差 vs 拟合值'), cooksD: empty('Cook 距离') };

  const resid = rsm.residuals;
  const fitted = rsm.fitted;
  const rm = mean(resid), rs = std(resid) || 1;
  const sorted = [...resid].sort((a, b) => a - b);
  const qqData = sorted.map((v, i) => [+(normQuantile((i + 0.5) / n) * rs + rm).toFixed(5), +v.toFixed(5)]);

  const qq: Record<string, unknown> = {
    backgroundColor: '#fff',
    title: { text: '残差正态概率图', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    tooltip: {},
    grid: { left: 60, right: 30, top: 50, bottom: 45 },
    xAxis: { type: 'value', name: '理论分位数', axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontFamily: 'Times New Roman' } },
    yAxis: { type: 'value', name: '残差分位数', axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontFamily: 'Times New Roman' } },
    series: [
      { type: 'scatter', data: qqData, symbolSize: 5, itemStyle: { color: '#5470c6' } },
      { type: 'line', data: [[qqData[0][0], qqData[0][1]], [qqData[qqData.length - 1][0], qqData[qqData.length - 1][1]]], symbol: 'none', lineStyle: { color: '#ccc', type: 'dashed' as const } },
    ],
  };

  const residFitData = fitted.map((f, i) => [+(+f).toFixed(5), +(+resid[i]).toFixed(5)]);
  const residFit: Record<string, unknown> = {
    backgroundColor: '#fff',
    title: { text: '残差 vs 拟合值', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    tooltip: {},
    grid: { left: 60, right: 30, top: 50, bottom: 45 },
    xAxis: { type: 'value', name: '拟合值', axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontFamily: 'Times New Roman' } },
    yAxis: { type: 'value', name: '残差', axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontFamily: 'Times New Roman' } },
    series: [
      { type: 'scatter', data: residFitData, symbolSize: 5, itemStyle: { color: '#91cc75' } },
      { type: 'line', data: [[Math.min(...fitted), 0], [Math.max(...fitted), 0]], symbol: 'none', lineStyle: { color: '#ccc', type: 'dashed' as const } },
    ],
  };

  const cookData = rsm.cooksD.map((d, i) => [i + 1, +(+d).toFixed(5)]);
  const threshold = 4 / n;
  const cooksD: Record<string, unknown> = {
    backgroundColor: '#fff',
    title: { text: 'Cook 距离', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    tooltip: {},
    grid: { left: 60, right: 30, top: 50, bottom: 45 },
    xAxis: { type: 'value', name: '观测序号', nameTextStyle: { fontFamily: 'Times New Roman' } },
    yAxis: { type: 'value', name: "Cook's D", axisLabel: { formatter: (v: number) => formatNumber(v, 3) }, nameTextStyle: { fontFamily: 'Times New Roman' } },
    series: [
      { type: 'bar', data: cookData, itemStyle: { color: '#5470c6' } },
      { type: 'line', data: [[0, threshold], [n, threshold]], symbol: 'none', lineStyle: { color: '#d00', type: 'dashed' as const } },
    ],
  };

  return { qq, residFit, cooksD };
}

interface Triplet { x: number; y: number; z: number; }

function extractTriplets(rows: Record<string, unknown>[], xCol: string, yCol: string, zCol: string): Triplet[] {
  return rows
    .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]), z: Number(r[zCol]) }))
    .filter((t) => isFinite(t.x) && isFinite(t.y) && isFinite(t.z));
}

function predictFor(rsm: RSMResult, x: number, y: number): number {
  // coded: X=(x-center)/half for the two displayed factors; hold any 3rd factor at center → coded 0
  const c = Array(rsm.center.length).fill(0);
  c[0] = (x - rsm.center[0]) / rsm.halfRange[0];
  c[1] = (y - rsm.center[1]) / rsm.halfRange[1];
  return rsm.predictCoded(c);
}

/**
 * Build real ECharts options for the three RSM charts from the fitted model.
 * X/Y = factorCols[0]/[1]; Z = response. Uses model prediction (smooth surface),
 * colorbar clipped to observed response range. Experiment points overlaid.
 */
export function buildRsmCharts(
  rsm: RSMResult, factorCols: string[], responseCol: string, rows: Record<string, unknown>[],
): { surface3d: Record<string, unknown>; contour: Record<string, unknown>; heatmap: Record<string, unknown> } {
  const cx = factorCols[0], cy = factorCols[1];
  const triples = extractTriplets(rows, cx, cy, responseCol);
  const empty = (name: string): Record<string, unknown> => ({ backgroundColor: '#fff', title: { text: name, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } }, series: [{ type: 'bar', data: [] }] });
  if (triples.length < 4) return { surface3d: empty('3D 响应面'), contour: empty('等高线图'), heatmap: empty('响应面热力图') };

  const xVals = triples.map((t) => t.x), yVals = triples.map((t) => t.y);
  const zVals = triples.map((t) => t.z);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  const zMin = Math.min(...zVals), zMax = Math.max(...zVals);

  // dense predicted grid (row-major: y outer, x inner)
  const xStep = (xMax - xMin) / (GRID_N - 1) || 1;
  const yStep = (yMax - yMin) / (GRID_N - 1) || 1;
  const zGrid: number[][] = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(NaN));
  for (let yi = 0; yi < GRID_N; yi++) for (let xi = 0; xi < GRID_N; xi++) zGrid[yi][xi] = predictFor(rsm, xMin + xi * xStep, yMin + yi * yStep);
  // 色标范围取域内模型预测值范围（而非观测值），避免色标浪费在不存在的深色区域
  const predVals = zGrid.flat().filter((v) => isFinite(v));
  const zMinPred = predVals.length ? Math.min(...predVals) : zMin;
  const zMaxPred = predVals.length ? Math.max(...predVals) : zMax;

  // ── surface3d ──
  const gridSize = 30;
  const sStepX = (xMax - xMin) / (gridSize - 1) || 1;
  const sStepY = (yMax - yMin) / (gridSize - 1) || 1;
  const surfData: number[][] = [];
  let gZMin = Infinity, gZMax = -Infinity;
  for (let yi = 0; yi < gridSize; yi++) for (let xi = 0; xi < gridSize; xi++) {
    const z = predictFor(rsm, xMin + xi * sStepX, yMin + yi * sStepY);
    if (z < gZMin) gZMin = z;
    if (z > gZMax) gZMax = z;
    surfData.push([xMin + xi * sStepX, yMin + yi * sStepY, z]);
  }
  const surface3d: Record<string, unknown> = {
    backgroundColor: '#fff',
    title: { text: `3D 响应面  [R²=${rsm.r2.toFixed(3)}]`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    visualMap: { min: +zMinPred.toFixed(4), max: +zMaxPred.toFixed(4), calculable: true, orient: 'vertical', right: 15, top: 60, bottom: 40,
      inRange: { color: VIRIDIS }, text: [String(+zMaxPred.toFixed(1)), String(+zMinPred.toFixed(1))], textStyle: { fontSize: 10, fontFamily: 'Times New Roman' }, itemWidth: 14, itemHeight: 200 },
    xAxis3D: { type: 'value', name: cx, min: xMin, max: xMax, splitNumber: 4, axisLine: { lineStyle: { color: '#000' } }, splitLine: { lineStyle: { color: '#e0e0e0' } }, axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true }, nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
    yAxis3D: { type: 'value', name: cy, min: yMin, max: yMax, splitNumber: 4, axisLine: { lineStyle: { color: '#000' } }, splitLine: { lineStyle: { color: '#e0e0e0' } }, axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true }, nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
    zAxis3D: { type: 'value', name: responseCol, min: +(zMin - (zMax - zMin) * 0.05).toFixed(4), max: +zMax.toFixed(4), splitNumber: 3, axisLine: { lineStyle: { color: '#000' } }, splitLine: { lineStyle: { color: '#e0e0e0' } }, axisLabel: { formatter: (v: number) => formatNumber(v, 3), hideOverlap: true }, nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' } },
    grid3D: { environment: '#fff', viewControl: { autoRotate: false, alpha: 30, beta: -50, distance: 160, zoomSensitivity: 2, rotateSensitivity: 2 }, boxWidth: 90, boxHeight: 90, boxDepth: 50, light: { main: { intensity: 1.2, shadow: true }, ambient: { intensity: 0.6 } } },
    series: [{ type: 'surface', data: surfData, shading: 'realistic', realisticMaterial: { roughness: 0.3, metalness: 0.05 }, itemStyle: { opacity: 0.95 }, wireframe: { show: true, lineStyle: { color: '#cccccc', width: 0.5 } } }],
  };

  // ── 热力图：分类轴 + 指数坐标，仅颜色填充（无线条无标注；等高线另画）──
  const xLabels = Array.from({ length: GRID_N }, (_, i) => formatNumber(xMin + i * xStep, 3));
  const yLabels = Array.from({ length: GRID_N }, (_, i) => formatNumber(yMin + i * yStep, 3));
  const predGrid: [number, number, number][] = [];
  for (let yi = 0; yi < GRID_N; yi++) for (let xi = 0; xi < GRID_N; xi++) predGrid.push([xi, yi, +zGrid[yi][xi].toFixed(5)]);

  const toIndex = (v: number, min: number, step: number) => Math.max(0, Math.min(GRID_N - 1, Math.round((v - min) / step)));
  const isCenter = (t: Triplet): boolean => {
    // center point: both displayed factors at coded ≈ 0 (design center)
    const cxv = (t.x - rsm.center[0]) / rsm.halfRange[0];
    const cyv = (t.y - rsm.center[1]) / rsm.halfRange[1];
    return Math.abs(cxv) < 0.05 && Math.abs(cyv) < 0.05;
  };
  const centerPts: [number, number][] = [];
  const outerPts: [number, number][] = [];
  triples.forEach((t) => {
    const p: [number, number] = [toIndex(t.x, xMin, xStep), toIndex(t.y, yMin, yStep)];
    if (isCenter(t)) centerPts.push(p); else outerPts.push(p);
  });

  const nLevels = 10;
  const labelInterval = Math.max(0, Math.floor(GRID_N / 8) - 1);
  const gridCommon = { left: 70, right: 85, top: 50, bottom: 70 };
  const axisCommon = (name: string, nameGap: number, data: string[], rotate: number) => ({
    type: 'category' as const, data, name, nameLocation: 'center' as const, nameGap,
    axisLine: { lineStyle: { color: '#000', width: 1 } }, axisLabel: { fontSize: 11, rotate, interval: labelInterval },
    nameTextStyle: { fontSize: 12, fontFamily: 'Times New Roman' }, splitLine: { show: true, lineStyle: { color: '#e0e0e0', type: 'dashed' as const } },
  });
  const visualCommon = {
    min: +zMinPred.toFixed(4), max: +zMaxPred.toFixed(4), calculable: true, orient: 'vertical' as const, right: 10, top: 60, bottom: 50, splitNumber: nLevels,
    inRange: { color: VIRIDIS }, text: [String(+zMaxPred.toFixed(1)), String(+zMinPred.toFixed(1))], textStyle: { fontSize: 10, fontFamily: 'Times New Roman' }, itemWidth: 14, itemHeight: 180,
  };
  const tooltip = { formatter: (p: unknown) => { const v = (p as { value: number[] }).value; return `${cx}: ${xLabels[v?.[0]]}<br/>${cy}: ${yLabels[v?.[1]]}<br/>${responseCol}: ${v?.[2]}`; } };

  const heatmap: Record<string, unknown> = {
    backgroundColor: '#fff',
    title: { text: `响应面热力图  [R²=${rsm.r2.toFixed(3)}]`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
    tooltip,
    grid: gridCommon,
    xAxis: axisCommon(cx, 35, xLabels, 45),
    yAxis: axisCommon(cy, 45, yLabels, 0),
    visualMap: visualCommon,
    series: [
      { type: 'heatmap', data: predGrid, itemStyle: { borderWidth: 0 }, emphasis: { disabled: true } },
      { type: 'scatter', data: outerPts, symbolSize: 6, itemStyle: { color: '#fff', borderColor: '#000', borderWidth: 1.5, opacity: 0.9 }, z: 10 },
      ...(centerPts.length ? [{ type: 'scatter', data: centerPts, symbol: 'X' as const, symbolSize: 11, itemStyle: { color: '#d00' }, z: 11 }] : []),
    ],
  };

  // ── 等高线图：复用通用 buildContourOption（值轴 + marching-squares 等值线 + 标注 + 预测范围色标）──
  const contour = buildContourOption({
    zGrid, xMin, xMax, yMin, yMax, xStep, yStep, cx, cy, responseCol,
    points: triples.map((t) => [t.x, t.y]),
    centerPts: triples.filter(isCenter).map((t) => [t.x, t.y]),
    title: `等高线图  [R²=${rsm.r2.toFixed(3)}]`,
  });

  return { surface3d, contour, heatmap };
}
