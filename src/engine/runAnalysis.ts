/**
 * 分析计算核心：从 AnalysisPage.run 提取的纯计算逻辑（无 UI 依赖，可单测）。
 * 每个分析会话调用一次，返回结果表/结论/图表数据/RSM 对象。
 */
import { runDescriptive, runFrequency, runNormality, runGroupedStats } from './descriptive';
import { runIndependentTTest, runPairedTTest, runOneWayANOVA, runTukeyHSD } from './hypothesis';
import { runCorrelation, runLinearRegression, runNonlinearFit, runRSM, runPCA, type RSMResult } from './modeling';
import { buildRsmCharts, buildRsmDiagnostics } from './rsmCharts';
import { runMissingDiagnostic, runOutlierDetection, runStandardization } from './preprocessing';
import { extractByGroup, variance } from './utils';
import type { AnalysisType, ResultTable, ChartDataSource } from '@/types/analysis';

export interface AnalysisInput {
  analysisType: AnalysisType;
  rows: Record<string, unknown>[];
  alpha: number;
  numericCols: string[];
  valueCols: string[];
  groupCol?: string;
  xCols: string[];
  yCol?: string;
  factorCols: string[];
  responseCol?: string;
  pairedCol1?: string;
  pairedCol2?: string;
  corrMethod: string;
  modelName: string;
  pipelineModels: string[];
}

export interface AnalysisResultData {
  tables: ResultTable[];
  conclusion: string;
  chartData?: ChartDataSource[];
  rsm?: RSMResult;
}

