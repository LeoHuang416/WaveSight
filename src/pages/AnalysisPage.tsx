import { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Select, Table, Typography, Alert, Space, message, Spin, Checkbox, Tooltip, Radio, Empty } from 'antd';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import { useLocation } from 'react-router-dom';
import { PlayCircleOutlined, SaveOutlined, DownloadOutlined, CopyOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateId, formatNumber } from '@/utils/format';
import { exportPNG } from '@/utils/export';
import { computeAnalysis, type AnalysisResultData } from '@/engine/runAnalysis';
import {
  OUTPUT_MODULES, defaultCheckedOutputs, applyOutputFilter, moduleToCsv,
  type RenderedModule,
} from '@/engine/outputModules';
import type { AnalysisType, AnalysisConfig, ChartDataSource } from '@/types/analysis';
import type { ChartConfig, ChartType } from '@/types/chart';

const { Text } = Typography;

interface AnalysisDef {
  key: AnalysisType;
  label: string;
  group: string;
  needs: { valueCols?: 'multi' | 'single'; groupCol?: boolean; xCols?: 'multi' | 'single'; yCol?: boolean; factorCols?: '2-3'; responseCol?: boolean; paired?: boolean; method?: boolean; model?: boolean; pipeline?: boolean; twoCats?: boolean };
}

const ANALYSES: AnalysisDef[] = [
  { key: 'descriptive', label: '描述统计', group: '描述统计', needs: { valueCols: 'multi' } },
  { key: 'frequency', label: '频数统计', group: '描述统计', needs: { valueCols: 'single' } },
  { key: 'normality', label: '正态性检验', group: '描述统计', needs: { valueCols: 'multi' } },
  { key: 'grouped-stats', label: '分组统计', group: '描述统计', needs: { valueCols: 'multi', groupCol: true } },
  { key: 'ttest-independent', label: '独立样本 t 检验', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'ttest-paired', label: '配对 t 检验', group: '假设检验', needs: { paired: true } },
  { key: 'anova-oneway', label: '单因素 ANOVA', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'anova-multiway', label: '多因素 ANOVA', group: '假设检验', needs: { responseCol: true, factorCols: '2-3' } },
  { key: 'mann-whitney', label: 'Mann-Whitney U 检验', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'wilcoxon', label: 'Wilcoxon 符号秩检验', group: '假设检验', needs: { paired: true } },
  { key: 'kruskal-wallis', label: 'Kruskal-Wallis 检验', group: '假设检验', needs: { valueCols: 'single', groupCol: true } },
  { key: 'chi-square', label: '卡方检验', group: '假设检验', needs: { twoCats: true } },
  { key: 'correlation', label: '相关矩阵', group: '建模', needs: { valueCols: 'multi', method: true } },
  { key: 'linear-regression', label: '线性回归 (OLS)', group: '建模', needs: { xCols: 'multi', yCol: true } },
  { key: 'nonlinear-fit', label: '非线性拟合', group: '建模', needs: { xCols: 'single', yCol: true, model: true } },
  { key: 'rsm', label: '响应面分析 (RSM)', group: '建模', needs: { factorCols: '2-3', responseCol: true } },
  { key: 'pca', label: '主成分分析 (PCA)', group: '建模', needs: { valueCols: 'multi' } },
  { key: 'pipeline', label: '全流程分析', group: '综合', needs: { valueCols: 'multi', groupCol: true, factorCols: '2-3', responseCol: true, pipeline: true } },
];

interface AnalysisSession {
  id: string;
  datasetId: string;
  analysisType: AnalysisType;
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
  running: boolean;
  results: AnalysisResultData | null;
  checkedOutputs: string[];
  rsmEqForm: 'coded' | 'actual';
}

function newSession(id: string, datasetId: string, type: AnalysisType): AnalysisSession {
  return {
    id, datasetId, analysisType: type,
    valueCols: [], xCols: [], factorCols: [],
    pipelineModels: ['correlation', 'rsm', 'pca'],
    corrMethod: 'pearson', modelName: 'exp',
    running: false, results: null,
    checkedOutputs: defaultCheckedOutputs(type),
    rsmEqForm: 'coded',
  };
}

