import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Timeline, Card, Space, Tag, Input, Select, Table, Button, Popconfirm, Empty, Descriptions, DatePicker } from 'antd';
import { DeleteOutlined, BarChartOutlined, EditOutlined } from '@ant-design/icons';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useDataStore } from '@/stores/useDataStore';
import { formatNumber } from '@/utils/format';
import type { HistoryRecord } from '@/types/history';
import type { AnalysisType } from '@/types/analysis';

const { Title, Text } = Typography;
const { Search } = Input;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const TYPE_LABELS: Record<AnalysisType, string> = {
  descriptive: '描述统计', frequency: '频数统计', normality: '正态性检验', 'grouped-stats': '分组统计',
  'ttest-independent': '独立样本 t 检验', 'ttest-paired': '配对 t 检验', 'anova-oneway': '单因素 ANOVA',
  correlation: '相关矩阵', 'linear-regression': '线性回归', 'nonlinear-fit': '非线性拟合',
  rsm: '响应面分析', pca: '主成分分析', pipeline: '全流程分析',
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { records, selectedId, setSelected, removeRecord, updateNote } = useHistoryStore();
  const { setCurrentDataset } = useDataStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const filtered = records.filter((r) => {
    if (search) { const t = r.analysisConfig.type ?? ''; if (!TYPE_LABELS[t]?.includes(search) && !r.datasetName.includes(search) && !r.note.includes(search)) return false; }
    if (typeFilter.length && !typeFilter.includes(r.analysisConfig.type ?? '')) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const m = new Map<string, HistoryRecord[]>();
    for (const r of filtered) {
      const day = new Date(r.createdAt).toLocaleDateString('zh-CN');
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(r);
    }
    return m;
  }, [filtered]);

  const selected = records.find((r) => r.id === selectedId);

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>历史记录</Title>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left sidebar – history list */}
        <div className="glass-card" style={{ width: 320, flexShrink: 0, padding: 16, overflow: 'hidden' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Search placeholder="搜索..." onSearch={setSearch} allowClear />
            <Select mode="multiple" placeholder="筛选分析类型" style={{ width: '100%' }} value={typeFilter} onChange={setTypeFilter}
              options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ label: v, value: k }))} allowClear />
          </Space>
          <div style={{ marginTop: 16, maxHeight: 'calc(100vh - 290px)', overflow: 'auto' }}>
            {filtered.length === 0 ? <Empty description="暂无记录" /> :
              Array.from(grouped.entries()).map(([day, items]) => (
                <div key={day} style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 12, color: '#999' }}>{day}</Text>
                  {items.map((r) => (
                    <Card key={r.id} size="small" hoverable className="glass-card"
                      style={{ marginTop: 4, background: selectedId === r.id ? '#e6f4ff' : undefined }}
                      onClick={() => setSelected(r.id)}>
                      <Space size={4}>
                        <Tag>{TYPE_LABELS[r.analysisConfig.type!] ?? r.analysisConfig.type}</Tag>
                        <Text style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </Space>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{r.result.conclusion.slice(0, 40)}</div>
                    </Card>
                  ))}
                </div>
              ))}
          </div>
        </div>

        {/* Right panel – detail view */}
        <div className="glass-card" style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {selected ? (
            <Card title={<Space>{TYPE_LABELS[selected.analysisConfig.type!]}<Tag>{new Date(selected.createdAt).toLocaleString('zh-CN')}</Tag></Space>}
              extra={<Space><Popconfirm title="删除?" onConfirm={() => removeRecord(selected.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>}
              style={{ border: 'none', background: 'transparent' }}>
              <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="数据集">{selected.datasetName}</Descriptions.Item>
                {selected.analysisConfig.valueCols && <Descriptions.Item label="变量">{selected.analysisConfig.valueCols.join(', ')}</Descriptions.Item>}
                {selected.analysisConfig.groupCol && <Descriptions.Item label="分组">{selected.analysisConfig.groupCol}</Descriptions.Item>}
                {selected.analysisConfig.yCol && <Descriptions.Item label="因变量">{selected.analysisConfig.yCol}</Descriptions.Item>}
                {selected.analysisConfig.xCols && <Descriptions.Item label="自变量">{selected.analysisConfig.xCols.join(', ')}</Descriptions.Item>}
                {selected.analysisConfig.modelName && <Descriptions.Item label="模型">{selected.analysisConfig.modelName}</Descriptions.Item>}
              </Descriptions>

              {selected.result.tables.map((t, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>{t.title}</Text>
                  <Table size="small" bordered pagination={false} scroll={{ x: 'max-content' }}
                    columns={t.headers.map((h) => ({ title: h, dataIndex: h, key: h }))}
                    dataSource={t.rows.map((row, ri) => { const o: Record<string, unknown> = { _key: ri }; t.headers.forEach((h, hi) => { o[h] = typeof row[hi] === 'number' ? formatNumber(row[hi] as number, 3) : row[hi]; }); return o; })} rowKey="_key" />
                </div>
              ))}

              {selected.result.conclusion && <Text style={{ color: '#1677ff' }}>{selected.result.conclusion}</Text>}

              <div style={{ marginTop: 12 }}>
                <TextArea rows={2} placeholder="添加备注..." value={selected.note} onChange={(e) => updateNote(selected.id, e.target.value)} />
              </div>

              <div style={{ marginTop: 8 }}>
                <Space>
                  {selected.relatedChartIds.length > 0 && <Button icon={<BarChartOutlined />} onClick={() => { navigate('/charts'); }}>查看关联图表 ({selected.relatedChartIds.length})</Button>}
                  <Button icon={<EditOutlined />} onClick={async () => {
                    const cfg = selected.analysisConfig;
                    await setCurrentDataset(cfg.datasetId);
                    navigate('/analysis');
                  }}>重新分析</Button>
                </Space>
              </div>
            </Card>
          ) : <Empty description="选择一条记录查看详情" />}
        </div>
      </div>
    </div>
  );
}
