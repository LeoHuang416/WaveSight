import { useState } from 'react';
import { Card, InputNumber, Radio, Select, Switch, Button, Space, Typography, message, Modal, Input, Statistic } from 'antd';
import { ExportOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getStorageStats, exportAllData, clearAllData } from '@/db/operations';
import { exportAllDataJSON } from '@/utils/export';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { alpha, significantDigits, defaultColorScheme, defaultExportFormat, autoCleanHistory, historyRetentionDays,
    setAlpha, setSignificantDigits, setDefaultColorScheme, setDefaultExportFormat, setAutoCleanHistory, setHistoryRetentionDays } = useSettingsStore();
  const [stats, setStats] = useState({ datasetCount: 0, chartCount: 0, historyCount: 0 });

  const loadStats = async () => setStats(await getStorageStats());
  loadStats();

  const handleExport = async () => {
    const data = await exportAllData();
    exportAllDataJSON(data);
    message.success('数据已导出');
  };

  const handleClear = () => {
    Modal.confirm({
      title: '此操作不可恢复',
      content: (
        <div>
          <p>将清空所有数据集、图表和历史记录。</p>
          <Input id="confirmInput" placeholder="输入'确认清空'以继续" />
        </div>
      ),
      onOk: async () => {
        const input = document.getElementById('confirmInput') as HTMLInputElement;
        if (input?.value === '确认清空') { await clearAllData(); message.success('已清空'); loadStats(); }
        else { message.error('输入不匹配'); return Promise.reject(); }
      },
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Title level={4}>设置</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>

        <Card title="分析默认值" size="small">
          <Space direction="vertical">
            <Space><Text>显著性水平 α</Text><InputNumber min={0.001} max={0.1} step={0.01} value={alpha} onChange={(v) => setAlpha(v ?? 0.05)} /></Space>
            <Space><Text>有效数字位数</Text><Select value={significantDigits} onChange={setSignificantDigits} style={{ width: 80 }} options={[2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n }))} /></Space>
          </Space>
        </Card>

        <Card title="图表默认值" size="small">
          <Space direction="vertical">
            <Space><Text>默认配色</Text><Radio.Group value={defaultColorScheme} onChange={(e) => setDefaultColorScheme(e.target.value)}><Radio value="grayscale">学术灰度</Radio><Radio value="color">彩色</Radio></Radio.Group></Space>
            <Space><Text>导出格式</Text><Select value={defaultExportFormat} onChange={setDefaultExportFormat} style={{ width: 100 }} options={[{ label: 'SVG', value: 'svg' }, { label: 'PNG', value: 'png' }]} /></Space>
          </Space>
        </Card>

        <Card title="历史记录" size="small">
          <Space direction="vertical">
            <Space><Text>自动清理</Text><Switch checked={autoCleanHistory} onChange={setAutoCleanHistory} /></Space>
            {autoCleanHistory && <Space><Text>保留天数</Text><InputNumber min={7} max={365} value={historyRetentionDays} onChange={(v) => setHistoryRetentionDays(v ?? 90)} /></Space>}
          </Space>
        </Card>

        <Card title="数据管理" size="small">
          <Space style={{ width: '100%' }} direction="vertical">
            <Space>
              <Statistic title="数据集" value={stats.datasetCount} />
              <Statistic title="图表" value={stats.chartCount} />
              <Statistic title="历史记录" value={stats.historyCount} />
            </Space>
            <Space>
              <Button icon={<ExportOutlined />} onClick={handleExport}>导出全部数据 (JSON)</Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleClear}>清空全部数据</Button>
            </Space>
          </Space>
        </Card>

        <Card title="关于" size="small">
          <Text>实验数据分析工作台 v1.0</Text><br />
          <Text type="secondary">本地运行，数据仅在当前电脑浏览器存储。无需联网。</Text>
        </Card>
      </Space>
    </div>
  );
}