export default function AnalysisPage() {
  const { currentDataset, datasetList } = useDataStore();
  const { addRecord } = useHistoryStore();
  const { addChart } = useChartStore();
  const alpha = useSettingsStore((s) => s.alpha);
  const digits = useSettingsStore((s) => s.significantDigits);

  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const chartRefs = useRef<Record<string, ReactECharts | null>>({});

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeDef = activeSession ? ANALYSES.find((a) => a.key === activeSession.analysisType) : null;

  const sessionDataset = useCallback((s: AnalysisSession) =>
    datasetList.find((d) => d.id === s.datasetId) ?? currentDataset, [datasetList, currentDataset]);

  const sessionCols = useCallback((s: AnalysisSession) => {
    const ds = sessionDataset(s);
    if (!ds?.columns) return { numericCols: [] as string[], catCols: [] as string[] };
    return {
      numericCols: ds.columns.filter((c) => c.type === 'numeric' && c.role !== 'metadata' && c.role !== 'unknown').map((c) => c.name),
      catCols: ds.columns.filter((c) => c.type === 'categorical' && c.role !== 'metadata' && c.role !== 'unknown').map((c) => c.name),
    };
  }, [sessionDataset]);

  const createSession = useCallback((type: AnalysisType | null, datasetId?: string): string => {
    const id = generateId();
    const dsId = datasetId ?? currentDataset?.id ?? datasetList[0]?.id ?? '';
    const sess = newSession(id, dsId, type ?? 'descriptive');
    setSessions((prev) => [...prev, sess]);
    setActiveSessionId(id);
    return id;
  }, [currentDataset, datasetList]);

  const updateSession = useCallback((id: string, patch: Partial<AnalysisSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveSessionId((cur) => (cur === id ? (next.length ? next[next.length - 1].id : null) : cur));
      return next;
    });
  }, []);

  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const runSession = useCallback(async (sessionId: string) => {
    const session = sessionsRef.current.find((s) => s.id === sessionId);
    if (!session) return;
    const ds = sessionDataset(session);
    if (!ds) { message.warning('数据集不存在'); return; }
    const { numericCols } = sessionCols(session);
    updateSession(sessionId, { running: true, results: null });
    try {
      const result = computeAnalysis({
        analysisType: session.analysisType,
        rows: ds.rows,
        alpha,
        numericCols,
        valueCols: session.valueCols,
        groupCol: session.groupCol,
        xCols: session.xCols,
        yCol: session.yCol,
        factorCols: session.factorCols,
        responseCol: session.responseCol,
        pairedCol1: session.pairedCol1,
        pairedCol2: session.pairedCol2,
        corrMethod: session.corrMethod,
        modelName: session.modelName,
        pipelineModels: session.pipelineModels,
      });
      updateSession(sessionId, { results: result });

      const config: AnalysisConfig = {
        type: session.analysisType, datasetId: ds.id,
        valueCols: session.valueCols.length ? session.valueCols : undefined,
        groupCol: session.groupCol,
        xCols: session.xCols.length ? session.xCols : undefined,
        yCol: session.yCol,
        factorCols: session.factorCols.length ? session.factorCols : undefined,
        responseCol: session.responseCol,
        method: session.corrMethod, modelName: session.modelName,
        pairedCol1: session.pairedCol1, pairedCol2: session.pairedCol2, alpha,
      };
      const recordId = generateId();
      await addRecord({
        id: recordId, analysisConfig: config,
        result: { id: generateId(), config, tables: result.tables, conclusion: result.conclusion, chartData: result.chartData, timestamp: Date.now() },
        datasetName: ds.name, relatedChartIds: [], note: '', createdAt: Date.now(),
      });
    } catch (e) {
      message.error('分析失败：' + String(e));
    } finally {
      updateSession(sessionId, { running: false });
    }
  }, [alpha, sessionDataset, sessionCols, updateSession, addRecord]);

  const runSessionRef = useRef<(id: string) => Promise<void>>(async () => {});
  useEffect(() => { runSessionRef.current = runSession; });

  const location = useLocation();
  const bootstrapped = useRef(false);
  // 首次进入：若有"重新分析"预填则创建对应会话并自动运行；否则创建默认会话
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const prefill = (location.state as { prefill?: AnalysisConfig } | null)?.prefill;
    if (prefill) {
      const id = createSession(prefill.type);
      updateSession(id, {
        valueCols: prefill.valueCols ?? [],
        groupCol: prefill.groupCol,
        xCols: prefill.xCols ?? [],
        yCol: prefill.yCol,
        factorCols: prefill.factorCols ?? [],
        responseCol: prefill.responseCol,
        pairedCol1: prefill.pairedCol1,
        pairedCol2: prefill.pairedCol2,
        corrMethod: prefill.method ?? 'pearson',
        modelName: prefill.modelName ?? 'exp',
      });
      const t = setTimeout(() => { void runSessionRef.current(id); }, 60);
      return () => clearTimeout(t);
    }
    createSession(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMethodClick = (key: AnalysisType) => {
    const s = activeSession;
    const pristine = !!s && !s.running && !s.results
      && !s.valueCols.length && !s.xCols.length && !s.factorCols.length
      && !s.pairedCol1 && !s.pairedCol2 && !s.groupCol && !s.yCol && !s.responseCol;
    if (pristine) {
      updateSession(s.id, { analysisType: key, checkedOutputs: defaultCheckedOutputs(key) });
    } else {
      createSession(key);
    }
  };

  const saveChartToModule = async (chartData: ChartDataSource, sourceAnalysisId?: AnalysisType) => {
    if (!currentDataset) { message.warning('无当前数据集'); return; }
    const cfg: ChartConfig = {
      id: generateId(), title: chartData.title, chartType: chartData.chartType as ChartType,
      datasetId: currentDataset.id, columnMapping: {}, echartsOption: chartData.data as Record<string, unknown>,
      colorScheme: 'grayscale', legendPosition: 'right', fontSize: 0,
      xAxisLabel: '', yAxisLabel: '', createdAt: Date.now(),
      sourceAnalysisId,
    };
    await addChart(cfg);
    message.success('图表已保存');
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const renderModule = (mod: RenderedModule, session: AnalysisSession) => {
    const exportMod = () => {
      downloadCsv(moduleToCsv(mod, session.rsmEqForm), `module-${session.analysisType}-${mod.key}-${Date.now()}.csv`);
      message.success('已导出 CSV');
    };
    const copyMod = () => {
      navigator.clipboard.writeText(moduleToCsv(mod, session.rsmEqForm))
        .then(() => message.success('已复制到剪贴板')).catch(() => message.error('复制失败'));
    };
    return (
      <div key={mod.key} className="border border-[var(--color-border-light)] rounded-lg p-3 bg-[var(--bg-secondary)] mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Text strong style={{ fontSize: 12 }}>{mod.label}</Text>
          <Space size={4}>
            <Button size="small" icon={<DownloadOutlined />} onClick={exportMod}>导出</Button>
            <Button size="small" icon={<CopyOutlined />} onClick={copyMod}>复制</Button>
          </Space>
        </div>
        {mod.tables?.map((t, ti) => (
          <div key={ti} style={{ marginBottom: 10 }}>
            <Text strong style={{ fontSize: 12 }}>{t.title}</Text>
            <Table
              columns={t.headers.map((h, hi) => ({
                title: h, dataIndex: h, key: h,
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
        ))}
        {mod.equation && (
          <Alert type="info" showIcon style={{ marginBottom: 10 }} message={
            <Space direction="vertical" size={4}>
              <Space size={8}>
                <Text strong style={{ fontSize: 12 }}>回归方程</Text>
                {session.analysisType === 'rsm' && (
                  <Radio.Group size="small" value={session.rsmEqForm}
                    onChange={(e) => updateSession(session.id, { rsmEqForm: e.target.value as 'coded' | 'actual' })}>
                    <Radio.Button value="coded">编码变量</Radio.Button>
                    <Radio.Button value="actual">实际变量</Radio.Button>
                  </Radio.Group>
                )}
              </Space>
              <Text code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {session.rsmEqForm === 'coded' ? mod.equation.coded : mod.equation.actual}
              </Text>
              {session.rsmEqForm === 'coded' && (mod.equation.codedDefs ?? []).length > 0 &&
                <Text type="secondary" style={{ fontSize: 11 }}>{(mod.equation.codedDefs ?? []).join('　')}</Text>}
            </Space>
          } />
        )}
        {mod.optimal !== undefined && (mod.optimal ? (
          <Alert type="success" showIcon style={{ marginBottom: 10 }} message={
            <Space direction="vertical" size={2}>
              <Text>最优响应 = <Text strong style={{ fontFamily: 'Times New Roman', fontSize: 14 }}>{formatNumber(mod.optimal.y, digits)}</Text></Text>
              <Text style={{ fontSize: 12 }}>条件：{mod.optimal.values}{mod.optimal.boundary ? '（边界最优）' : '（域内驻点）'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>95% 预测区间：{mod.optimal.predInterval}</Text>
            </Space>
          } />
        ) : <Alert type="warning" showIcon message="未找到解析最优解（模型奇异或驻点在实验域外）" style={{ marginBottom: 10 }} />)}
        {mod.conclusion && <Alert type="success" message={mod.conclusion} style={{ marginBottom: 10 }} />}
        {mod.chart && (
          <div>
            <div className="glass-card" style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
              <ReactECharts
                ref={(e) => { chartRefs.current[`${session.id}:${mod.key}`] = e; }}
                option={mod.chart.data as Record<string, unknown>} style={{ height: 340, background: '#fff' }} notMerge />
            </div>
            <Space style={{ marginTop: 8 }}>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => {
                const inst = chartRefs.current[`${session.id}:${mod.key}`]?.getEchartsInstance();
                if (inst) exportPNG(inst, mod.chart!.title); else message.warning('图表未就绪');
              }}>导出 PNG</Button>
              <Button size="small" icon={<SaveOutlined />} onClick={() => saveChartToModule(mod.chart!, session.analysisType)}>保存到图表模块</Button>
            </Space>
          </div>
        )}
      </div>
    );
  };

  const renderSlot = (label: string, mode: 'single' | 'multi' | undefined, value: string[] | string | undefined,
    onChange: (v: string[] | string | undefined) => void, options: string[]) => {
    if (mode === 'single') return <Space><Text style={{ fontSize: 12 }}>{label}:</Text><Select size="small" style={{ width: 160 }} value={value as string || undefined} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} allowClear placeholder={`选择 ${label}`} /></Space>;
    if (mode === 'multi') return <Space><Text style={{ fontSize: 12 }}>{label}:</Text><Select size="small" mode="multiple" style={{ minWidth: 180 }} value={(value as string[]) || []} onChange={(v) => onChange(v)} options={options.map((o) => ({ label: o, value: o }))} placeholder={`选择 ${label}`} /></Space>;
    return null;
  };

  if (datasetList.length === 0 && !currentDataset) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader title="实验数据分析" description="选择统计方法和数据列进行分析" />
        <EmptyState description="请先导入数据" actionText="前往导入 →" actionPath="/import" />
      </div>
    );
  }

  const groups = [...new Set(ANALYSES.map((a) => a.group))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="实验数据分析" description="多个数据集可并行分析，勾选 √ 控制输出内容">
        <span className="tag text-accent-text border-accent-border bg-accent-light">α = {alpha}</span>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: analysis menu */}
        <div className="lg:col-span-1 glass-card-static p-3 h-fit">
          <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 px-2">分析方法</h3>
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-2 mb-1">{g}</p>
              <div className="space-y-0.5">
                {ANALYSES.filter((a) => a.group === g).map((a) => (
                  <button
                    key={a.key}
                    onClick={() => handleMethodClick(a.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                      activeSession?.analysisType === a.key
                        ? 'bg-accent-light text-accent-text border border-accent-border'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-light)] border border-transparent'
                    }`}
                  >{a.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Center: result cards */}
        <div className="lg:col-span-3">
          {sessions.length === 0 ? (
            <div className="glass-card-static p-8 flex justify-center">
              <Empty description="点击左侧方法或右侧『添加分析』开始" />
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {sessions.map((s) => {
                const ds = sessionDataset(s);
                const def = ANALYSES.find((a) => a.key === s.analysisType);
                const isActive = s.id === activeSessionId;
                const modules = s.results ? applyOutputFilter(s.analysisType, s.results, s.checkedOutputs, { modelName: s.modelName }) : [];
                return (
                  <div key={s.id}
                    className={`glass-card-static p-4 cursor-pointer transition-all ${isActive ? 'ring-1 ring-accent-border' : 'hover:ring-1 hover:ring-[var(--color-border)]'}`}
                    onClick={() => setActiveSessionId(s.id)}>
                    <div className="flex items-center justify-between gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 13 }}>{def?.label ?? s.analysisType}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{ds?.name ?? '（数据集已删除）'}</Text>
                        {s.running && <Spin size="small" />}
                      </Space>
                      <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => removeSession(s.id)} />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {s.running ? (
                        <div className="flex justify-center py-8"><Spin /></div>
                      ) : s.results ? (
                        modules.length > 0 ? (
                          modules.map((m) => renderModule(m, s))
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未勾选输出项，请在右侧功能栏勾选 √" />
                        )
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行分析后在此展示结果" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: session control + output checklist */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card-static p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">分析会话</h3>
              <Button size="small" type="primary" ghost icon={<PlusOutlined />}
                onClick={() => createSession(activeSession?.analysisType ?? null)}>添加分析</Button>
            </div>
            {sessions.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>暂无会话</Text>}
            <div className="space-y-1">
              {sessions.map((s) => {
                const def = ANALYSES.find((a) => a.key === s.analysisType);
                const ds = sessionDataset(s);
                return (
                  <div key={s.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                      s.id === activeSessionId ? 'bg-accent-light text-accent-text border border-accent-border' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)] border border-transparent'
                    }`}
                    onClick={() => setActiveSessionId(s.id)}>
                    <span className="truncate">{def?.label} · {ds?.name ?? '无数据集'}</span>
                    <Button size="small" type="text" icon={<CloseOutlined />} onClick={(e) => { e.stopPropagation(); removeSession(s.id); }} />
                  </div>
                );
              })}
            </div>
          </div>

          {activeSession && activeDef && (
            <>
              <div className="glass-card-static p-4 max-h-[45vh] overflow-y-auto">
                <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">变量配置</h3>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space>
                    <Text style={{ fontSize: 12 }}>数据集:</Text>
                    <Select size="small" style={{ width: 180 }} value={activeSession.datasetId}
                      onChange={(v) => updateSession(activeSession.id, { datasetId: v })}
                      options={datasetList.map((d) => ({ label: d.name, value: d.id }))} />
                  </Space>
                  <Space>
                    <Text style={{ fontSize: 12 }}>方法:</Text>
                    <Select size="small" style={{ width: 180 }} value={activeSession.analysisType}
                      onChange={(v) => updateSession(activeSession.id, { analysisType: v as AnalysisType, checkedOutputs: defaultCheckedOutputs(v as AnalysisType) })}
                      options={ANALYSES.map((a) => ({ label: a.label, value: a.key }))} />
                  </Space>
                  {(() => {
                    const { numericCols, catCols } = sessionCols(activeSession);
                    return (
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        {activeDef.needs.valueCols && renderSlot('变量', activeDef.needs.valueCols, activeSession.valueCols, (v) => updateSession(activeSession.id, { valueCols: Array.isArray(v) ? v : v ? [v] : [] }), numericCols)}
                        {activeDef.needs.groupCol && renderSlot('分组列', 'single', activeSession.groupCol, (v) => updateSession(activeSession.id, { groupCol: v as string | undefined }), catCols)}
                        {activeDef.needs.xCols && renderSlot('自变量 X', activeDef.needs.xCols, activeSession.xCols, (v) => updateSession(activeSession.id, { xCols: Array.isArray(v) ? v : v ? [v] : [] }), numericCols)}
                        {activeDef.needs.yCol && renderSlot('因变量 Y', 'single', activeSession.yCol, (v) => updateSession(activeSession.id, { yCol: v as string | undefined }), numericCols)}
                        {activeDef.needs.factorCols && renderSlot('因素列(2-3个)', 'multi', activeSession.factorCols, (v) => updateSession(activeSession.id, { factorCols: Array.isArray(v) ? v : [] }), activeDef.key === 'anova-multiway' ? catCols : numericCols)}
                        {activeDef.needs.responseCol && renderSlot('响应列', 'single', activeSession.responseCol, (v) => updateSession(activeSession.id, { responseCol: v as string | undefined }), numericCols)}
                        {activeDef.needs.twoCats && (<>
                          {renderSlot('行变量（分类）', 'single', activeSession.valueCols[0], (v) => updateSession(activeSession.id, { valueCols: [v as string, activeSession.valueCols[1]] }), catCols)}
                          {renderSlot('列变量（可选，留空=拟合优度检验）', 'single', activeSession.valueCols[1], (v) => updateSession(activeSession.id, { valueCols: [activeSession.valueCols[0], v as string] }), catCols)}
                        </>)}
                        {activeDef.needs.paired && (<>
                          {renderSlot('配对列1', 'single', activeSession.pairedCol1, (v) => updateSession(activeSession.id, { pairedCol1: v as string | undefined }), numericCols)}
                          {renderSlot('配对列2', 'single', activeSession.pairedCol2, (v) => updateSession(activeSession.id, { pairedCol2: v as string | undefined }), numericCols.filter((c) => c !== activeSession.pairedCol1))}
                        </>)}
                        {activeDef.needs.method && <Space><Text style={{ fontSize: 12 }}>方法:</Text><Select size="small" style={{ width: 120 }} value={activeSession.corrMethod} onChange={(v) => updateSession(activeSession.id, { corrMethod: v })} options={[{ label: 'Pearson', value: 'pearson' }, { label: 'Spearman', value: 'spearman' }, { label: 'Kendall', value: 'kendall' }]} /></Space>}
                        {activeDef.needs.model && <Space><Text style={{ fontSize: 12 }}>模型:</Text><Select size="small" style={{ width: 120 }} value={activeSession.modelName} onChange={(v) => updateSession(activeSession.id, { modelName: v })} options={[{ label: '指数', value: 'exp' }, { label: '幂函数', value: 'power' }, { label: 'Gaussian', value: 'gauss' }, { label: '线性', value: 'linear' }]} /></Space>}
                        {activeDef.needs.pipeline && (
                          <Space direction="vertical" size={2}>
                            <Text style={{ fontSize: 12 }}>高级建模选项:</Text>
                            <Checkbox.Group value={activeSession.pipelineModels} onChange={(v) => updateSession(activeSession.id, { pipelineModels: v as string[] })}
                              options={[
                                { label: '相关矩阵', value: 'correlation' },
                                { label: '响应面 (RSM)', value: 'rsm' },
                                { label: '主成分 (PCA)', value: 'pca' },
                              ]} />
                          </Space>
                        )}
                      </Space>
                    );
                  })()}
                </Space>
              </div>

              <div className="glass-card-static p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">输出项 (√ 控制)</h3>
                  <Space size={4}>
                    <Button size="small" onClick={() => updateSession(activeSession.id, { checkedOutputs: OUTPUT_MODULES[activeSession.analysisType]?.map((m) => m.key) ?? [] })}>全选</Button>
                    <Button size="small" onClick={() => updateSession(activeSession.id, { checkedOutputs: [] })}>清空</Button>
                  </Space>
                </div>
                <Checkbox.Group style={{ width: '100%' }} value={activeSession.checkedOutputs}
                  onChange={(v) => updateSession(activeSession.id, { checkedOutputs: v as string[] })}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    {(OUTPUT_MODULES[activeSession.analysisType] ?? []).map((m) => (
                      <Checkbox key={m.key} value={m.key} style={{ width: '100%' }}>
                        <span style={{ fontSize: 12 }}>{m.label}</span>
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
                <Button type="primary" block icon={<PlayCircleOutlined />} style={{ marginTop: 12 }}
                  disabled={activeSession.running}
                  onClick={() => void runSession(activeSession.id)}>
                  {activeSession.running ? '运行中…' : '运行分析'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}