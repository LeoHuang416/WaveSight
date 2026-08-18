import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  Upload, FileText, Activity, Clock, TrendingUp, Database, BarChart3,
  PieChart, Sparkles, ChevronRight, ArrowRight,
} from 'lucide-react';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import { saveDataset } from '@/db/operations';
import DataTable from '@/components/data/DataTable';
import type { ColumnMeta } from '@/types/data';

const ACTION_TYPE: Record<string, { label: string; color: string }> = {
  descriptive: { label: '描述', color: 'text-purple-400 bg-purple-500/10' },
  frequency: { label: '频数', color: 'text-purple-400 bg-purple-500/10' },
  normality: { label: '正态', color: 'text-purple-400 bg-purple-500/10' },
  'grouped-stats': { label: '分组', color: 'text-purple-400 bg-purple-500/10' },
  'ttest-independent': { label: 't检', color: 'text-purple-400 bg-purple-500/10' },
  'ttest-paired': { label: 't检', color: 'text-purple-400 bg-purple-500/10' },
  'anova-oneway': { label: 'ANOVA', color: 'text-purple-400 bg-purple-500/10' },
  correlation: { label: '相关', color: 'text-purple-400 bg-purple-500/10' },
  'linear-regression': { label: '回归', color: 'text-purple-400 bg-purple-500/10' },
  'nonlinear-fit': { label: '拟合', color: 'text-purple-400 bg-purple-500/10' },
  rsm: { label: 'RSM', color: 'text-purple-400 bg-purple-500/10' },
  pca: { label: 'PCA', color: 'text-purple-400 bg-purple-500/10' },
  pipeline: { label: '全流程', color: 'text-purple-400 bg-purple-500/10' },
};

