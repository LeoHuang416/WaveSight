import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popconfirm, Checkbox } from 'antd';
import { Search, Download, Trash2, ChevronRight, Clock, BarChart3, Edit3, RotateCcw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useDataStore } from '@/stores/useDataStore';
import { useChartStore } from '@/stores/useChartStore';
import { formatNumber } from '@/utils/format';
import type { HistoryRecord } from '@/types/history';
import type { AnalysisType } from '@/types/analysis';

const TYPE_LABELS: Record<AnalysisType, string> = {
  descriptive: '描述统计', frequency: '频数统计', normality: '正态性检验', 'grouped-stats': '分组统计',
  'ttest-independent': '独立样本 t 检验', 'ttest-paired': '配对 t 检验', 'anova-oneway': '单因素 ANOVA',
  'anova-multiway': '多因素 ANOVA', 'mann-whitney': 'Mann-Whitney U 检验', wilcoxon: 'Wilcoxon 符号秩检验',
  'kruskal-wallis': 'Kruskal-Wallis 检验', 'chi-square': '卡方检验',
  correlation: '相关矩阵', 'linear-regression': '线性回归', 'nonlinear-fit': '非线性拟合',
  rsm: '响应面分析', pca: '主成分分析', pipeline: '全流程分析',
};

const TYPE_COLORS: Record<AnalysisType, string> = {
  descriptive: 'text-accent-text bg-accent-light', frequency: 'text-accent-text bg-accent-light',
  normality: 'text-accent-text bg-accent-light', 'grouped-stats': 'text-accent-text bg-accent-light',
  'ttest-independent': 'text-accent-text bg-accent-light', 'ttest-paired': 'text-accent-text bg-accent-light',
  'anova-oneway': 'text-accent-text bg-accent-light', 'anova-multiway': 'text-accent-text bg-accent-light',
  'mann-whitney': 'text-accent-text bg-accent-light', wilcoxon: 'text-accent-text bg-accent-light',
  'kruskal-wallis': 'text-accent-text bg-accent-light', 'chi-square': 'text-accent-text bg-accent-light',
  correlation: 'text-accent-text bg-accent-light', 'linear-regression': 'text-accent-text bg-accent-light',
  'nonlinear-fit': 'text-accent-text bg-accent-light', rsm: 'text-accent-text bg-accent-light',
  pca: 'text-accent-text bg-accent-light', pipeline: 'text-accent-text bg-accent-light',
};

function ResultTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="mb-4 overflow-hidden rounded-xl border-[var(--border-thin)]">
      <p className="px-4 py-2 text-xs font-semibold text-[var(--color-text-primary)] bg-[var(--color-accent-light)]">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--color-accent-light)]">
              {headers.map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)] whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t-[var(--border-subtle)] hover:bg-[var(--color-accent-light)]">
                {row.map((v, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap">
                    {typeof v === 'number' ? formatNumber(v, 3) : String(v ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { records, selectedId, setSelected, removeRecord, updateNote } = useHistoryStore();
  const { removeChart } = useChartStore();
  const { setCurrentDataset } = useDataStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteRelated, setDeleteRelated] = useState(false);

  const filtered = records.filter((r) => {
    if (search) { const t = r.analysisConfig.type ?? ''; if (!TYPE_LABELS[t]?.includes(search) && !r.datasetName.includes(search) && !r.note.includes(search)) return false; }
    if (typeFilter.length && !typeFilter.includes(r.analysisConfig.type ?? '')) return false;
    if (dateFrom && new Date(r.createdAt).getTime() < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
    if (dateTo && new Date(r.createdAt).getTime() > new Date(`${dateTo}T23:59:59`).getTime()) return false;
    return true;
  });

  const handleDelete = async (record: HistoryRecord) => {
    if (deleteRelated && record.relatedChartIds.length) {
      for (const chartId of record.relatedChartIds) await removeChart(chartId);
    }
    await removeRecord(record.id);
  };

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="历史记录" description="所有数据操作的时间线">
        <button className="btn-secondary text-xs" onClick={() => useHistoryStore.getState().refresh()}>
          <RotateCcw className="h-3.5 w-3.5" /> 刷新
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="glass-card-static p-4 mb-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-tertiary)]" />
            <input type="text" placeholder="搜索数据集名称..." className="input-field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <input type="date" title="开始日期" value={dateFrom} max={dateTo || undefined} className="input-field !w-36 !py-1.5" onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" title="结束日期" value={dateTo} min={dateFrom || undefined} className="input-field !w-36 !py-1.5" onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-3">
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setTypeFilter((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k])}
              className={`tab-btn ${typeFilter.includes(k) ? 'active' : ''}`}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* Two-column: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="glass-card-static p-3 animate-fade-in">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-tertiary)] py-10">暂无记录</p>
            ) : (
              Array.from(grouped.entries()).map(([day, items]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-[var(--color-text-tertiary)] px-2 mb-1.5">{day}</p>
                  {items.map((r) => {
                    const type = r.analysisConfig.type ?? 'pipeline';
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelected(r.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl transition cursor-pointer mb-1 ${
                          selectedId === r.id ? 'bg-accent-light border border-accent-border' : 'hover:bg-[var(--color-accent-light)]'
                        }`}
                      >
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-semibold flex-shrink-0 ${TYPE_COLORS[type] ?? 'text-[var(--color-text-secondary)] bg-[var(--color-bg-glass)]'}`}>
                          {TYPE_LABELS[type]?.slice(0, 2) ?? '分析'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--color-text-primary)] truncate">{r.datasetName}</p>
                          <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{r.result.conclusion.slice(0, 30) || new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 glass-card-static p-5 animate-fade-in">
          {selected ? (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TYPE_COLORS[selected.analysisConfig.type ?? 'pipeline'] ?? 'text-[var(--color-text-secondary)] bg-[var(--color-bg-glass)]'}`}>
                    {TYPE_LABELS[selected.analysisConfig.type ?? 'pipeline']}
                  </span>
                  <span className="tag">{new Date(selected.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <Popconfirm
                  title="删除此条记录?"
                  description={selected.relatedChartIds.length > 0 ? `同时删除 ${selected.relatedChartIds.length} 张关联图表` : undefined}
                  icon={null}
                  onConfirm={() => handleDelete(selected)}
                >
                  <button className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-[var(--color-bg-glass)] transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Popconfirm>
              </div>

              {/* Config summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="tag text-accent-text border-accent-border bg-accent-light">数据集: {selected.datasetName}</span>
                {selected.analysisConfig.valueCols && <span className="tag">变量: {selected.analysisConfig.valueCols.join(', ')}</span>}
                {selected.analysisConfig.groupCol && <span className="tag">分组: {selected.analysisConfig.groupCol}</span>}
                {selected.analysisConfig.yCol && <span className="tag">因变量: {selected.analysisConfig.yCol}</span>}
                {selected.analysisConfig.xCols && <span className="tag">自变量: {selected.analysisConfig.xCols.join(', ')}</span>}
                {selected.analysisConfig.modelName && <span className="tag">模型: {selected.analysisConfig.modelName}</span>}
              </div>

              {selected.result.tables.map((t, i) => <ResultTable key={i} title={t.title} headers={t.headers} rows={t.rows} />)}

              {selected.result.conclusion && (
                <div className="rounded-xl bg-[var(--color-accent-light)] border border-accent-border p-3 mb-4">
                  <p className="text-sm text-accent-text">{selected.result.conclusion}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-[var(--color-text-tertiary)] block mb-1">备注</label>
                <textarea className="input-field" rows={2} placeholder="添加备注..." value={selected.note} onChange={(e) => updateNote(selected.id, e.target.value)} />
              </div>

              {selected.relatedChartIds.length > 0 && (
                <div className="mb-4">
                  <Checkbox checked={deleteRelated} onChange={(e) => setDeleteRelated(e.target.checked)}>
                    <span className="text-xs text-[var(--color-text-secondary)]">删除记录时同时删除 {selected.relatedChartIds.length} 张关联图表</span>
                  </Checkbox>
                </div>
              )}

              <div className="flex gap-3">
                {selected.relatedChartIds.length > 0 && (
                  <button className="btn-secondary text-xs" onClick={() => navigate('/charts')}>
                    <BarChart3 className="h-3.5 w-3.5" /> 查看关联图表 ({selected.relatedChartIds.length})
                  </button>
                )}
                <button className="btn-primary text-xs" onClick={async () => {
                  const cfg = selected.analysisConfig;
                  await setCurrentDataset(cfg.datasetId);
                  navigate('/analysis', { state: { prefill: cfg } });
                }}>
                  <Edit3 className="h-3.5 w-3.5" /> 重新分析
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-light)]">
                <Clock className="h-6 w-6 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">选择一条记录查看详情</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">运行分析后，结果会自动记录在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