export function computeAnalysis(input: AnalysisInput): AnalysisResultData {
  const {
    analysisType, rows, alpha, numericCols,
    valueCols, groupCol, xCols, yCol, factorCols, responseCol,
    pairedCol1, pairedCol2, corrMethod, modelName, pipelineModels,
  } = input;
  let result: AnalysisResultData = { tables: [], conclusion: '' };

  switch (analysisType) {
    case 'descriptive':
      result = { tables: [runDescriptive(rows, valueCols.length ? valueCols : numericCols)], conclusion: '' };
      break;
    case 'frequency': {
      const col = valueCols[0];
      if (col) result = { tables: [runFrequency(rows, col)], conclusion: '' };
      break;
    }
    case 'normality': {
      const r = runNormality(rows, valueCols.length ? valueCols : numericCols, alpha);
      const chartData = Object.entries(r.qqData).map(([col, d]) => ({
        chartType: 'qq',
        title: `Q-Q 图: ${col}`,
        data: {
          backgroundColor: '#fff',
          title: { text: `Q-Q 图: ${col}`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
          tooltip: {},
          grid: { left: 60, right: 30, top: 45, bottom: 45 },
          xAxis: { type: 'value', name: '理论分位数', nameTextStyle: { fontFamily: 'Times New Roman' } },
          yAxis: { type: 'value', name: '样本分位数', nameTextStyle: { fontFamily: 'Times New Roman' } },
          series: [
            { type: 'scatter', data: d.theoretical.map((th, i) => [+th.toFixed(5), +d.sample[i].toFixed(5)]), symbolSize: 5, itemStyle: { color: '#5470c6' } },
            { type: 'line', data: [[d.theoretical[0], d.theoretical[0]], [d.theoretical[d.theoretical.length - 1], d.theoretical[d.theoretical.length - 1]]], symbol: 'none', lineStyle: { color: '#ccc', type: 'dashed' as const } },
          ],
        },
      }));
      result = { tables: [r.table], conclusion: '', chartData };
      break;
    }
    case 'grouped-stats':
      if (groupCol) result = { tables: [runGroupedStats(rows, valueCols.length ? valueCols : numericCols, groupCol)], conclusion: '' };
      break;
    case 'ttest-independent': {
      if (valueCols[0] && groupCol) {
        const r = runIndependentTTest(rows, valueCols[0], groupCol, alpha);
        const groups = [...new Set(rows.map((row) => String(row[groupCol] ?? '')))].filter((g) => g !== '');
        const boxData = groups.map((g) => {
          const vals = rows.filter((row) => String(row[groupCol]) === g).map((row) => Number(row[valueCols[0]])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
          if (vals.length < 4) return [0, 0, 0, 0, 0];
          const q1 = vals[Math.floor(vals.length * 0.25)], q2 = vals[Math.floor(vals.length * 0.5)], q3 = vals[Math.floor(vals.length * 0.75)];
          const iqr = q3 - q1;
          return [Math.max(vals[0], q1 - 1.5 * iqr), q1, q2, q3, Math.min(vals[vals.length - 1], q3 + 1.5 * iqr)];
        });
        result = {
          tables: [r.table], conclusion: r.conclusion,
          chartData: [{
            chartType: 'boxplot', title: `${valueCols[0]} 按 ${groupCol}`,
            data: {
              backgroundColor: '#fff',
              title: { text: `${valueCols[0]} 按 ${groupCol}`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
              tooltip: {},
              grid: { left: 60, right: 30, top: 45, bottom: 45 },
              xAxis: { type: 'category', data: groups, name: groupCol, nameTextStyle: { fontFamily: 'Times New Roman' } },
              yAxis: { type: 'value', name: valueCols[0], nameTextStyle: { fontFamily: 'Times New Roman' } },
              series: [{ type: 'boxplot', data: boxData, itemStyle: { borderColor: '#5470c6' } }],
            },
          }],
        };
      }
      break;
    }
    case 'ttest-paired': {
      if (pairedCol1 && pairedCol2) {
        const r = runPairedTTest(rows, pairedCol1, pairedCol2, alpha);
        result = { tables: [r.table], conclusion: r.conclusion };
      }
      break;
    }
    case 'anova-oneway': {
      if (valueCols[0] && groupCol) {
        const r = runOneWayANOVA(rows, valueCols[0], groupCol, alpha);
        const tukey = runTukeyHSD(rows, valueCols[0], groupCol, alpha);
        const groups = [...new Set(rows.map((row) => String(row[groupCol] ?? '')))].filter((g) => g !== '');
        const boxData = groups.map((g) => {
          const vals = rows.filter((row) => String(row[groupCol]) === g).map((row) => Number(row[valueCols[0]])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
          if (vals.length < 4) return [0, 0, 0, 0, 0];
          const q1 = vals[Math.floor(vals.length * 0.25)], q2 = vals[Math.floor(vals.length * 0.5)], q3 = vals[Math.floor(vals.length * 0.75)];
          const iqr = q3 - q1;
          return [Math.max(vals[0], q1 - 1.5 * iqr), q1, q2, q3, Math.min(vals[vals.length - 1], q3 + 1.5 * iqr)];
        });
        result = {
          tables: [r.table, tukey], conclusion: r.conclusion,
          chartData: [{
            chartType: 'boxplot', title: `ANOVA: ${valueCols[0]}`,
            data: {
              backgroundColor: '#fff',
              title: { text: `ANOVA: ${valueCols[0]}`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
              tooltip: {},
              grid: { left: 60, right: 30, top: 45, bottom: 45 },
              xAxis: { type: 'category', data: groups, name: groupCol, nameTextStyle: { fontFamily: 'Times New Roman' } },
              yAxis: { type: 'value', name: valueCols[0], nameTextStyle: { fontFamily: 'Times New Roman' } },
              series: [{ type: 'boxplot', data: boxData, itemStyle: { borderColor: '#5470c6' } }],
            },
          }],
        };
      }
      break;
    }
    case 'correlation': {
      const r = runCorrelation(rows, valueCols.length ? valueCols : numericCols, corrMethod);
      const corrCols = valueCols.length ? valueCols : numericCols;
      const hmData: [number, number, number][] = [];
      r.matrix.forEach((rowV, i) => rowV.forEach((v, j) => hmData.push([j, i, v])));
      const hmMax = Math.max(...hmData.map((d) => Math.abs(d[2])), 0.1);
      result = {
        tables: [r.table], conclusion: '',
        chartData: [{
          chartType: 'heatmap', title: `${corrMethod} 相关矩阵`,
          data: {
            backgroundColor: '#fff',
            title: { text: `${corrMethod} 相关矩阵`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
            tooltip: {},
            grid: { left: 90, right: 80, top: 30, bottom: 45 },
            xAxis: { type: 'category', data: corrCols, position: 'top', axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: 'category', data: corrCols, inverse: true },
            visualMap: { min: -hmMax, max: hmMax, calculable: true, orient: 'vertical', right: 10,
              inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] } },
            series: [{ type: 'heatmap', data: hmData, label: { show: true, fontSize: 10 } }],
          },
        }],
      };
      break;
    }
    case 'linear-regression': {
      if (xCols.length && yCol) {
        const r = runLinearRegression(rows, xCols, yCol);
        const residData = r.fittedValues.map((f, i) => [+(+f).toFixed(5), +(+r.residuals[i]).toFixed(5)]);
        const fitMin = Math.min(...r.fittedValues), fitMax = Math.max(...r.fittedValues);
        const residOption = {
          backgroundColor: '#fff',
          title: { text: `${yCol} 残差诊断图`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
          tooltip: {},
          grid: { left: 60, right: 30, top: 50, bottom: 45 },
          xAxis: { type: 'value', name: '拟合值', nameTextStyle: { fontFamily: 'Times New Roman' } },
          yAxis: { type: 'value', name: '残差', nameTextStyle: { fontFamily: 'Times New Roman' } },
          series: [
            { type: 'scatter', data: residData, symbolSize: 5, itemStyle: { color: '#91cc75' } },
            { type: 'line', data: [[fitMin, 0], [fitMax, 0]], symbol: 'none', lineStyle: { color: '#ccc', type: 'dashed' as const } },
          ],
        };
        result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'scatter', title: `${yCol} 残差诊断图`, data: residOption }] };
      }
      break;
    }
    case 'nonlinear-fit': {
      if (xCols[0] && yCol) {
        const r = runNonlinearFit(rows, xCols[0], yCol, modelName);
        const rawData = rows.map((row) => [Number(row[xCols[0]]), Number(row[yCol])]).filter((v) => !isNaN(v[0]) && !isNaN(v[1]));
        const curveData = r.fitted.map((d) => [+(+d.x).toFixed(5), +(+d.y).toFixed(5)]);
        const fitOption = {
          backgroundColor: '#fff',
          title: { text: `${modelName} 拟合: ${yCol}`, left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
          tooltip: {},
          grid: { left: 60, right: 30, top: 50, bottom: 45 },
          xAxis: { type: 'value', name: xCols[0], nameTextStyle: { fontFamily: 'Times New Roman' } },
          yAxis: { type: 'value', name: yCol, nameTextStyle: { fontFamily: 'Times New Roman' } },
          series: [
            { type: 'scatter', name: '观测值', data: rawData, symbolSize: 5, itemStyle: { color: '#5470c6' } },
            { type: 'line', name: '拟合曲线', data: curveData, symbol: 'none', lineStyle: { color: '#d00', width: 2 } },
          ],
        };
        result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'scatter', title: `${modelName} 拟合曲线: ${yCol}`, data: fitOption }] };
      }
      break;
    }
    case 'rsm': {
      if (factorCols.length >= 2 && responseCol) {
        const r = runRSM(rows, factorCols, responseCol);
        const charts = buildRsmCharts(r, factorCols, responseCol, rows);
        const diag = buildRsmDiagnostics(r);
        const chartData: ChartDataSource[] = [
          { chartType: 'surface3d', title: '3D响应面', data: charts.surface3d },
          { chartType: 'contour', title: '等高线图', data: charts.contour },
          { chartType: 'heatmap', title: '响应面热力图', data: charts.heatmap },
          { chartType: 'qq', title: '残差正态概率图', data: diag.qq },
          { chartType: 'scatter', title: '残差 vs 拟合值', data: diag.residFit },
          { chartType: 'bar', title: 'Cook 距离', data: diag.cooksD },
        ];
        result = {
          tables: [r.summary, r.table, r.anova, r.residTable],
          conclusion: r.conclusion,
          chartData,
          rsm: r,
        };
      }
      break;
    }
    case 'pca': {
      const r = runPCA(rows, valueCols.length ? valueCols : numericCols);
      const pcs = valueCols.length ? valueCols : numericCols;
      const totalVar = r.eigenvalues.reduce((a, b) => a + b, 0);
      let cum = 0;
      const cumVals = r.eigenvalues.map((ev) => { cum += ev / totalVar; return +(cum * 100).toFixed(1); });
      const pcaLabels = r.eigenvalues.map((_, i) => `PC${i + 1}`);
      const screeOption = {
        backgroundColor: '#fff',
        title: { text: 'PCA 碎石图', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
        tooltip: {},
        legend: { data: ['特征值', '累计贡献率 %'], bottom: 5 },
        grid: { left: 55, right: 55, top: 45, bottom: 55 },
        xAxis: { type: 'category', data: pcaLabels },
        yAxis: [
          { type: 'value', name: '特征值', nameTextStyle: { fontFamily: 'Times New Roman' } },
          { type: 'value', name: '累计贡献率 %', max: 100, nameTextStyle: { fontFamily: 'Times New Roman' } },
        ],
        series: [
          { type: 'bar', name: '特征值', data: r.eigenvalues.map((ev) => +ev.toFixed(4)), itemStyle: { color: '#5470c6' } },
          { type: 'line', name: '累计贡献率 %', yAxisIndex: 1, data: cumVals, symbolSize: 6, lineStyle: { color: '#d00' }, itemStyle: { color: '#d00' } },
        ],
      };
      const loadingData = pcs.map((col, i) => ({ name: col, value: [+(+r.loadings[i][0]).toFixed(4), +(+r.loadings[i][1]).toFixed(4)] }));
      const loadingsOption = {
        backgroundColor: '#fff',
        title: { text: 'PCA 载荷图 (PC1 vs PC2)', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
        tooltip: { formatter: (p: unknown) => { const v = (p as { data: { name: string; value: number[] } }).data; return `${v?.name}: (${v?.value?.[0]}, ${v?.value?.[1]})`; } },
        grid: { left: 60, right: 30, top: 45, bottom: 45 },
        xAxis: { type: 'value', name: 'PC1', nameTextStyle: { fontFamily: 'Times New Roman' } },
        yAxis: { type: 'value', name: 'PC2', nameTextStyle: { fontFamily: 'Times New Roman' } },
        series: [{ type: 'scatter', data: loadingData, symbolSize: 9, itemStyle: { color: '#5470c6' } }],
      };
      const scoresOption = {
        backgroundColor: '#fff',
        title: { text: 'PCA 得分散点图 (PC1 vs PC2)', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
        tooltip: {},
        grid: { left: 60, right: 30, top: 45, bottom: 45 },
        xAxis: { type: 'value', name: 'PC1', nameTextStyle: { fontFamily: 'Times New Roman' } },
        yAxis: { type: 'value', name: 'PC2', nameTextStyle: { fontFamily: 'Times New Roman' } },
        series: [{ type: 'scatter', data: r.scores.map((s) => [+s[0].toFixed(4), +s[1].toFixed(4)]), symbolSize: 6, itemStyle: { color: '#91cc75' } }],
      };
      result = {
        tables: [r.table],
        conclusion: '',
        chartData: [
          { chartType: 'bar', title: 'PCA 碎石图', data: screeOption },
          { chartType: 'scatter', title: 'PCA 载荷图', data: loadingsOption },
          { chartType: 'scatter', title: 'PCA 得分散点图', data: scoresOption },
        ],
      };
      break;
    }
    case 'pipeline': {
      const pipelineCols = valueCols.length ? valueCols : numericCols;
      const tables: ResultTable[] = [];
      const chartData: ChartDataSource[] = [];
      const conclusions: string[] = [];

      // ── Phase 1: Preprocessing ──
      const missing = runMissingDiagnostic(rows, pipelineCols);
      tables.push({ ...missing.table, title: '【阶段一】' + missing.table.title });

      const outlier = runOutlierDetection(rows, pipelineCols);
      tables.push({ ...outlier.table, title: '【阶段一】' + outlier.table.title });
      const procRows = outlier.cappedRows;

      const stdResult = runStandardization(procRows, pipelineCols);
      tables.push({ ...stdResult.table, title: '【阶段一】' + stdResult.table.title });
      const stdRows = stdResult.standardizedRows;
      conclusions.push(`预处理完成：${pipelineCols.length} 个变量，${outlier.totalOutliers} 个异常值已盖帽，全部标准化 (μ=0, σ=1)`);

      // ── Phase 2: Basic Statistics ──
      const desc = runDescriptive(stdRows, pipelineCols);
      tables.push({ ...desc, title: '【阶段二】' + desc.title });

      const norm = runNormality(stdRows, pipelineCols, alpha);
      tables.push({ ...norm.table, title: '【阶段二】' + norm.table.title });
      const normalCount = norm.table.rows.filter((r) => r[4] === '是').length;
      conclusions.push(`Shapiro-Wilk: ${normalCount}/${pipelineCols.length} 个变量服从正态分布`);

      // Batch ANOVA with Levene check (variance ratio heuristic)
      if (groupCol && pipelineCols.length > 0) {
        const anovaHeaders = ['因变量', '方法', '统计量', 'P值', '方差比', '显著性'];
        const anovaRows: (string | number)[][] = [];
        for (const col of pipelineCols) {
          const groups = extractByGroup(stdRows, col, groupCol);
          const groupNames = Array.from(groups.keys());
          const gData = groupNames.map((g) => groups.get(g)!).filter((v) => v.length > 1);
          if (gData.length < 2) continue;
          // Levene-like check: max/min variance ratio
          const vars = gData.map((v) => variance(v));
          const varRatio = Math.max(...vars) / Math.min(...vars);
          if (varRatio < 3) {
            // Standard ANOVA
            const aov = runOneWayANOVA(stdRows, col, groupCol, alpha);
            const aovRow = aov.table.rows[0] as (string | number)[];
            const fVal = aovRow[4] as number;
            const pVal = aovRow[5] as number;
            const sig = pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : 'ns';
            anovaRows.push([col, 'ANOVA', +fVal.toFixed(4), +Number(pVal).toFixed(6), +varRatio.toFixed(2), sig]);
          } else {
            // Kruskal-Wallis via rank-based ANOVA
            const allVals: number[] = [];
            for (const g of groupNames) allVals.push(...groups.get(g)!);
            const sorted = [...allVals].sort((a, b) => a - b);
            const rankMap = new Map<number, number>();
            sorted.forEach((v, i) => rankMap.set(v, i + 1));
            const rankedRows = stdRows.map((r) => {
              const newRow = { ...r };
              newRow[col] = rankMap.get(Number(r[col])) ?? 0;
              return newRow;
            });
            const kw = runOneWayANOVA(rankedRows, col, groupCol, alpha);
            const kwRow = kw.table.rows[0] as (string | number)[];
            const hVal = kwRow[4] as number;
            const pVal = kwRow[5] as number;
            const sig = pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : 'ns';
            anovaRows.push([col, 'Kruskal-Wallis', +hVal.toFixed(4), +Number(pVal).toFixed(6), +varRatio.toFixed(2), sig]);
          }
        }
        tables.push({ title: '【阶段二】单因素ANOVA（自动选择：方差比<3→ANOVA，否则→Kruskal-Wallis）', headers: anovaHeaders, rows: anovaRows });
        const sigCount = anovaRows.filter((r) => typeof r[5] === 'string' && r[5] !== 'ns').length;
        conclusions.push(`ANOVA: ${sigCount}/${anovaRows.length} 个变量组间差异显著`);
      }

      // ── Phase 3: Advanced Modeling ──
      if (pipelineModels.includes('correlation')) {
        const corr = runCorrelation(stdRows, pipelineCols, 'pearson');
        tables.push({ ...corr.table, title: '【阶段三】' + corr.table.title });
      }

      if (pipelineModels.includes('rsm') && factorCols.length >= 2 && responseCol) {
        try {
          const rsm = runRSM(stdRows, factorCols, responseCol);
          tables.push({ ...rsm.table, title: '【阶段三】' + rsm.table.title });
          conclusions.push(`RSM: ${rsm.conclusion}`);
        } catch { conclusions.push('RSM: 拟合失败（可能因素共线或数据不足）'); }
      } else if (pipelineModels.includes('rsm')) {
        conclusions.push('RSM: 跳过（需配置2-3个因素列和1个响应列）');
      }

      if (pipelineModels.includes('pca')) {
        const pca = runPCA(stdRows, pipelineCols);
        tables.push({ ...pca.table, title: '【阶段三】' + pca.table.title });
        const totalVar = pca.eigenvalues.reduce((a, b) => a + b, 0);
        const pc1 = pca.eigenvalues[0] / totalVar;
        const pc2 = (pca.eigenvalues[0] + pca.eigenvalues[1]) / totalVar;
        conclusions.push(`PCA: PC1解释 ${(pc1 * 100).toFixed(1)}%, 前2成分累计 ${(pc2 * 100).toFixed(1)}%`);
        chartData.push({
          chartType: 'scatter', title: 'PCA 得分图 (PC1 vs PC2)',
          data: {
            backgroundColor: '#fff',
            title: { text: 'PCA 得分图 (PC1 vs PC2)', left: 'center', top: 5, textStyle: { color: '#000', fontSize: 14, fontFamily: 'Times New Roman' } },
            tooltip: {},
            grid: { left: 60, right: 30, top: 45, bottom: 45 },
            xAxis: { type: 'value', name: 'PC1', nameTextStyle: { fontFamily: 'Times New Roman' } },
            yAxis: { type: 'value', name: 'PC2', nameTextStyle: { fontFamily: 'Times New Roman' } },
            series: [{ type: 'scatter', data: pca.scores.map((s) => [+s[0].toFixed(4), +s[1].toFixed(4)]), symbolSize: 6, itemStyle: { color: '#91cc75' } }],
          },
        });
      }

      result = { tables, conclusion: conclusions.join(' | '), chartData };
      break;
    }
  }
  return result;
}