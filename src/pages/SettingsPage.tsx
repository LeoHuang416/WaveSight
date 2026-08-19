import { useState, useEffect } from 'react';
import { message, Modal, Input, InputNumber, Select, Radio, Switch } from 'antd';
import { Palette, Sun, Moon, Monitor, Database, Download, Sigma, BarChart3, History, Info } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { getStorageStats, exportAllData, clearAllData } from '@/db/operations';
import { exportAllDataJSON } from '@/utils/export';
import { ACCENT_PRESETS } from '@/themes';
import type { AppearanceMode } from '@/stores/useSettingsStore';

function Section({ icon, iconColor, title, children }: {
  icon: React.ReactNode; iconColor: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card-static p-5 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconColor}`}>{icon}</div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-text-primary)]">{title}</p>
        {desc && <p className="text-xs text-[var(--color-text-tertiary)]">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    appearanceMode, accentColor, alpha, significantDigits,
    defaultColorScheme, defaultExportFormat, autoCleanHistory, historyRetentionDays,
    setAppearanceMode, setAccentColor, setAlpha, setSignificantDigits,
    setDefaultColorScheme, setDefaultExportFormat, setAutoCleanHistory, setHistoryRetentionDays,
  } = useSettingsStore();

  const [stats, setStats] = useState({ datasetCount: 0, chartCount: 0, historyCount: 0 });

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
        } else { message.error('输入不匹配'); return Promise.reject(); }
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="设置" description="个性化配置工作台偏好" />

      <div className="space-y-6">
        {/* Appearance */}
        <Section icon={<Palette className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="外观">
          <Row title="主题模式" desc="深色玻璃为推荐外观">
            <div className="flex gap-1.5">
              {([
                { key: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: '深色' },
                { key: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: '浅色' },
                { key: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: '系统' },
              ] as { key: AppearanceMode; icon: React.ReactNode; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAppearanceMode(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    appearanceMode === t.key
                      ? 'bg-accent-light text-accent-text border border-accent-border'
                      : 'bg-[var(--color-bg-glass)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:bg-[var(--color-accent-light)]'
                  }`}
                >{t.icon}{t.label}</button>
              ))}
            </div>
          </Row>
          <Row title="强调色" desc="用于 antd 控件与选中态">
            <div className="flex gap-1.5">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={() => setAccentColor(p.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                    accentColor === p.id ? 'border-accent-border ring-2 ring-accent-border' : 'border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]'
                  }`}
                  style={{ background: p.color }}
                />
              ))}
            </div>
          </Row>
        </Section>

        {/* Analysis defaults */}
        <Section icon={<Sigma className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="分析默认值">
          <Row title="显著性水平 α" desc="假设检验的判断阈值">
            <InputNumber min={0.001} max={0.1} step={0.01} value={alpha} onChange={(v) => setAlpha(v ?? 0.05)} style={{ width: 110 }} />
          </Row>
          <Row title="有效数字位数" desc="结果表格中的数字显示">
            <Select value={significantDigits} onChange={setSignificantDigits} style={{ width: 100 }} options={[2, 3, 4, 5, 6].map((n) => ({ label: `${n} 位`, value: n }))} />
          </Row>
        </Section>

        {/* Chart defaults */}
        <Section icon={<BarChart3 className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="图表默认值">
          <Row title="默认配色" desc="新建图表的配色方案">
            <Radio.Group value={defaultColorScheme} onChange={(e) => setDefaultColorScheme(e.target.value)}>
              <Radio value="grayscale">学术灰度</Radio>
              <Radio value="color">彩色</Radio>
            </Radio.Group>
          </Row>
          <Row title="导出格式" desc="图表导出的默认格式">
            <Select value={defaultExportFormat} onChange={setDefaultExportFormat} style={{ width: 110 }} options={[{ label: 'SVG', value: 'svg' }, { label: 'PNG', value: 'png' }, { label: 'CSV', value: 'csv' }]} />
          </Row>
        </Section>

        {/* History */}
        <Section icon={<History className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="历史记录">
          <Row title="自动清理" desc="开启后按保留天数清理旧记录">
            <Switch checked={autoCleanHistory} onChange={setAutoCleanHistory} />
          </Row>
          {autoCleanHistory && (
            <Row title="保留天数">
              <InputNumber min={7} max={365} value={historyRetentionDays} onChange={(v) => setHistoryRetentionDays(v ?? 90)} style={{ width: 110 }} />
            </Row>
          )}
        </Section>

        {/* Data management */}
        <Section icon={<Database className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="数据管理">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '数据集', value: stats.datasetCount },
              { label: '图表', value: stats.chartCount },
              { label: '历史记录', value: stats.historyCount },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[var(--color-bg-glass)] border-[var(--border-thin)] p-4 text-center">
                <p className="stat-value text-2xl">{s.value}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> 导出全部数据 (JSON)
            </button>
            <button className="btn-secondary text-xs !text-red-400 hover:!border-red-400/30" onClick={handleClear}>
              清空全部数据
            </button>
          </div>
        </Section>

        {/* About */}
        <Section icon={<Info className="h-4 w-4" />} iconColor="bg-accent-light text-accent-text" title="关于">
          <Row title="WaveSight · 实验数据分析工作台 v1.0" desc="本地运行，数据仅在当前电脑浏览器存储，无需联网。" />
        </Section>
      </div>
    </div>
  );
}
