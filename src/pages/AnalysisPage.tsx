import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, Table, Typography, Alert, Space, Collapse, message, Spin, Empty, Descriptions } from 'antd';
import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateId, formatNumber, formatPValue } from '@/utils/format';
import { runDescriptive, runFrequency, runNormality, runGroupedStats } from '@/engine/descriptive';
import { runIndependentTTest, runPairedTTest, runOneWayANOVA, runTukeyHSD } from '@/engine/hypothesis';
import { runCorrelation, runLinearRegression, runNonlinearFit, runRSM, runPCA } from '@/engine/modeling';
import type { AnalysisType, AnalysisConfig, ResultTable, ChartDataSource } from '@/types/analysis';
import type { ChartConfig, ChartType } from '@/types/chart';

const { Title, Text } = Typography;

interface AnalysisDef {
  key: AnalysisType;
  label: string;
  group: string;
  needs: { valueCols?: 'multi' | 'single'; groupCol?: boolean; xCols?: 'multi' | 'single'; yCol?: boolean; factorCols?: '2-3'; responseCol?: boolean; paired?: boolean; method?: boolean; model?: boolean };
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
];

export default function AnalysisPage() {
  const navigate = useNavigate();
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
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ tables: ResultTable[]; conclusion: string; chartData?: ChartDataSource[] } | null>(null);

  const activeAnalysis = ANALYSES.find((a) => a.key === analysisType);
  const numericCols = getNumericColumns().map((c) => c.name);
  const catCols = getCategoricalColumns().map((c) => c.name);

  const run = useCallback(async () => {
    if (!currentDataset || !analysisType) return;
    setRunning(true);
    const rows = currentDataset.rows;
    try {
      let result: { tables: ResultTable[]; conclusion: string; chartData?: ChartDataSource[] } = { tables: [], conclusion: '' };

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
          const r = runNormality(rows, valueCols.length ? valueCols : numericCols);
          result = { tables: [r.table], conclusion: '', chartData: Object.entries(r.qqData).map(([col, d]) => ({ chartType: 'qq', title: `Q-Q 图: ${col}`, data: d })) };
          break;
        }
        case 'grouped-stats':
          if (groupCol) result = { tables: [runGroupedStats(rows, valueCols.length ? valueCols : numericCols, groupCol)], conclusion: '' };
          break;
        case 'ttest-independent': {
          if (valueCols[0] && groupCol) {
            const r = runIndependentTTest(rows, valueCols[0], groupCol);
            result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'boxplot', title: `${valueCols[0]} 按 ${groupCol}`, data: { valueCol: valueCols[0], groupCol } }] };
          }
          break;
        }
        case 'ttest-paired': {
          if (pairedCol1 && pairedCol2) {
            const r = runPairedTTest(rows, pairedCol1, pairedCol2);
            result = { tables: [r.table], conclusion: r.conclusion };
          }
          break;
        }
        case 'anova-oneway': {
          if (valueCols[0] && groupCol) {
            const r = runOneWayANOVA(rows, valueCols[0], groupCol);
            const tukey = runTukeyHSD(rows, valueCols[0], groupCol);
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
            result = { tables: [r.table], conclusion: r.conclusion, chartData: [{ chartType: 'contour', title: '响应面', data: { factorCols, responseCol } }] };
          }
          break;
        }
        case 'pca': {
          const r = runPCA(rows, valueCols.length ? valueCols : numericCols);
          result = { tables: [r.table], conclusion: '', chartData: [{ chartType: 'scatter', title: 'PCA 得分图', data: r.scores }] };
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

  const renderSlot = (label: string, mode: 'single' | 'multi' | undefined, value: string[] | string | undefined, onChange: (v: string[] | string | undefined) => void, options: string[]) => {
    if (mode === 'single') return <Space><Text>{label}:</Text><Select style={{ width: 180 }} value={value as string || undefined} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} allowClear placeholder={`选择 ${label}`} /></Space>;
    if (mode === 'multi') return <Space><Text>{label}:</Text><Select mode="multiple" style={{ minWidth: 200 }} value={(value as string[]) || []} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} placeholder={`选择 ${label}`} /></Space>;
    return null;
  };

  if (!currentDataset) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>实验数据分析</Title>
        <div className="glass-card" style={{ padding: '24px 28px', background: 'rgba(255,255,255,0.4)' }}>
          <Empty description="请先导入数据" />
        </div>
      </div>
    );
  }

  const groups = [...new Set(ANALYSES.map((a) => a.group))];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>实验数据分析</Title>

      <div className="glass-card" style={{ padding: '24px 28px', background: 'rgba(255,255,255,0.4)' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Left: analysis menu */}
          <div style={{ width: 180, flexShrink: 0 }}>
            <Collapse defaultActiveKey={groups} items={groups.map((g) => ({
              key: g, label: g,
              children: <Space direction="vertical" style={{ width: '100%' }}>
                {ANALYSES.filter((a) => a.group === g).map((a) => (
                  <Button key={a.key} type={analysisType === a.key ? 'primary' : 'default'} block size="small"
                    onClick={() => { setAnalysisType(a.key); setResults(null); setValueCols([]); setGroupCol(undefined); setXCols([]); setYCol(undefined); setFactorCols([]); setResponseCol(undefined); }}>
                    {a.label}
                  </Button>
                ))}
              </Space>,
            }))} />
          </div>

          {/* Center: variable config + results */}
          <div style={{ flex: 1 }}>
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
                </Space>
                <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={run}>运行分析</Button>
              </Space>
            )}

            {results && (
              <div style={{ marginTop: 24 }}>
                {results.tables.map((t, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <Text strong>{t.title}</Text>
                    <Table columns={t.headers.map((h) => ({ title: h, dataIndex: h, key: h }))}
                      dataSource={t.rows.map((row, ri) => {
                        const obj: Record<string, unknown> = { _key: ri };
                        t.headers.forEach((h, hi) => { obj[h] = typeof row[hi] === 'number' ? formatNumber(row[hi] as number, digits) : row[hi]; });
                        return obj;
                      })}
                      rowKey="_key" size="small" bordered pagination={false} scroll={{ x: 'max-content' }} />
                  </div>
                ))}
                {results.conclusion && <Alert type="success" message={results.conclusion} style={{ marginBottom: 16 }} />}
                {results.chartData?.map((cd, i) => (
                  <Button key={i} icon={<SaveOutlined />} onClick={() => saveChartToModule(cd)} style={{ marginRight: 8 }}>
                    保存图表: {cd.title}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Right: action */}
          <div style={{ width: 120, flexShrink: 0 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="α">{alpha}</Descriptions.Item>
            </Descriptions>
          </div>
        </div>
      </div>

      {/* Available columns bar */}
      <div className="glass-card" style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.25)', borderRadius: 4 }}>
        <Text type="secondary">可用列: </Text>
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
