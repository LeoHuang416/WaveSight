import { useState } from 'react';
import { Card, Button, Input, Select, Space, Typography, Empty, Popconfirm, message, Radio, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined, DownloadOutlined, ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import PageHeader from '@/components/layout/PageHeader';
import { useChartStore } from '@/stores/useChartStore';
import { useDataStore } from '@/stores/useDataStore';
import { exportPNG, exportSVG, exportCSV, exportXLSX } from '@/utils/export';
import { useHotkeys } from '@/hooks/useHotkeys';
import { generateId } from '@/utils/format';
import { buildChartOption } from '@/engine/chartBuilders';
import type { ChartConfig, ChartType, ColorScheme, LegendPosition } from '@/types/chart';

const { Text } = Typography;
const { Search } = Input;

const CHART_LABELS: Record<ChartType, string> = {
  bar: '柱状图', line: '折线图', scatter: '散点图', area: '面积图',
  boxplot: '箱线图', violin: '小提琴图', errorbar: '误差棒图', qq: 'Q-Q 图',
  heatmap: '热力图', contour: '等高线图', surface3d: '3D 曲面图', histogram: '直方图',
};

/** 把编辑器配置（轴标签/轴范围/图例位置/字号/动画）合并进任意 ECharts option */
export function applyEditor(option: Record<string, unknown> | undefined, c: ChartConfig): Record<string, unknown> {
  if (!option || typeof option !== 'object') return option ?? {};
  const out = { ...option };
  if (c.fontSize && out.title && typeof out.title === 'object') {
    const t = out.title as Record<string, unknown>;
    out.title = { ...t, textStyle: { ...((t.textStyle as Record<string, unknown>) ?? {}), fontSize: c.fontSize } };
  }
  const decorate = (axis: unknown, name: string | undefined, rangeMin: number | undefined, rangeMax: number | undefined): unknown => {
    if (!axis || typeof axis !== 'object') return axis;
    const a = { ...(axis as Record<string, unknown>) };
    if (name) a.name = name;
    if (rangeMin !== undefined && !isNaN(rangeMin)) a.min = rangeMin;
    if (rangeMax !== undefined && !isNaN(rangeMax)) a.max = rangeMax;
    if (c.fontSize) {
      a.nameTextStyle = { ...((a.nameTextStyle as Record<string, unknown>) ?? {}), fontSize: c.fontSize };
      a.axisLabel = { ...((a.axisLabel as Record<string, unknown>) ?? {}), fontSize: c.fontSize };
    }
    return a;
  };
  const decorateKey = (key: 'xAxis' | 'yAxis', name: string | undefined) => {
    const raw = out[key];
    if (Array.isArray(raw)) out[key] = raw.map((ax) => decorate(ax, name, key === 'yAxis' ? c.yAxisMin : undefined, key === 'yAxis' ? c.yAxisMax : undefined));
    else out[key] = decorate(raw, name, key === 'yAxis' ? c.yAxisMin : undefined, key === 'yAxis' ? c.yAxisMax : undefined);
  };
  decorateKey('xAxis', c.xAxisLabel);
  decorateKey('yAxis', c.yAxisLabel);
  if (c.legendPosition && c.legendPosition !== 'right') {
    const pos = c.legendPosition === 'top' ? { top: 5 }
      : c.legendPosition === 'bottom' ? { bottom: 5 }
      : c.legendPosition === 'left' ? { left: 5 }
      : { right: 5 };
    out.legend = { ...((out.legend as Record<string, unknown>) ?? {}), ...pos };
  }
  // 动画/过渡效果（动画时长 + 缓动，V2）
  if (c.animationDuration !== undefined) out.animationDuration = c.animationDuration;
  if (c.animationEasing) out.animationEasing = c.animationEasing;
  return out;
}

/** 图表模块入口：与 RSM 分析模块共用 buildRsmCharts 同款绘制代码（等高线/3D曲面/热力图） */
function simpleOption(
  dataset: ReturnType<typeof useDataStore.getState>['currentDataset'],
  chartType: ChartType,
  title: string,
  colorScheme: ColorScheme,
  columnMapping?: Record<string, string>,
): Record<string, unknown> {
  if (!dataset) return { title: { text: title, left: 'center' } };
  return buildChartOption({
    rows: dataset.rows,
    columns: dataset.columns,
    experimentGroupCol: dataset.experimentGroupCol,
    chartType,
    title,
    colorScheme,
    columnMapping,
  });
}

/**
 * 计算图表渲染用 option（问题2）：
 * 函数型 option（renderItem/formatter）无法持久化（存储时被剥离），等高线/3D曲面/热力图
 * 在数据集存在且匹配时用图表配置实时重建（走 buildRsmCharts 与分析模块同款代码），
 * 保证两模块图一致且可正常导出 PNG；重建失败则回退到存储的剥离版 option。
 */
export function buildRenderOption(
  c: ChartConfig,
  dataset: ReturnType<typeof useDataStore.getState>['currentDataset'],
): Record<string, unknown> {
  const needs = c.chartType === 'contour' || c.chartType === 'surface3d' || c.chartType === 'heatmap';
  if (needs && dataset && c.datasetId === dataset.id) {
    try { return applyEditor(simpleOption(dataset, c.chartType, c.title, c.colorScheme, c.columnMapping as Record<string, string>), c); }
    catch { /* 重建失败则回退到存储的剥离版 option */ }
  }
  return applyEditor(c.echartsOption, c);
}

export default function ChartsPage() {
  const { charts, viewMode, editingChartId, setViewMode, setEditingChart, addChart, removeChart } = useChartStore();
  const currentDataset = useDataStore((s) => s.currentDataset);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChartType | 'all'>('all');
  const [echartsRef, setEchartsRef] = useState<ReactECharts | null>(null);

  const editingChart = charts.find((c) => c.id === editingChartId) ?? null;
  useHotkeys([
    { combo: 'ctrl+s', callback: () => { if (echartsRef && editingChart) exportPNG(echartsRef.getEchartsInstance(), editingChart.title); } },
    { combo: 'ctrl+e', callback: () => { if (currentDataset && editingChart) exportXLSX(currentDataset.columns.map((c) => c.name), currentDataset.rows.map((r) => currentDataset.columns.map((c) => typeof r[c.name] === 'number' ? r[c.name] as number : String(r[c.name] ?? ''))), editingChart.title); } },
  ]);
  const filtered = charts.filter((c) => (!search || c.title.includes(search)) && (typeFilter === 'all' || c.chartType === typeFilter));
  // 函数型 option（renderItem/formatter）无法持久化（存储时被剥离），读取时用图表配置实时重建。
  // 等高线/3D曲面/热力图统一走 buildRsmCharts（与分析模块同款代码），保证两模块图一致且可导出。
  const renderOption = (c: ChartConfig): Record<string, unknown> => buildRenderOption(c, currentDataset);

  const handleNew = () => {
    if (!currentDataset) { message.warning('请先导入数据'); return; }
    const cfg: ChartConfig = {
      id: generateId(), title: '新建图表', chartType: 'bar', datasetId: currentDataset.id,
      columnMapping: {}, echartsOption: simpleOption(currentDataset, 'bar', '新建图表', 'grayscale'),
      colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12,
      xAxisLabel: '', yAxisLabel: '', animationDuration: 1000, animationEasing: 'cubicOut', createdAt: Date.now(),
    };
    addChart(cfg); setEditingChart(cfg.id);
  };

  if (viewMode === 'editor' && editingChartId) {
    const chart = charts.find((c) => c.id === editingChartId);
    if (!chart) { setViewMode('gallery'); return null; }
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto flex flex-wrap gap-6">
        <div style={{ flex: '1 1 400px' }}>
          <button className="btn-secondary text-xs mb-3" onClick={() => setViewMode('gallery')}>
            <ArrowLeftOutlined /> 返回画廊
          </button>
          <div className="glass-card-static p-4">
            <ReactECharts ref={(e) => setEchartsRef(e as ReactECharts)} option={renderOption(chart)} style={{ height: 420, background: '#fff', borderRadius: 12 }} notMerge />
          </div>
        </div>
        <div style={{ width: 220 }}>
          <Card className="glass-card" size="small" title="编辑图表" bodyStyle={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input addonBefore="标题" value={chart.title} onChange={(e) => addChart({ ...chart, title: e.target.value, echartsOption: { ...chart.echartsOption as Record<string, unknown>, title: { text: e.target.value, left: 'center' } } })} />
              <Select value={chart.chartType} style={{ width: '100%' }} onChange={(v: ChartType) => addChart({ ...chart, chartType: v, echartsOption: simpleOption(currentDataset, v, chart.title, chart.colorScheme, chart.columnMapping as Record<string, string>) })} options={Object.entries(CHART_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
              {(chart.chartType === 'surface3d' || chart.chartType === 'contour' || chart.chartType === 'heatmap') && currentDataset && (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>X 轴标签（留空自动）</Text>
                <Input size="small" value={chart.xAxisLabel} placeholder="X 轴名称" onChange={(e) => addChart({ ...chart, xAxisLabel: e.target.value })} />
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>Y 轴标签（留空自动）</Text>
                <Input size="small" value={chart.yAxisLabel} placeholder="Y 轴名称" onChange={(e) => addChart({ ...chart, yAxisLabel: e.target.value })} />
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>Y 轴范围（留空自动）</Text>
                <div style={{ display: 'flex', gap: 8 }}>
                  <InputNumber size="small" style={{ width: '100%' }} placeholder="min" value={chart.yAxisMin}
                    onChange={(v) => addChart({ ...chart, yAxisMin: v ?? undefined })} />
                  <InputNumber size="small" style={{ width: '100%' }} placeholder="max" value={chart.yAxisMax}
                    onChange={(v) => addChart({ ...chart, yAxisMax: v ?? undefined })} />
                </div>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>图例位置</Text>
                <Select size="small" value={chart.legendPosition} onChange={(v: LegendPosition) => addChart({ ...chart, legendPosition: v })}
                  options={[{ label: '右上', value: 'right' }, { label: '上', value: 'top' }, { label: '下', value: 'bottom' }, { label: '左', value: 'left' }]} />
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>字体大小</Text>
                <Select size="small" value={chart.fontSize} onChange={(v: number) => addChart({ ...chart, fontSize: v })}
                  options={[10, 12, 14, 16, 18, 20].map((n) => ({ label: `${n}px`, value: n }))} />
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>动画时长</Text>
                <Select size="small" value={chart.animationDuration ?? 1000} onChange={(v: number) => addChart({ ...chart, animationDuration: v })}
                  options={[{ label: '关闭', value: 0 }, { label: '0.3 秒', value: 300 }, { label: '1 秒', value: 1000 }, { label: '2 秒', value: 2000 }]} />
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>动画缓动</Text>
                <Select size="small" value={chart.animationEasing ?? 'cubicOut'} onChange={(v: string) => addChart({ ...chart, animationEasing: v })}
                  options={[{ label: '线性', value: 'linear' }, { label: '三次缓出', value: 'cubicOut' }, { label: '回弹', value: 'elasticOut' }, { label: '弹跳', value: 'bounceOut' }]} />
                <Button icon={<DownloadOutlined />} onClick={() => echartsRef && exportPNG(echartsRef.getEchartsInstance(), chart.title)} block>导出 PNG</Button>
                <Button icon={<DownloadOutlined />} onClick={() => { if (echartsRef) { if (!exportSVG(echartsRef.getEchartsInstance(), chart.title)) message.warning('3D 图表不支持 SVG 导出，请使用 PNG'); } }} block>导出 SVG</Button>
                <Button icon={<DownloadOutlined />} onClick={() => { if (currentDataset) exportCSV(currentDataset.columns.map((c) => c.name), currentDataset.rows.map((r) => currentDataset.columns.map((c) => String(r[c.name] ?? ''))), chart.title); }} block>导出 CSV</Button>
                <Button icon={<DownloadOutlined />} onClick={() => { if (currentDataset) exportXLSX(currentDataset.columns.map((c) => c.name), currentDataset.rows.map((r) => currentDataset.columns.map((c) => typeof r[c.name] === 'number' ? r[c.name] as number : String(r[c.name] ?? ''))), chart.title); }} block>导出 Excel</Button>
                <Button icon={<PlayCircleOutlined />} onClick={() => { const inst = echartsRef?.getEchartsInstance(); if (inst) { inst.dispatchAction({ type: 'restore' }); setTimeout(() => inst.setOption(renderOption(chart), { notMerge: true }), 60); } }} block>重播动画</Button>
                <Popconfirm title="确认删除?" onConfirm={() => { removeChart(chart.id); setViewMode('gallery'); }}><Button danger icon={<DeleteOutlined />} block>删除</Button></Popconfirm>
              </div>
            </Space>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="实验图表" description="12 种可视化类型，交互式探索与导出">
        <div className="flex flex-wrap items-center gap-2">
          <Search placeholder="搜索图表..." onSearch={setSearch} style={{ width: 180 }} />
          <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }} options={[{ label: '全部', value: 'all' }, ...Object.entries(CHART_LABELS).map(([k, v]) => ({ label: v, value: k }))]} />
          <button className="btn-primary text-sm" onClick={handleNew}><PlusOutlined /> 新建图表</button>
        </div>
      </PageHeader>
      <div className="glass-card-static p-5">
        {filtered.length === 0 ? <Empty description={charts.length === 0 ? '暂无图表，分析数据后保存图表或点击"新建图表"' : '无匹配结果'} /> :
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filtered.map((c) => (
              <div key={c.id} className="glass-card overflow-hidden cursor-pointer group" onClick={() => setEditingChart(c.id)}>
                <div className="h-36 overflow-hidden bg-white">
                  <ReactECharts option={renderOption(c)} style={{ height: 144, background: '#fff' }} notMerge />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-accent-text">{c.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="tag text-xs">{CHART_LABELS[c.chartType]}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(c.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