function StatCard({ label, value, change, icon, delay = 0 }: {
  label: string; value: string; change: string; icon: React.ReactNode; delay?: number;
}) {
  return (
    <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          <p className="mt-1 text-xs text-emerald-400">{change}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const currentDataset = useDataStore((s) => s.currentDataset);
  const datasetList = useDataStore((s) => s.datasetList);
  const refreshDatasetList = useDataStore((s) => s.refreshDatasetList);
  const updateCurrentDataset = useDataStore((s) => s.updateCurrentDataset);
  const records = useHistoryStore((s) => s.records);
  const refreshHistory = useHistoryStore((s) => s.refresh);
  const charts = useChartStore((s) => s.charts);
  const refreshCharts = useChartStore((s) => s.refresh);

  const columnMenuItems = (col: ColumnMeta): NonNullable<import('antd').MenuProps['items']> => {
    const isGroup = currentDataset?.experimentGroupCol === col.name;
    return [
      { key: isGroup ? 'unset-group' : 'set-group', label: isGroup ? '取消设为分组列' : '设为实验分组列' },
      { key: col.role === 'metadata' ? 'unignore' : 'ignore', label: col.role === 'metadata' ? '取消忽略此列' : '忽略此列（不参与分析）' },
    ];
  };

  const handleColumnMenu = async (key: string, col: ColumnMeta) => {
    if (!currentDataset) return;
    const ds = JSON.parse(JSON.stringify(currentDataset)) as typeof currentDataset;
    if (key === 'set-group') {
      ds.experimentGroupCol = col.name;
      const target = ds.columns.find((c) => c.name === col.name);
      if (target && target.role === 'unknown') target.role = 'independent';
      message.success(`已将 "${col.name}" 设为实验分组列`);
    } else if (key === 'unset-group') {
      ds.experimentGroupCol = undefined;
      message.success(`已取消分组列 "${col.name}"`);
    } else if (key === 'ignore') {
      const target = ds.columns.find((c) => c.name === col.name);
      if (target) target.role = 'metadata';
      message.success(`已忽略列 "${col.name}"`);
    } else if (key === 'unignore') {
      const target = ds.columns.find((c) => c.name === col.name);
      if (target) target.role = 'unknown';
      message.success(`已恢复列 "${col.name}"`);
    } else {
      return;
    }
    updateCurrentDataset(ds);
    await saveDataset(ds);
  };

  useEffect(() => {
    refreshDatasetList();
    refreshHistory();
    refreshCharts();
  }, [refreshDatasetList, refreshHistory, refreshCharts]);
  const latestRecord = records[0];
  const latestChart = charts[0];

  const stats = [
    { label: '数据集', value: String(datasetList.length), change: currentDataset ? `当前: ${currentDataset.name}` : '尚未导入', icon: <Database className="h-5 w-5" /> },
    { label: '分析任务', value: String(records.length), change: records.length ? '最新分析已记录' : '暂无记录', icon: <BarChart3 className="h-5 w-5" /> },
    { label: '图表生成', value: String(charts.length), change: charts.length ? '已保存到图表模块' : '暂无图表', icon: <PieChart className="h-5 w-5" /> },
    { label: '当前数据', value: currentDataset ? `${currentDataset.rowCount} 行` : '未加载', change: currentDataset ? `${currentDataset.colCount} 列 · ${currentDataset.columns.filter((c) => c.type === 'numeric').length} 数值` : '请先导入数据', icon: <Sparkles className="h-5 w-5" /> },
  ];

  const quickActions = [
    { label: '导入数据', desc: 'CSV / Excel / JSON', icon: <Upload className="h-4 w-4" />, path: '/import', color: 'bg-blue-500/10 text-blue-400' },
    { label: '数据清洗', desc: '缺失值 / 异常值处理', icon: <Sparkles className="h-4 w-4" />, path: '/cleaning', color: 'bg-emerald-500/10 text-emerald-400' },
    { label: '统计分析', desc: '13 种统计方法', icon: <BarChart3 className="h-4 w-4" />, path: '/analysis', color: 'bg-purple-500/10 text-purple-400' },
    { label: '生成图表', desc: '12 种可视化类型', icon: <PieChart className="h-4 w-4" />, path: '/charts', color: 'bg-amber-500/10 text-amber-400' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="glass-panel p-6 sm:p-8 mb-8 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Activity className="h-3 w-3" />
              工作台
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {currentDataset ? `正在分析: ${currentDataset.name}` : '欢迎使用实验数据分析工作台'}
          </h1>
          <p className="mt-2 text-slate-400 max-w-xl">
            {currentDataset
              ? `数据集已加载，${currentDataset.rowCount} 行 × ${currentDataset.colCount} 列。继续分析或生成图表。`
              : 'WaveSight 已就绪。导入实验数据，开始清洗、分析与可视化。'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => navigate('/import')}>
              <Upload className="h-4 w-4" />
              导入数据
            </button>
            <button className="btn-secondary" onClick={() => navigate('/history')}>
              <FileText className="h-4 w-4" />
              查看历史
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} change={stat.change} icon={stat.icon} delay={i * 100} />
        ))}
      </div>

      {/* Data preview (when dataset loaded) */}
      {currentDataset && (
        <div className="glass-card-static p-5 mb-8 animate-fade-in" style={{ animationDelay: '250ms', opacity: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              数据预览
            </h2>
            <button className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
              onClick={() => navigate('/import')}>
              管理数据 <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <DataTable dataset={currentDataset} maxRows={8} columnMenuItems={columnMenuItems} onColumnMenuClick={handleColumnMenu} />
        </div>
      )}

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <div className="lg:col-span-2 glass-card-static p-5 animate-fade-in" style={{ animationDelay: '400ms', opacity: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              最近活动
            </h2>
            <button className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
              onClick={() => navigate('/history')}>
              查看全部 <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-0.5">
            {records.length === 0 && charts.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">暂无分析记录，去 <button className="text-indigo-400 hover:underline" onClick={() => navigate('/analysis')}>开始分析</button></p>
            ) : (
              <>
                {records.slice(0, 4).map((r) => {
                  const cfg = ACTION_TYPE[r.analysisConfig.type ?? ''] ?? { label: r.analysisConfig.type ?? '分析', color: 'text-slate-400 bg-white/5' };
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition hover:bg-white/[0.02] cursor-pointer" onClick={() => navigate('/history')}>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 truncate">{r.datasetName}</p>
                        <p className="text-xs text-slate-500 truncate">{r.result.conclusion.slice(0, 40) || new Date(r.createdAt).toLocaleString('zh-CN')}</p>
                      </div>
                      <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  );
                })}
                {charts.slice(0, 2).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition hover:bg-white/[0.02] cursor-pointer" onClick={() => navigate('/charts')}>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10">图表</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{c.title}</p>
                      <p className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="glass-card-static p-5 animate-fade-in" style={{ animationDelay: '500ms', opacity: 0 }}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            快速操作
          </h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button key={action.label} className="w-full flex items-center gap-3 p-3 rounded-xl transition hover:bg-white/[0.03] text-left group" onClick={() => navigate(action.path)}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>{action.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 group-hover:text-white transition">{action.label}</p>
                  <p className="text-xs text-slate-500">{action.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
