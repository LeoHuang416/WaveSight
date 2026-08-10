import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { Search, Download, Trash2, ChevronRight, Clock, BarChart3, Edit3, RotateCcw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useDataStore } from '@/stores/useDataStore';
import { formatNumber } from '@/utils/format';
import type { HistoryRecord } from '@/types/history';
import type { AnalysisType } from '@/types/analysis';

const TYPE_LABELS: Record<AnalysisType, string> = {
  descriptive: '描述统计', frequency: '频数统计', normality: '正态性检验', 'grouped-stats': '分组统计',
  'ttest-independent': '独立样本 t 检验', 'ttest-paired': '配对 t 检验', 'anova-oneway': '单因素 ANOVA',
  correlation: '相关矩阵', 'linear-regression': '线性回归', 'nonlinear-fit': '非线性拟合',
  rsm: '响应面分析', pca: '主成分分析', pipeline: '全流程分析',
};

const TYPE_COLORS: Record<AnalysisType, string> = {
  descriptive: 'text-blue-400 bg-blue-500/10', frequency: 'text-blue-400 bg-blue-500/10',
  normality: 'text-blue-400 bg-blue-500/10', 'grouped-stats': 'text-blue-400 bg-blue-500/10',
  'ttest-independent': 'text-purple-400 bg-purple-500/10', 'ttest-paired': 'text-purple-400 bg-purple-500/10',
  'anova-oneway': 'text-purple-400 bg-purple-500/10', correlation: 'text-purple-400 bg-purple-500/10',
  'linear-regression': 'text-purple-400 bg-purple-500/10', 'nonlinear-fit': 'text-purple-400 bg-purple-500/10',
  rsm: 'text-amber-400 bg-amber-500/10', pca: 'text-emerald-400 bg-emerald-500/10', pipeline: 'text-indigo-400 bg-indigo-500/10',
};

function ResultTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-white/5">
      <p className="px-4 py-2 text-xs font-semibold text-slate-300 bg-white/[0.03]">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.04]">
              {headers.map((h) => <th key={h} className="px-3 py-2 text-left font-medium text-slate-400 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-white/5 hover:bg-white/[0.02]">
                {row.map((v, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type="text" placeholder="搜索数据集名称..." className="input-field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setTypeFilter((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k])}
                className={`tab-btn ${typeFilter.includes(k) ? 'active' : ''}`}
              >{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="glass-card-static p-3 animate-fade-in">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-10">暂无记录</p>
            ) : (
              Array.from(grouped.entries()).map(([day, items]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-slate-500 px-2 mb-1.5">{day}</p>
                  {items.map((r) => {
                    const type = r.analysisConfig.type ?? 'pipeline';
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelected(r.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl transition cursor-pointer mb-1 ${
                          selectedId === r.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-semibold flex-shrink-0 ${TYPE_COLORS[type] ?? 'text-slate-400 bg-white/5'}`}>
                          {TYPE_LABELS[type]?.slice(0, 2) ?? '分析'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{r.datasetName}</p>
                          <p className="text-[10px] text-slate-500 truncate">{r.result.conclusion.slice(0, 30) || new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
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
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TYPE_COLORS[selected.analysisConfig.type ?? 'pipeline'] ?? 'text-slate-400 bg-white/5'}`}>
                    {TYPE_LABELS[selected.analysisConfig.type ?? 'pipeline']}
                  </span>
                  <span className="tag">{new Date(selected.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <Popconfirm title="删除此条记录?" onConfirm={() => removeRecord(selected.id)}>
                  <button className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Popconfirm>
              </div>

              {/* Config summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="tag text-indigo-300 border-indigo-500/20 bg-indigo-500/5">数据集: {selected.datasetName}</span>
                {selected.analysisConfig.valueCols && <span className="tag">变量: {selected.analysisConfig.valueCols.join(', ')}</span>}
                {selected.analysisConfig.groupCol && <span className="tag">分组: {selected.analysisConfig.groupCol}</span>}
                {selected.analysisConfig.yCol && <span className="tag">因变量: {selected.analysisConfig.yCol}</span>}
                {selected.analysisConfig.xCols && <span className="tag">自变量: {selected.analysisConfig.xCols.join(', ')}</span>}
                {selected.analysisConfig.modelName && <span className="tag">模型: {selected.analysisConfig.modelName}</span>}
              </div>

              {selected.result.tables.map((t, i) => <ResultTable key={i} title={t.title} headers={t.headers} rows={t.rows} />)}

              {selected.result.conclusion && (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3 mb-4">
                  <p className="text-sm text-emerald-300">{selected.result.conclusion}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-slate-500 block mb-1">备注</label>
                <textarea className="input-field" rows={2} placeholder="添加备注..." value={selected.note} onChange={(e) => updateNote(selected.id, e.target.value)} />
              </div>

              <div className="flex gap-3">
                {selected.relatedChartIds.length > 0 && (
                  <button className="btn-secondary text-xs" onClick={() => navigate('/charts')}>
                    <BarChart3 className="h-3.5 w-3.5" /> 查看关联图表 ({selected.relatedChartIds.length})
                  </button>
                )}
                <button className="btn-primary text-xs" onClick={async () => {
                  const cfg = selected.analysisConfig;
                  await setCurrentDataset(cfg.datasetId);
                  navigate('/analysis');
                }}>
                  <Edit3 className="h-3.5 w-3.5" /> 重新分析
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03]">
                <Clock className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">选择一条记录查看详情</p>
              <p className="text-xs text-slate-600 mt-1">运行分析后，结果会自动记录在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
