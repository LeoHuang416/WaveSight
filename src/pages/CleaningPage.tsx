import { useState, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { Sparkles, Eye, Play, RotateCcw, Settings2, AlertTriangle, CheckCircle2, Trash2, Filter } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useDataStore } from '@/stores/useDataStore';
import { useDataOperations } from '@/hooks/useDataOperations';
import DataTable from '@/components/data/DataTable';
import EmptyState from '@/components/common/EmptyState';
import type { Dataset } from '@/types/data';

type Tab = 'missing' | 'outlier' | 'columns';

export default function CleaningPage() {
  const { currentDataset, datasetList, setCurrentDataset, updateCurrentDataset } = useDataStore();
  const { updateDataset } = useDataOperations();
  const [tab, setTab] = useState<Tab>('missing');
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [missingMethod, setMissingMethod] = useState<'delete' | 'fill' | 'mark'>('fill');
  const [fillStrategy, setFillStrategy] = useState<'mean' | 'median' | 'custom'>('median');
  const [fillValue, setFillValue] = useState(0);
  const [targetCols, setTargetCols] = useState<string[]>(['__all_numeric__']);
  const [outlierK, setOutlierK] = useState(1.5);
  const [outlierMethod, setOutlierMethod] = useState<'remove' | 'winsorize' | 'keep'>('keep');
  const [outlierHighlights, setOutlierHighlights] = useState<{ row: number; col: string; color: string }[]>([]);
  const [outlierCount, setOutlierCount] = useState(0);
  const [missingHighlights, setMissingHighlights] = useState<{ row: number; col: string; color: string }[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [pendingDeleteCols, setPendingDeleteCols] = useState<string[]>([]);
  const [filterCol, setFilterCol] = useState('');
  const [filterOp, setFilterOp] = useState('gt');
  const [filterValue, setFilterValue] = useState('');

  const dataset = pendingDataset ?? currentDataset;

  const initPending = () => {
    if (currentDataset && !pendingDataset) setPendingDataset(JSON.parse(JSON.stringify(currentDataset)));
  };

  const applyChanges = async () => {
    if (!pendingDataset) return;
    await updateDataset(pendingDataset);
    setHasChanges(false);
    message.success('更改已应用');
  };

  const resetChanges = () => { setPendingDataset(null); setHasChanges(false); };

  const missingCounts = useMemo(() => {
    if (!dataset) return new Map<string, number>();
    const counts = new Map<string, number>();
    dataset.columns.forEach((c) => counts.set(c.name, 0));
    dataset.rows.forEach((row) => {
      dataset.columns.forEach((c) => {
        const v = row[c.name];
        if (v === null || v === undefined || v === '') counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
      });
    });
    return counts;
  }, [dataset]);

  const missingRowCount = useMemo(() => {
    if (!dataset) return 0;
    return dataset.rows.filter((r) => Object.values(r).some((v) => v === null || v === undefined || v === '')).length;
  }, [dataset]);

  const handleMissingValues = useCallback(() => {
    initPending();
    if (!pendingDataset && !currentDataset) return;
    const src = pendingDataset ?? currentDataset!;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    const cols = targetCols.includes('__all_numeric__')
      ? ds.columns.filter((c) => c.type === 'numeric').map((c) => c.name)
      : targetCols;

    if (missingMethod === 'delete') {
      ds.rows = ds.rows.filter((row) => cols.every((col) => row[col] !== null && row[col] !== undefined && row[col] !== ''));
    } else if (missingMethod === 'mark') {
      // 仅标记（数据不变）：用高亮记录缺失位置
      const marks: { row: number; col: string; color: string }[] = [];
      ds.rows.forEach((row, idx) => {
        for (const col of cols) {
          if (row[col] === null || row[col] === undefined || row[col] === '') marks.push({ row: idx, col, color: '#f97316' });
        }
      });
      setMissingHighlights(marks);
      setMissingCount(marks.length);
      ds.rowCount = ds.rows.length;
      setPendingDataset(ds);
      setHasChanges(false);
      message.success(`已标记 ${marks.length} 个缺失单元格（数据未修改）`);
      return;
    } else {
      for (const col of cols) {
        const values = ds.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        if (values.length === 0) continue;
        let replacement: number;
        if (fillStrategy === 'mean') replacement = values.reduce((a, b) => a + b, 0) / values.length;
        else if (fillStrategy === 'median') {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          replacement = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        } else replacement = fillValue;
        ds.rows.forEach((row) => {
          if (row[col] === null || row[col] === undefined || row[col] === '') row[col] = replacement;
        });
      }
    }
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setHasChanges(true);
    message.success(missingMethod === 'delete' ? `已删除 ${src.rowCount - ds.rows.length} 行含缺失值的记录` : '缺失值填充完成');
  }, [pendingDataset, currentDataset, missingMethod, fillStrategy, fillValue, targetCols]);

  const handleOutliers = useCallback(() => {
    initPending();
    const src = pendingDataset ?? currentDataset;
    if (!src) return;
    const numericCols = src.columns.filter((c) => c.type === 'numeric').map((c) => c.name);
    const highlights: { row: number; col: string; color: string }[] = [];
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    // bounds per column: { lower, upper }
    const bounds = new Map<string, { lower: number; upper: number }>();
    for (const col of numericCols) {
      const values = ds.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      if (values.length < 4) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      bounds.set(col, { lower: q1 - outlierK * iqr, upper: q3 + outlierK * iqr });
    }
    const isOutlier = (col: string, v: number): boolean => {
      const b = bounds.get(col);
      return !!b && (v < b.lower || v > b.upper);
    };
    ds.rows.forEach((row, idx) => {
      for (const col of numericCols) {
        const v = Number(row[col]);
        if (!isNaN(v) && isOutlier(col, v)) highlights.push({ row: idx, col, color: '#f97316' });
      }
    });
    if (outlierMethod === 'remove') {
      ds.rows = ds.rows.filter((row) => !numericCols.some((col) => { const v = Number(row[col]); return !isNaN(v) && isOutlier(col, v); }));
    } else if (outlierMethod === 'winsorize') {
      for (const col of numericCols) {
        const b = bounds.get(col);
        if (!b) continue;
        ds.rows.forEach((row) => {
          const v = Number(row[col]);
          if (!isNaN(v) && isOutlier(col, v)) row[col] = v < b.lower ? b.lower : b.upper;
        });
      }
    }
    // 'keep'：仅标记（数据不变）
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setOutlierHighlights(highlights);
    setOutlierCount(highlights.length);
    setHasChanges(outlierMethod !== 'keep');
    const actionText = outlierMethod === 'remove' ? `已剔除 ${src.rowCount - ds.rows.length} 行含异常值记录`
      : outlierMethod === 'winsorize' ? '异常值已替换为边界值 (Winsorize)'
      : '异常值已标记（数据未修改）';
    message.success(`检测到 ${highlights.length} 个异常值 (IQR, k=${outlierK})，${actionText}`);
  }, [pendingDataset, currentDataset, outlierK, outlierMethod]);

  const renameColumn = useCallback((oldName: string, newName: string) => {
    const src = pendingDataset ?? currentDataset;
    if (!src || !newName || oldName === newName) return;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    const targetCol = ds.columns.find((c) => c.name === oldName);
    if (targetCol) targetCol.name = newName;
    ds.rows = ds.rows.map((row) => {
      if (oldName in row) {
        const newRow = { ...row, [newName]: row[oldName] };
        delete newRow[oldName];
        return newRow;
      }
      return row;
    });
    setPendingDataset(ds);
    setHasChanges(true);
  }, [pendingDataset, currentDataset]);

  const deleteColumns = useCallback((cols: string[]) => {
    const src = pendingDataset ?? currentDataset;
    if (!src || cols.length === 0) return;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    ds.columns = ds.columns.filter((c) => !cols.includes(c.name));
    ds.rows = ds.rows.map((row) => {
      const newRow = { ...row };
      cols.forEach((col) => delete newRow[col]);
      return newRow;
    });
    ds.colCount = ds.columns.length;
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setHasChanges(true);
    message.success(`已删除 ${cols.length} 列`);
  }, [pendingDataset, currentDataset]);

  const toggleColumnType = useCallback((colName: string) => {
    const src = pendingDataset ?? currentDataset;
    if (!src) return;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    const col = ds.columns.find((c) => c.name === colName);
    if (!col) return;
    col.type = col.type === 'numeric' ? 'categorical' : 'numeric';
    setPendingDataset(ds);
    setHasChanges(true);
    message.success(`列 "${colName}" 已转换为${col.type === 'numeric' ? '数值' : '分类'}`);
  }, [pendingDataset, currentDataset]);

  const filterRows = useCallback((col: string, op: string, threshold: string) => {
    const src = pendingDataset ?? currentDataset;
    if (!src || !col || !op) return;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    const numThreshold = Number(threshold);
    const test = (v: unknown): boolean => {
      const s = String(v ?? '');
      if (op === 'contains') return s.includes(threshold);
      if (isNaN(numThreshold) || s === '') return false;
      const n = Number(v);
      if (op === 'gt') return n > numThreshold;
      if (op === 'lt') return n < numThreshold;
      if (op === 'eq') return n === numThreshold;
      return false;
    };
    const before = ds.rows.length;
    ds.rows = ds.rows.filter((row) => test(row[col]));
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setHasChanges(true);
    message.success(`筛选完成：${before} → ${ds.rows.length} 行`);
  }, [pendingDataset, currentDataset]);

  if (!currentDataset) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <PageHeader title="数据清洗" description="处理缺失值、异常值，进行列操作" />
        <EmptyState description="请先导入数据" actionText="前往导入 →" actionPath="/import" />
      </div>
    );
  }
  const ds = pendingDataset ?? currentDataset;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'missing', label: '缺失值处理' },
    { id: 'outlier', label: '异常值检测' },
    { id: 'columns', label: '列操作' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="数据清洗" description="处理缺失值、异常值，进行列操作">
        <button className="btn-primary" onClick={applyChanges} disabled={!hasChanges}>
          <Play className="h-4 w-4" />
          {hasChanges ? '应用更改' : '无待应用更改'}
        </button>
      </PageHeader>

      {/* Dataset selector */}
      <div className="glass-card-static p-4 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">选择数据集</label>
            <select className="input-field" value={currentDataset.id} onChange={(e) => { setCurrentDataset(e.target.value); resetChanges(); }}>
              {datasetList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              {datasetList.length === 0 && <option>{currentDataset.name}</option>}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <span className="tag text-emerald-300 border-emerald-500/20 bg-emerald-500/5">{currentDataset.rowCount} 行</span>
            <span className="tag text-blue-300 border-blue-500/20 bg-blue-500/5">{currentDataset.colCount} 列</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card-static p-1.5 mb-6 inline-flex animate-fade-in">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn ${tab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column list */}
        <div className="glass-card-static p-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-accent-text" />
            数据列
          </h3>
          <div className="space-y-1">
            {ds.columns.map((col) => {
              const missing = missingCounts.get(col.name) ?? 0;
              return (
                <div key={col.name} className="flex items-center justify-between p-2 rounded-lg transition hover:bg-[var(--color-accent-light)]">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">{col.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{col.type === 'numeric' ? '数值' : '分类'} · {col.role === 'independent' ? '自变量' : col.role === 'dependent' ? '因变量' : col.role === 'metadata' ? '元数据' : '未知'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {missing > 0 ? (
                      <span className={`text-xs font-medium ${missing > 50 ? 'text-red-400' : 'text-amber-400'}`}>缺失 {missing}</span>
                    ) : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action panel */}
        <div className="lg:col-span-2 glass-card-static p-5 animate-fade-in">
          {tab === 'missing' && (
            <div className="animate-fade-in">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">缺失值处理策略</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] mb-1.5 block">适用列</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTargetCols(targetCols.includes('__all_numeric__') ? [] : ['__all_numeric__'])}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        targetCols.includes('__all_numeric__')
                          ? 'bg-accent-light text-accent-text border border-accent-border'
                          : 'bg-[var(--color-bg-glass)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:bg-[var(--color-accent-light)]'
                      }`}
                    >全部数值列</button>
                    {ds.columns.filter((c) => c.type === 'numeric').map((col) => (
                      <button
                        key={col.name}
                        onClick={() => setTargetCols((prev) => prev.includes(col.name) ? prev.filter((x) => x !== col.name) : [...prev.filter((x) => x !== '__all_numeric__'), col.name])}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          targetCols.includes(col.name)
                            ? 'bg-accent-light text-accent-text border border-accent-border'
                            : 'bg-[var(--color-bg-glass)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:bg-[var(--color-accent-light)]'
                        }`}
                      >{col.name}</button>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-3 p-3 rounded-xl transition hover:bg-[var(--color-accent-light)] cursor-pointer">
                  <input type="radio" checked={missingMethod === 'delete'} onChange={() => setMissingMethod('delete')} className="mt-1 accent-[var(--color-accent)]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">删除含缺失值行</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">移除任何包含缺失数据的行</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl transition hover:bg-[var(--color-accent-light)] cursor-pointer">
                  <input type="radio" checked={missingMethod === 'fill'} onChange={() => setMissingMethod('fill')} className="mt-1 accent-[var(--color-accent)]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">填充缺失值</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {([['mean', '均值'], ['median', '中位数'], ['custom', '指定值']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setFillStrategy(key)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            fillStrategy === key
                              ? 'bg-accent-light text-accent-text border border-accent-border'
                              : 'bg-[var(--color-bg-glass)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:bg-[var(--color-accent-light)]'
                          }`}
                        >{label}</button>
                      ))}
                    </div>
                    {fillStrategy === 'custom' && (
                      <input type="number" className="input-field mt-2" value={fillValue} onChange={(e) => setFillValue(Number(e.target.value))} />
                    )}
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl transition hover:bg-[var(--color-accent-light)] cursor-pointer">
                  <input type="radio" checked={missingMethod === 'mark'} onChange={() => setMissingMethod('mark')} className="mt-1 accent-[var(--color-accent)]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">仅标记缺失单元格</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">在数据预览中橙色高亮缺失位置，不修改数据</p>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">含缺失值的行: <span className="text-amber-400">{missingRowCount}</span></span>
                <div className="flex gap-3 items-center">
                  <span className="text-xs text-[var(--color-text-tertiary)]">{missingCount > 0 ? <>已标记 <span className="text-amber-400">{missingCount}</span> 个缺失单元格</> : '尚未标记'}</span>
                  <button className="btn-secondary" onClick={resetChanges}><RotateCcw className="h-3.5 w-3.5" /> 重置</button>
                  <button className="btn-primary" onClick={handleMissingValues}><Settings2 className="h-3.5 w-3.5" /> 应用选择</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'outlier' && (
            <div className="animate-fade-in">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">异常值检测 (IQR 方法)</h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-4">使用四分位距法 (Q1 - k×IQR, Q3 + k×IQR) 检测异常值，k 默认 1.5。</p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] mb-1.5 block">阈值系数 k（越小越敏感）</label>
                  <input type="number" className="input-field" min={0.5} max={5} step={0.5} value={outlierK}
                    onChange={(e) => setOutlierK(Number(e.target.value) || 1.5)} />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] mb-1.5 block">处理方式</label>
                  <div className="flex flex-col gap-2">
                    {([
                      ['keep', '仅标记', '在表格中橙色高亮，不修改数据'],
                      ['winsorize', '替换为边界值', '异常值替换为 Q1-k×IQR / Q3+k×IQR 边界值 (Winsorize)'],
                      ['remove', '剔除', '删除包含异常值的整行记录'],
                    ] as const).map(([key, label, desc]) => (
                      <label key={key} className="flex items-start gap-3 p-3 rounded-xl transition hover:bg-[var(--color-accent-light)] cursor-pointer">
                        <input type="radio" checked={outlierMethod === key} onChange={() => setOutlierMethod(key)} className="mt-1 accent-[var(--color-accent)]" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-tertiary)]">{outlierCount > 0 ? <>已检测到 <span className="text-amber-400">{outlierCount}</span> 个异常值</> : '尚未检测'}</span>
                <button className="btn-primary" onClick={handleOutliers}><AlertTriangle className="h-3.5 w-3.5" /> 检测并处理异常值</button>
              </div>
            </div>
          )}

          {tab === 'columns' && (
            <div className="animate-fade-in space-y-6">
              {/* 重命名列 */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">重命名列</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-3">在输入框中修改列名，失焦后应用到预览数据。仅显示前 6 列。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ds.columns.slice(0, 6).map((col) => (
                    <label key={col.name} className="block">
                      <span className="text-xs text-[var(--color-text-tertiary)] block mb-1">{col.name}</span>
                      <input className="input-field" defaultValue={col.name} onBlur={(e) => renameColumn(col.name, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* 删除列 */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">删除列</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-3">勾选要删除的列（最多显示 12 列），点击删除按钮确认。</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ds.columns.slice(0, 12).map((col) => (
                    <label key={col.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                      pendingDeleteCols.includes(col.name)
                        ? 'bg-red-500/15 text-red-300 border-red-500/25'
                        : 'bg-[var(--color-bg-glass)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-accent-light)]'
                    }`}>
                      <input type="checkbox" checked={pendingDeleteCols.includes(col.name)}
                        onChange={() => setPendingDeleteCols((prev) => prev.includes(col.name) ? prev.filter((x) => x !== col.name) : [...prev, col.name])}
                        className="accent-red-500" />
                      {col.name}
                    </label>
                  ))}
                </div>
                <button className="btn-secondary text-xs !text-red-400 hover:!border-red-400/30"
                  disabled={pendingDeleteCols.length === 0}
                  onClick={() => { deleteColumns(pendingDeleteCols); setPendingDeleteCols([]); }}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除所选列 ({pendingDeleteCols.length})
                </button>
              </div>

              {/* 类型转换 */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">类型转换</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-3">在 数值 ↔ 分类 之间切换列类型（仅影响预览与分析时的处理方式）。</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {ds.columns.map((col) => (
                    <div key={col.name} className="flex items-center justify-between p-2 rounded-lg transition hover:bg-[var(--color-accent-light)]">
                      <span className="text-sm text-[var(--color-text-primary)] truncate">{col.name}</span>
                      <button
                        onClick={() => toggleColumnType(col.name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          col.type === 'numeric'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                            : 'bg-accent-light text-accent-text border border-accent-border'
                        }`}
                      >{col.type === 'numeric' ? '🔢 数值 → 分类' : '🔤 分类 → 数值'}</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 数据筛选 */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">数据筛选</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-3">按列条件过滤行（应用到数据集，可用"重置"恢复）。</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-xs text-[var(--color-text-tertiary)] block mb-1">列</span>
                    <select className="input-field" value={filterCol} onChange={(e) => setFilterCol(e.target.value)}>
                      <option value="">选择列...</option>
                      {ds.columns.map((col) => <option key={col.name} value={col.name}>{col.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--color-text-tertiary)] block mb-1">条件</span>
                    <select className="input-field" value={filterOp} onChange={(e) => setFilterOp(e.target.value)}>
                      <option value="gt">大于</option>
                      <option value="lt">小于</option>
                      <option value="eq">等于</option>
                      <option value="contains">包含</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--color-text-tertiary)] block mb-1">阈值</span>
                    <input className="input-field" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="例如 10" />
                  </label>
                  <button className="btn-primary text-xs" onClick={() => filterRows(filterCol, filterOp, filterValue)}><Filter className="h-3.5 w-3.5" /> 应用筛选</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="glass-card-static p-5 mt-6 animate-fade-in">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-text" />
          数据预览
        </h3>
        <DataTable dataset={ds} maxRows={10} highlightCells={(missingHighlights.length > 0 ? missingHighlights : []).concat(outlierHighlights.length > 0 ? outlierHighlights : [])} />
        {hasChanges && (
          <div className="mt-4 flex justify-end gap-3">
            <button className="btn-secondary" onClick={resetChanges}><RotateCcw className="h-3.5 w-3.5" /> 重置</button>
            <button className="btn-primary" onClick={applyChanges}><Play className="h-3.5 w-3.5" /> 应用更改</button>
          </div>
        )}
      </div>
    </div>
  );
}
