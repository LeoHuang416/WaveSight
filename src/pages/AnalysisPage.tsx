import { useState, useCallback, useRef } from 'react';
import { Button, Select, Table, Typography, Alert, Space, message, Spin, Descriptions, Divider, Checkbox, Tabs, Tooltip, Radio } from 'antd';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import { PlayCircleOutlined, SaveOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateId, formatNumber, formatPValue } from '@/utils/format';
import { exportCSV, exportPNG } from '@/utils/export';
import { runDescriptive, runFrequency, runNormality, runGroupedStats } from '@/engine/descriptive';
import { runIndependentTTest, runPairedTTest, runOneWayANOVA, runTukeyHSD } from '@/engine/hypothesis';
import { runCorrelation, runLinearRegression, runNonlinearFit, runRSM, runPCA, type RSMResult } from '@/engine/modeling';
import { buildRsmCharts, buildRsmDiagnostics } from '@/engine/rsmCharts';
import { runMissingDiagnostic, runOutlierDetection, runStandardization } from '@/engine/preprocessing';
import { extractByGroup, variance, fTestPValue } from '@/engine/utils';
import type { AnalysisType, AnalysisConfig, ResultTable, ChartDataSource } from '@/types/analysis';
import type { ChartConfig, ChartType } from '@/types/chart';

const { Text } = Typography;

interface AnalysisDef {
  key: AnalysisType;
  label: string;
  group: string;
  needs: { valueCols?: 'multi' | 'single'; groupCol?: boolean; xCols?: 'multi' | 'single'; yCol?: boolean; factorCols?: '2-3'; responseCol?: boolean; paired?: boolean; method?: boolean; model?: boolean; pipeline?: boolean };
}

const ANALYSES: AnalysisDef[] = [
  { key: 'descriptive', label: '描述统计', group: '描述统计', needs: { valueCols: 'multi' } },
  { key: 'frequency', label: '频数统计', group: '描述统计', needs: { valueCols: 'single' } },
  { key: 'normality', label: '正态性检验', group: '描述统计', needs: { valueCols: 'multi' } },
  { key: 'grouped-stats', label: '分组统计', group: '描述统计', needs: { valueCols: 'multi', groupCol: true } },
  { key: 'ttest-independent', label: '独立样本 t 检验', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'ttest-paired', label: '配对 t 检验', group: '假设检验', needs: { paired: true } },
  { key: 'anova-oneway', label: '单因素 ANOVA', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'correlation', label: '相关矩阵', group: '建模', needs: { valueCols: 'multi', method: true } },
  { key: 'linear-regression', label: '线性回归 (OLS)', group: '建模', needs: { xCols: 'multi', yCol: true } },
  { key: 'nonlinear-fit', label: '非线性拟合', group: '建模', needs: { xCols: 'single', yCol: true, model: true } },
  { key: 'rsm', label: '响应面分析 (RSM)', group: '建模', needs: { factorCols: '2-3', responseCol: true } },
  { key: 'pca', label: '主成分分析 (PCA)', group: '建模', needs: { valueCols: 'multi' } },
  { key: 'pipeline', label: '全流程分析', group: '综合', needs: { valueCols: 'multi', groupCol: true, factorCols: '2-3', responseCol: true, pipeline: true } },
];

