import { useState, useEffect } from 'react';
import { Card, InputNumber, Radio, Select, Switch, Button, Space, Typography, message, Modal, Input, Statistic } from 'antd';
import { ExportOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { getStorageStats, exportAllData, clearAllData } from '@/db/operations';
import { exportAllDataJSON } from '@/utils/export';
import { THEMES, ACCENT_PRESETS, getAccentColor } from '@/themes';
import type { AppearanceMode, RowHeight, FontSize, DataAlign, EdgeSidebarMode, EdgePanelDefault, EdgeTabPosition, FluentGradient, FluentGlassStrength } from '@/stores/useSettingsStore';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const {
    uiTheme, appearanceMode, kimiRowHeight, kimiFontSize, kimiDataAlign,
    edgeSidebarMode, edgePanelDefault, edgeTabPosition, edgeCompactMode,
    accentColor, fluentGradient, fluentGlassStrength,
    alpha, significantDigits, defaultColorScheme, defaultExportFormat, autoCleanHistory, historyRetentionDays,
    setUiTheme, setAppearanceMode, setKimiRowHeight, setKimiFontSize, setKimiDataAlign,
    setEdgeSidebarMode, setEdgePanelDefault, setEdgeTabPosition, setEdgeCompactMode,
    setAccentColor, setFluentGradient, setFluentGlassStrength,
    setAlpha, setSignificantDigits, setDefaultColorScheme, setDefaultExportFormat, setAutoCleanHistory, setHistoryRetentionDays,
  } = useSettingsStore();

  const [stats, setStats] = useState({ datasetCount: 0, chartCount: 0, historyCount: 0 });
  const isKimi = uiTheme === 'kimi-minimal';
  const isEdge = uiTheme === 'edge-modern';
  const isFluent = uiTheme === 'fluent-glass';

  useEffect(() => { getStorageStats().then(setStats); }, []);

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
        if (input?.value === '确认清空') {
          await clearAllData();
          useDataStore.getState().setCurrentDataset(null);
          useDataStore.getState().refreshDatasetList();
          useChartStore.getState().refresh();
          useHistoryStore.getState().refresh();
          message.success('已清空');
          getStorageStats().then(setStats);
        }
        else { message.error('输入不匹配'); return Promise.reject(); }
      },
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>设置</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>

        {/* ─── Appearance ─── */}
        <Card title="外观" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space>
              <Text style={{ width: 80, display: 'inline-block' }}>界面风格</Text>
              <Radio.Group value={uiTheme} onChange={(e) => setUiTheme(e.target.value)}>
                <Space direction="vertical" size={4}>
                  {THEMES.map((t) => (
                    <Radio key={t.id} value={t.id}>{t.label} — {t.description}</Radio>
                  ))}
                </Space>
              </Radio.Group>
            </Space>

            <Space>
              <Text style={{ width: 80, display: 'inline-block' }}>外观模式</Text>
              <Radio.Group value={appearanceMode} onChange={(e) => setAppearanceMode(e.target.value as AppearanceMode)}>
                <Radio.Button value="system">跟随系统</Radio.Button>
                <Radio.Button value="light">浅色</Radio.Button>
                <Radio.Button value="dark">深色</Radio.Button>
              </Radio.Group>
            </Space>

            <Space>
              <Text style={{ width: 80, display: 'inline-block' }}>强调色</Text>
              <Radio.Group value={accentColor} onChange={(e) => setAccentColor(e.target.value)}>
                {ACCENT_PRESETS.map((p) => (
                  <Radio.Button key={p.id} value={p.id}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: p.color, marginRight: 4, verticalAlign: 'middle' }} />
                    {p.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Space>

            {/* ── Theme-specific advanced options ── */}
            <div style={{ borderTop: '1px solid #eee', margin: '4px 0', paddingTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>高级</Text>
            </div>

            {isKimi && (
              <Space direction="vertical" size={8}>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>行高</Text>
                  <Radio.Group value={kimiRowHeight} onChange={(e) => setKimiRowHeight(e.target.value as RowHeight)}>
                    <Radio.Button value="compact">紧凑 40px</Radio.Button>
                    <Radio.Button value="standard">标准 48px</Radio.Button>
                    <Radio.Button value="relaxed">宽松 56px</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>字体大小</Text>
                  <Radio.Group value={kimiFontSize} onChange={(e) => setKimiFontSize(e.target.value as FontSize)}>
                    <Radio.Button value="small">小 12px</Radio.Button>
                    <Radio.Button value="standard">标准 14px</Radio.Button>
                    <Radio.Button value="large">大 16px</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>数据对齐</Text>
                  <Radio.Group value={kimiDataAlign} onChange={(e) => setKimiDataAlign(e.target.value as DataAlign)}>
                    <Radio.Button value="auto">自动</Radio.Button>
                    <Radio.Button value="left">全部左对齐</Radio.Button>
                    <Radio.Button value="decimal">小数点对齐</Radio.Button>
                  </Radio.Group>
                </Space>
              </Space>
            )}

            {isEdge && (
              <Space direction="vertical" size={8}>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>侧边栏</Text>
                  <Radio.Group value={edgeSidebarMode} onChange={(e) => setEdgeSidebarMode(e.target.value as EdgeSidebarMode)}>
                    <Radio.Button value="always">常驻</Radio.Button>
                    <Radio.Button value="auto">自动收起</Radio.Button>
                    <Radio.Button value="hidden">完全隐藏</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>右侧面板</Text>
                  <Radio.Group value={edgePanelDefault} onChange={(e) => setEdgePanelDefault(e.target.value as EdgePanelDefault)}>
                    <Radio.Button value="expanded">默认展开</Radio.Button>
                    <Radio.Button value="collapsed">默认收起</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>标签页位置</Text>
                  <Radio.Group value={edgeTabPosition} onChange={(e) => setEdgeTabPosition(e.target.value as EdgeTabPosition)}>
                    <Radio.Button value="top">顶部</Radio.Button>
                    <Radio.Button value="left">左侧垂直</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>紧凑模式</Text>
                  <Switch checked={edgeCompactMode} onChange={setEdgeCompactMode} />
                  <Text type="secondary" style={{ fontSize: 12 }}>间距减少 30%</Text>
                </Space>
              </Space>
            )}

            {isFluent && (
              <Space direction="vertical" size={8}>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>背景渐变</Text>
                  <Radio.Group value={fluentGradient} onChange={(e) => setFluentGradient(e.target.value as FluentGradient)}>
                    <Radio.Button value="cool">冷色渐变</Radio.Button>
                    <Radio.Button value="warm">暖色渐变</Radio.Button>
                    <Radio.Button value="dark">深色渐变</Radio.Button>
                  </Radio.Group>
                </Space>
                <Space><Text style={{ width: 80, display: 'inline-block' }}>毛玻璃强度</Text>
                  <Radio.Group value={fluentGlassStrength} onChange={(e) => setFluentGlassStrength(e.target.value as FluentGlassStrength)}>
                    <Radio.Button value="light">轻度 12px</Radio.Button>
                    <Radio.Button value="standard">标准 24px</Radio.Button>
                    <Radio.Button value="heavy">重度 40px</Radio.Button>
                  </Radio.Group>
                </Space>
              </Space>
            )}
          </Space>
        </Card>

        {/* ─── Analysis defaults ─── */}
        <Card title="分析默认值" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px' }}>
          <Space direction="vertical">
            <Space><Text>显著性水平 α</Text><InputNumber min={0.001} max={0.1} step={0.01} value={alpha} onChange={(v) => setAlpha(v ?? 0.05)} /></Space>
            <Space><Text>有效数字位数</Text><Select value={significantDigits} onChange={setSignificantDigits} style={{ width: 80 }} options={[2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n }))} /></Space>
          </Space>
        </Card>

        {/* ─── Chart defaults ─── */}
        <Card title="图表默认值" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px' }}>
          <Space direction="vertical">
            <Space><Text>默认配色</Text><Radio.Group value={defaultColorScheme} onChange={(e) => setDefaultColorScheme(e.target.value)}><Radio value="grayscale">学术灰度</Radio><Radio value="color">彩色</Radio></Radio.Group></Space>
            <Space><Text>导出格式</Text><Select value={defaultExportFormat} onChange={setDefaultExportFormat} style={{ width: 100 }} options={[{ label: 'SVG', value: 'svg' }, { label: 'PNG', value: 'png' }, { label: 'CSV', value: 'csv' }]} /></Space>
          </Space>
        </Card>

        {/* ─── History ─── */}
        <Card title="历史记录" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px' }}>
          <Space direction="vertical">
            <Space><Text>自动清理</Text><Switch checked={autoCleanHistory} onChange={setAutoCleanHistory} /></Space>
            {autoCleanHistory && <Space><Text>保留天数</Text><InputNumber min={7} max={365} value={historyRetentionDays} onChange={(v) => setHistoryRetentionDays(v ?? 90)} /></Space>}
          </Space>
        </Card>

        {/* ─── Data management ─── */}
        <Card title="数据管理" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px' }}>
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

        {/* ─── About ─── */}
        <Card title="关于" size="small" className="glass-card" bodyStyle={{ padding: '20px 24px', background: 'rgba(255,255,255,0.25)' }}>
          <Text>实验数据分析工作台 v1.0</Text><br />
          <Text type="secondary">本地运行，数据仅在当前电脑浏览器存储。无需联网。</Text>
        </Card>
      </Space>
    </div>
  );
}
