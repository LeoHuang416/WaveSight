import { useState } from 'react';
import { Card, Button, Input, Select, Space, Typography, Empty, Tag, Popconfirm, message, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useChartStore } from '@/stores/useChartStore';
import { useDataStore } from '@/stores/useDataStore';
import { exportPNG, exportCSV } from '@/utils/export';
import { generateId } from '@/utils/format';
import type { ChartConfig, ChartType, ColorScheme } from '@/types/chart';

const { Title, Text } = Typography;
const { Search } = Input;

const CHART_LABELS: Record<ChartType, string> = {
  bar: '柱状图', line: '折线图', scatter: '散点图', area: '面积图',
  boxplot: '箱线图', violin: '小提琴图', errorbar: '误差棒图', qq: 'Q-Q 图',
  heatmap: '热力图', contour: '等高线图', surface3d: '3D 曲面图', histogram: '直方图',
};

const GRAY = ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#d9d9d9', '#f0f0f0'];

function simpleOption(dataset: ReturnType<typeof useDataStore.getState>['currentDataset'], chartType: ChartType, title: string, colorScheme: ColorScheme): Record<string, unknown> {
  const colors = colorScheme === 'grayscale' ? GRAY : undefined;
  const base: Record<string, unknown> = { title: { text: title, left: 'center' }, color: colors, backgroundColor: '#fff' };
  if (!dataset) return base;
  const nums = dataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name);
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
            <ReactECharts ref={(e) => setEchartsRef(e as ReactECharts)} option={chart.echartsOption} style={{ height: 400, background: '#fff' }} notMerge />
          </div>
        </div>
        <div style={{ width: 220 }}>
          <Card className="glass-card" size="small" title="编辑图表" bodyStyle={{ padding: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input addonBefore="标题" value={chart.title} onChange={(e) => addChart({ ...chart, title: e.target.value, echartsOption: { ...chart.echartsOption as Record<string, unknown>, title: { text: e.target.value, left: 'center' } } })} />
              <Select value={chart.chartType} style={{ width: '100%' }} onChange={(v: ChartType) => addChart({ ...chart, chartType: v, echartsOption: simpleOption(currentDataset, v, chart.title, chart.colorScheme) })} options={Object.entries(CHART_LABELS).map(([k, v]) => ({ label: v, value: k }))} />
              <Radio.Group value={chart.colorScheme} onChange={(e) => { const v = e.target.value as ColorScheme; addChart({ ...chart, colorScheme: v, echartsOption: simpleOption(currentDataset, chart.chartType, chart.title, v) }); }}>
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
                cover={<div style={{ height: 140, overflow: 'hidden' }}><ReactECharts option={c.echartsOption} style={{ height: 140 }} notMerge /></div>}>
                <Card.Meta title={c.title} description={<><Tag>{CHART_LABELS[c.chartType]}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString('zh-CN')}</Text></>} />
              </Card>
            ))}
          </div>}
      </div>
    </div>
  );
}