export default function AnalysisPage() {
  const { currentDataset, getNumericColumns, getCategoricalColumns } = useDataStore();
  const { addRecord } = useHistoryStore();
  const { addChart } = useChartStore();
  const alpha = useSettingsStore((s) => s.alpha);
  const digits = useSettingsStore((s) => s.significantDigits);

  const [analysisType, setAnalysisType] = useState<AnalysisType | null>(null);
  const [valueCols, setValueCols] = useState<string[]>([]);
  const [groupCol, setGroupCol] = useState<string | undefined>();
  const [xCols, setXCols] = useState<string[]>([]);
  const [yCol, setYCol] = useState<string | undefined>();
  const [factorCols, setFactorCols] = useState<string[]>([]);
  const [responseCol, setResponseCol] = useState<string | undefined>();
  const [pairedCol1, setPairedCol1] = useState<string | undefined>();
  const [pairedCol2, setPairedCol2] = useState<string | undefined>();
  const [corrMethod, setCorrMethod] = useState('pearson');
  const [modelName, setModelName] = useState('exp');
  const [pipelineModels, setPipelineModels] = useState<string[]>(['correlation', 'rsm', 'pca']);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ tables: ResultTable[]; conclusion: string; chartData?: ChartDataSource[]; rsm?: RSMResult } | null>(null);
  const rsmChartRefs = useRef<Record<string, ReactECharts | null>>({});
  const [rsmEqForm, setRsmEqForm] = useState<'coded' | 'actual'>('coded');

  const activeAnalysis = ANALYSES.find((a) => a.key === analysisType);
  const numericCols = getNumericColumns().map((c) => c.name);
  const catCols = getCategoricalColumns().map((c) => c.name);

  const run = useCallback(async () => {
    if (!currentDataset || !analysisType) return;
    setRunning(true);
    setResults(null); // clear stale results before computing new ones
    const rows = currentDataset.rows;
    try {
      let result: { tables: ResultTable[]; conclusion: string; chartData?: ChartDataSource[]; rsm?: RSMResult } = { tables: [], conclusion: '' };

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
          result = { tables: [r.table], conclusion: '', chartData: Object.entries(r.qqData).map(([col, d]) => ({ chartType: 'qq', title: `Q-Q 图: ${col}`, data: d })) };
          break;
        }
        case 'grouped-stats':
          if (groupCol) result = { tables: [runGroupedStats(rows, valueCols.length ? valueCols : numericCols, groupCol)], conclusion: '' };
          break;
        case 'ttest-independent': {
          if (valueCols[0] && groupCol) {
            const r = runIndependentTTest(rows, valueCols[0], groupCol, alpha);
            result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'boxplot', title: `${valueCols[0]} 按 ${groupCol}`, data: { valueCol: valueCols[0], groupCol } }] };
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
            result = { tables: [r.table, tukey], conclusion: r.conclusion, chartData: [{ chartType: 'boxplot', title: `ANOVA: ${valueCols[0]}`, data: { valueCol: valueCols[0], groupCol } }] };
          }
          break;
        }
        case 'correlation': {
          const r = runCorrelation(rows, valueCols.length ? valueCols : numericCols, corrMethod);
          result = { tables: [r.table], conclusion: '', chartData: [{ chartType: 'heatmap', title: `${corrMethod} 相关矩阵`, data: { cols: valueCols.length ? valueCols : numericCols, matrix: r.matrix } }] };
          break;
        }
        case 'linear-regression': {
          if (xCols.length && yCol) {
            const r = runLinearRegression(rows, xCols, yCol);
            result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'scatter', title: `${yCol} 拟合`, data: { fitted: r.fittedValues, residuals: r.residuals, xCols, yCol } }] };
          }
          break;
        }
        case 'nonlinear-fit': {
          if (xCols[0] && yCol) {
            const r = runNonlinearFit(rows, xCols[0], yCol, modelName);
            result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'scatter', title: `${modelName} 拟合: ${yCol}`, data: r.fitted }] };
          }
          break;
        }
        case 'rsm': {
          if (factorCols.length >= 2 && responseCol) {
            const r = runRSM(rows, factorCols, responseCol);
            // Real chart options built from the fitted model (P0: previously saved
            // { factorCols, responseCol } as echartsOption → blank/stale charts)
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
            const optimalRows: (string | number)[][] = r.optimal
              ? [[r.optimal.y, r.optimal.values, r.optimal.boundary ? '边界' : '域内', r.optimal.predInterval]]
              : [['—', '无解析驻点', '—', '—']];
            result = {
              tables: [
                r.summary,
                r.table,
                r.anova,
                r.residTable,
                { title: '回归方程（编码变量）', headers: ['方程'], rows: [[r.equation], ...r.codedDefs.map((d) => [d])] },
                { title: '规划求解（最优解）', headers: ['最优响应', '条件', '类型', '95%预测区间'], rows: optimalRows },
              ],
              conclusion: r.conclusion,
              chartData,
              rsm: r,
            };
          }
          break;
        }
        case 'pca': {
          const r = runPCA(rows, valueCols.length ? valueCols : numericCols);
          result = { tables: [r.table], conclusion: '', chartData: [{ chartType: 'scatter', title: 'PCA 得分图', data: r.scores }] };
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
                // Extract F and p from the standard ANOVA table
                const aovRow = aov.table.rows[0] as (string | number)[];
                const fVal = aovRow[4] as number;
                const pVal = aovRow[5] as number;
                const sig = pVal < 0.001 ? '***' : pVal < 0.01 ? '**' : pVal < 0.05 ? '*' : 'ns';
                anovaRows.push([col, 'ANOVA', +fVal.toFixed(4), +Number(pVal).toFixed(6), +varRatio.toFixed(2), sig]);
              } else {
                // Use Kruskal-Wallis (non-parametric)
                // Compute via ranks — simplified: use existing runOneWayANOVA on ranked data
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
            chartData.push({ chartType: 'scatter', title: 'PCA 得分图 (PC1 vs PC2)', data: pca.scores });
          }

          result = { tables, conclusion: conclusions.join(' | '), chartData };
          break;
        }
      }

      setResults(result);

      const config: AnalysisConfig = {
        type: analysisType, datasetId: currentDataset.id,
        valueCols: valueCols.length ? valueCols : undefined,
        groupCol, xCols: xCols.length ? xCols : undefined, yCol,
        factorCols: factorCols.length ? factorCols : undefined, responseCol,
        method: corrMethod, modelName, pairedCol1, pairedCol2, alpha,
      };
      const recordId = generateId();
      await addRecord({
        id: recordId, analysisConfig: config,
        result: { id: generateId(), config, tables: result.tables, conclusion: result.conclusion, chartData: result.chartData, timestamp: Date.now() },
        datasetName: currentDataset.name, relatedChartIds: [], note: '', createdAt: Date.now(),
      });
    } finally { setRunning(false); }
  }, [currentDataset, analysisType, valueCols, groupCol, xCols, yCol, factorCols, responseCol, pairedCol1, pairedCol2, corrMethod, modelName, alpha, numericCols, addRecord]);

  const saveChartToModule = async (chartData: ChartDataSource) => {
    const cfg: ChartConfig = {
      id: generateId(), title: chartData.title, chartType: chartData.chartType as ChartType,
      datasetId: currentDataset!.id, columnMapping: {}, echartsOption: chartData.data as Record<string, unknown>,
      colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12,
      xAxisLabel: '', yAxisLabel: '', createdAt: Date.now(),
      sourceAnalysisId: analysisType ?? undefined,
    };
    await addChart(cfg);
    message.success('图表已保存');
  };

  const exportResults = () => {
    if (!results || results.tables.length === 0) { message.warning('没有可导出的结果'); return; }
    const allTables: string[] = [];
    results.tables.forEach((t) => {
      allTables.push(`\n${t.title}\n${t.headers.join(',')}`);
      t.rows.forEach((row) => allTables.push(row.map((v) => typeof v === 'number' ? formatNumber(v, digits) : String(v ?? '')).join(',')));
    });
    if (results.conclusion) allTables.push(`\n结论,${results.conclusion}`);
    const blob = new Blob(['﻿' + allTables.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analysis-${analysisType ?? 'result'}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    message.success('分析结果已导出为 CSV');
  };

  const copyResults = () => {
    if (!results || results.tables.length === 0) { message.warning('没有可复制的结果'); return; }
    const lines: string[] = [];
    results.tables.forEach((t) => {
      lines.push(`${t.title}\n${t.headers.join('\t')}`);
      t.rows.forEach((row) => lines.push(row.map((v) => typeof v === 'number' ? formatNumber(v, digits) : String(v ?? '')).join('\t')));
    });
    if (results.conclusion) lines.push(`\n结论\t${results.conclusion}`);
    navigator.clipboard.writeText(lines.join('\n')).then(() => message.success('已复制到剪贴板')).catch(() => message.error('复制失败'));
  };

  const renderSlot = (label: string, mode: 'single' | 'multi' | undefined, value: string[] | string | undefined, onChange: (v: string[] | string | undefined) => void, options: string[]) => {
    if (mode === 'single') return <Space><Text>{label}:</Text><Select style={{ width: 180 }} value={value as string || undefined} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} allowClear placeholder={`选择 ${label}`} /></Space>;
    if (mode === 'multi') return <Space><Text>{label}:</Text><Select mode="multiple" style={{ minWidth: 200 }} value={(value as string[]) || []} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} placeholder={`选择 ${label}`} /></Space>;
    return null;
  };

  if (!currentDataset) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader title="实验数据分析" description="选择统计方法和数据列进行分析" />
        <EmptyState description="请先导入数据" actionText="前往导入 →" actionPath="/import" />
      </div>
    );
  }

  const groups = [...new Set(ANALYSES.map((a) => a.group))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="实验数据分析" description="选择统计方法和数据列进行分析">
        <span className="tag text-indigo-300 border-indigo-500/20 bg-indigo-500/5">α = {alpha}</span>
        <button className="btn-primary text-sm" onClick={run} disabled={!activeAnalysis || running}>
          <PlayCircleOutlined /> 运行分析
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: analysis menu */}
        <div className="lg:col-span-1 glass-card-static p-3 h-fit">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">分析方法</h3>
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="text-[10px] font-medium text-slate-600 uppercase tracking-wider px-2 mb-1">{g}</p>
              <div className="space-y-0.5">
                {ANALYSES.filter((a) => a.group === g).map((a) => {
                  const isActive = analysisType === a.key;
                  return (
                    <button
                      key={a.key}
                      onClick={() => { setAnalysisType(a.key); setResults(null); setValueCols([]); setGroupCol(undefined); setXCols([]); setYCol(undefined); setFactorCols([]); setResponseCol(undefined); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent'
                      }`}
                    >{a.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

          {/* Center: variable config + results */}
          <div className="lg:col-span-3 space-y-6">
            <div className="glass-card-static p-5">
            {activeAnalysis && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  {activeAnalysis.needs.valueCols && renderSlot('变量', activeAnalysis.needs.valueCols, valueCols, (v) => setValueCols(Array.isArray(v) ? v : v ? [v] : []), numericCols)}
                  {activeAnalysis.needs.groupCol && renderSlot('分组列', 'single', groupCol, (v) => setGroupCol(v as string | undefined), catCols)}
                  {activeAnalysis.needs.xCols && renderSlot('自变量 X', activeAnalysis.needs.xCols, xCols, (v) => setXCols(Array.isArray(v) ? v : v ? [v] : []), numericCols)}
                  {activeAnalysis.needs.yCol && renderSlot('因变量 Y', 'single', yCol, (v) => setYCol(v as string | undefined), numericCols)}
                  {activeAnalysis.needs.factorCols && renderSlot('因素列(2-3个)', 'multi', factorCols, (v) => setFactorCols(Array.isArray(v) ? v : []), numericCols)}
                  {activeAnalysis.needs.responseCol && renderSlot('响应列', 'single', responseCol, (v) => setResponseCol(v as string | undefined), numericCols)}
                  {activeAnalysis.needs.paired && (<>
                    {renderSlot('配对列1', 'single', pairedCol1, (v) => setPairedCol1(v as string | undefined), numericCols)}
                    {renderSlot('配对列2', 'single', pairedCol2, (v) => setPairedCol2(v as string | undefined), numericCols)}
                  </>)}
                  {activeAnalysis.needs.method && <Space><Text>方法:</Text><Select style={{ width: 120 }} value={corrMethod} onChange={setCorrMethod} options={[{ label: 'Pearson', value: 'pearson' }, { label: 'Spearman', value: 'spearman' }, { label: 'Kendall', value: 'kendall' }]} /></Space>}
                  {activeAnalysis.needs.model && <Space><Text>模型:</Text><Select style={{ width: 120 }} value={modelName} onChange={setModelName} options={[{ label: '指数', value: 'exp' }, { label: '幂函数', value: 'power' }, { label: 'Gaussian', value: 'gauss' }, { label: '线性', value: 'linear' }]} /></Space>}
                  {activeAnalysis.needs.pipeline && (
                    <Space direction="vertical" size={2}>
                      <Text style={{ fontSize: 12 }}>高级建模选项:</Text>
                      <Checkbox.Group value={pipelineModels} onChange={(v) => setPipelineModels(v as string[])}
                        options={[
                          { label: '相关矩阵', value: 'correlation' },
                          { label: '响应面 (RSM)', value: 'rsm' },
                          { label: '主成分 (PCA)', value: 'pca' },
                        ]} />
                    </Space>
                  )}
                </Space>
              </Space>
            )}
            </div>

            {results && (
              <div className="glass-card-static p-5">
                {analysisType === 'pipeline' ? (
                  /* Phase-grouped rendering for pipeline */
                  ['【阶段一】', '【阶段二】', '【阶段三】'].map((phase) => {
                    const phaseTables = results.tables.filter((t) => t.title.startsWith(phase));
                    if (phaseTables.length === 0) return null;
                    const phaseLabel = phase === '【阶段一】' ? '预处理与诊断' : phase === '【阶段二】' ? '基础统计与假设检验' : '高级建模与可视化';
                    return (
                      <div key={phase} style={{ marginBottom: 20 }}>
                        <Divider orientation="left" style={{ fontSize: 14, fontWeight: 600 }}>{phaseLabel}</Divider>
                        {phaseTables.map((t, i) => (
                          <div key={i} style={{ marginBottom: 12 }}>
                            <Text strong style={{ fontSize: 12 }}>{t.title.replace(phase, '')}</Text>
                            <Table columns={t.headers.map((h) => ({ title: h, dataIndex: h, key: h }))}
                              dataSource={t.rows.map((row, ri) => {
                                const obj: Record<string, unknown> = { _key: ri };
                                t.headers.forEach((h, hi) => { obj[h] = typeof row[hi] === 'number' ? formatNumber(row[hi] as number, digits) : row[hi]; });
                                return obj;
                              })}
                              rowKey="_key" size="small" bordered pagination={false} scroll={{ x: 'max-content' }} />
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  /* Flat rendering for single analyses */
                  results.tables
                    // equation/optimal already shown in the RSM panel above
                    .filter((t) => analysisType !== 'rsm' || (t.title !== '回归方程（编码变量）' && t.title !== '规划求解（最优解）'))
                    .map((t, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <Text strong>{t.title}</Text>
                      <Table
                        columns={t.headers.map((h, hi) => ({
                          title: h, dataIndex: h, key: h,
                          // P2-8: first column variable names — ellipsis + tooltip, never truncated
                          ellipsis: hi === 0,
                          render: hi === 0 ? (v: unknown) => <Tooltip title={String(v)}><span>{String(v)}</span></Tooltip> : undefined,
                        }))}
                        dataSource={t.rows.map((row, ri) => {
                          const obj: Record<string, unknown> = { _key: ri };
                          t.headers.forEach((h, hi) => { obj[h] = typeof row[hi] === 'number' ? formatNumber(row[hi] as number, digits) : row[hi]; });
                          return obj;
                        })}
                        rowKey="_key" size="small" bordered pagination={false} scroll={{ x: 'max-content' }} />
                    </div>
                  )))}
                {analysisType === 'rsm' && results.rsm && (
                  <div style={{ marginBottom: 20 }}>
                    {/* 回归方程文本 (P2-9) */}
                    <Alert type="info" showIcon style={{ marginBottom: 12 }}
                      message={<Space direction="vertical" size={4}>
                        <Space size={8}>
                          <Text strong style={{ fontSize: 13 }}>回归方程</Text>
                          {/* 编码值/实际值切换 (附加13) */}
                          <Radio.Group size="small" value={rsmEqForm} onChange={(e) => setRsmEqForm(e.target.value as 'coded' | 'actual')}>
                            <Radio.Button value="coded">编码变量</Radio.Button>
                            <Radio.Button value="actual">实际变量</Radio.Button>
                          </Radio.Group>
                        </Space>
                        <Text code style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{rsmEqForm === 'coded' ? results.rsm.equation : results.rsm.equationActual}</Text>
                        {rsmEqForm === 'coded' && <Text type="secondary" style={{ fontSize: 12 }}>{results.rsm.codedDefs.join('　')}</Text>}
                      </Space>} />
                    {/* 规划求解 (P1-7) */}
                    {results.rsm.optimal ? (
                      <Alert type="success" showIcon style={{ marginBottom: 12 }} message={
                        <Space direction="vertical" size={2}>
                          <Text>最优响应 = <Text strong style={{ fontFamily: 'Times New Roman', fontSize: 15 }}>{formatNumber(results.rsm.optimal.y, digits)}</Text></Text>
                          <Text style={{ fontSize: 12 }}>条件：{results.rsm.optimal.values}{results.rsm.optimal.boundary ? '（边界最优）' : '（域内驻点）'}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>95% 预测区间：{results.rsm.optimal.predInterval}</Text>
                        </Space>} />
                    ) : <Alert type="warning" showIcon message="未找到解析最优解（模型奇异或驻点在实验域外）" style={{ marginBottom: 12 }} />}
                    {/* 图表标签页：每个图表独立实例 + 独立导出 (P0-2/3/4) */}
                    <Tabs destroyInactiveTabPane
                      items={(results.chartData ?? []).map((cd) => ({
                        key: cd.chartType,
                        label: cd.title,
                        children: (
                          <div>
                            <div className="glass-card" style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                              <ReactECharts ref={(e) => { rsmChartRefs.current[cd.chartType] = e; }} option={cd.data as Record<string, unknown>} style={{ height: 420, background: '#fff' }} notMerge />
                            </div>
                            <Space style={{ marginTop: 8 }}>
                              <Button icon={<DownloadOutlined />} onClick={() => { const inst = rsmChartRefs.current[cd.chartType]?.getEchartsInstance(); if (inst) exportPNG(inst, cd.title); else message.warning('图表未就绪'); }}>导出 PNG</Button>
                              <Button icon={<SaveOutlined />} onClick={() => saveChartToModule(cd)}>保存到图表模块</Button>
                            </Space>
                          </div>
                        ),
                      }))}
                    />
                  </div>
                )}
                {results.conclusion && <Alert type="success" message={results.conclusion} style={{ marginBottom: 16 }} />}

                <Space style={{ marginBottom: 16 }}>
                  <Button icon={<DownloadOutlined />} onClick={exportResults}>导出 CSV</Button>
                  <Button icon={<CopyOutlined />} onClick={copyResults}>复制结果</Button>
                </Space>

                {results.chartData?.map((cd, i) => (
                  <Button key={i} icon={<SaveOutlined />} onClick={() => saveChartToModule(cd)} style={{ marginRight: 8 }}>
                    保存图表: {cd.title}
                  </Button>
                ))}
              </div>
            )}
          </div>

      </div>

      {/* Available columns bar */}
      <div className="glass-card-static px-4 py-2 mt-4 flex flex-wrap items-center gap-1">
        <span className="text-xs text-slate-500 mr-2">可用列:</span>
        {numericCols.map((c) => <Button key={c} size="small" type="text" onClick={() => {
          if (valueCols.includes(c)) setValueCols(valueCols.filter((v) => v !== c));
          else setValueCols([...valueCols, c]);
        }}>{c} 🔢</Button>)}
        {catCols.map((c) => <Button key={c} size="small" type="text" disabled={activeAnalysis?.needs.groupCol !== true}
          onClick={() => setGroupCol(groupCol === c ? undefined : c)}>{c} 🔤</Button>)}
      </div>
    </div>
  );
}
