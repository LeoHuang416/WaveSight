import { db } from './index';
import type { Dataset } from '@/types/data';
import type { ChartConfig } from '@/types/chart';
import type { HistoryRecord } from '@/types/history';

/**
 * echartsOption 内含 renderItem/formatter 等函数，IndexedDB 无法结构化克隆（DataCloneError）。
 * 存储前递归剥离函数；读取后由图表配置重建完整 option（ChartsPage renderOption）。
 */
function stripFunctions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripFunctions);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (typeof v !== 'function') out[k] = stripFunctions(v);
    return out;
  }
  return value;
}

export async function saveDataset(ds: Dataset): Promise<string> { await db.datasets.put(ds); return ds.id; }
export async function getDataset(id: string): Promise<Dataset | undefined> { return db.datasets.get(id); }
export async function getAllDatasets(): Promise<Dataset[]> { return db.datasets.orderBy('importedAt').reverse().toArray(); }
export async function deleteDataset(id: string): Promise<void> { await db.datasets.delete(id); }
export async function saveChart(cfg: ChartConfig): Promise<string> { await db.charts.put({ ...cfg, echartsOption: stripFunctions(cfg.echartsOption) as Record<string, unknown> }); return cfg.id; }
export async function getChart(id: string): Promise<ChartConfig | undefined> { return db.charts.get(id); }
export async function getAllCharts(): Promise<ChartConfig[]> { return db.charts.orderBy('createdAt').reverse().toArray(); }
export async function deleteChart(id: string): Promise<void> { await db.charts.delete(id); }
export async function saveHistory(record: HistoryRecord): Promise<string> { await db.history.put({ ...record, result: stripFunctions(record.result) } as HistoryRecord); return record.id; }
export async function getHistory(id: string): Promise<HistoryRecord | undefined> { return db.history.get(id); }
export async function getAllHistory(): Promise<HistoryRecord[]> { return db.history.orderBy('createdAt').reverse().toArray(); }
export async function deleteHistory(id: string): Promise<void> { await db.history.delete(id); }

export async function getStorageStats(): Promise<{ datasetCount: number; chartCount: number; historyCount: number }> {
  const [datasetCount, chartCount, historyCount] = await Promise.all([db.datasets.count(), db.charts.count(), db.history.count()]);
  return { datasetCount, chartCount, historyCount };
}

export async function clearAllData(): Promise<void> {
  await Promise.all([db.datasets.clear(), db.charts.clear(), db.history.clear()]);
}

export async function exportAllData(): Promise<{ datasets: Dataset[]; charts: ChartConfig[]; history: HistoryRecord[] }> {
  const [datasets, charts, history] = await Promise.all([db.datasets.toArray(), db.charts.toArray(), db.history.toArray()]);
  return { datasets, charts, history };
}
