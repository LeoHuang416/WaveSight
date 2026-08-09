import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';
import { saveDataset, getDataset, getAllDatasets, deleteDataset, getStorageStats, clearAllData, saveChart, getAllCharts, saveHistory, getAllHistory } from './operations';
import type { Dataset } from '@/types/data';
import type { ChartConfig } from '@/types/chart';
import type { HistoryRecord } from '@/types/history';

const makeDataset = (id: string): Dataset => ({
  id, name: `test-${id}`, fileName: 'test.csv',
  columns: [{ name: 'x', type: 'numeric', role: 'unknown', index: 0 }],
  rows: [{ x: 1 }, { x: 2 }], rowCount: 2, colCount: 1,
  importedAt: Date.now(),
});

describe('Dataset CRUD', () => {
  beforeEach(async () => {
    await db.datasets.clear();
    await db.charts.clear();
    await db.history.clear();
  });

  it('saves and retrieves a dataset', async () => {
    const ds = makeDataset('d1');
    await saveDataset(ds);
    const loaded = await getDataset('d1');
    expect(loaded).toBeDefined();
    expect(loaded!.name).toBe('test-d1');
    expect(loaded!.rowCount).toBe(2);
  });

  it('returns undefined for missing dataset', async () => {
    expect(await getDataset('nonexistent')).toBeUndefined();
  });

  it('lists all datasets sorted by import time', async () => {
    const d1 = makeDataset('d1'); d1.importedAt = 1000;
    const d2 = makeDataset('d2'); d2.importedAt = 2000;
    await saveDataset(d1);
    await saveDataset(d2);
    const all = await getAllDatasets();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('d2'); // newest first
  });

  it('deletes a dataset', async () => {
    await saveDataset(makeDataset('d1'));
    await deleteDataset('d1');
    expect(await getDataset('d1')).toBeUndefined();
  });

  it('gets storage stats', async () => {
    await saveDataset(makeDataset('d1'));
    const stats = await getStorageStats();
    expect(stats.datasetCount).toBe(1);
    expect(stats.chartCount).toBe(0);
    expect(stats.historyCount).toBe(0);
  });

  it('clears all data', async () => {
    await saveDataset(makeDataset('d1'));
    await clearAllData();
    const stats = await getStorageStats();
    expect(stats.datasetCount).toBe(0);
  });
});

describe('chart/history persistence (function stripping)', () => {
  beforeEach(async () => { await db.charts.clear(); await db.history.clear(); });

  const fnChart = (): ChartConfig => ({
    id: 'c1', title: 't', chartType: 'contour', datasetId: 'd', columnMapping: {},
    echartsOption: { series: [{ type: 'custom', renderItem: () => ({}) }, { type: 'line', data: [[0, 1]] }] },
    colorScheme: 'grayscale', legendPosition: 'right', fontSize: 12, xAxisLabel: '', yAxisLabel: '', createdAt: 1,
  });

  it('saves a chart whose option contains a renderItem function (no DataCloneError)', async () => {
    await expect(saveChart(fnChart())).resolves.toBe('c1');
    const all = await getAllCharts();
    expect(all).toHaveLength(1);
    const series = (all[0].echartsOption.series as Record<string, unknown>[]);
    expect(series[0].type).toBe('custom');
    expect((series[0] as { renderItem?: unknown }).renderItem).toBeUndefined(); // 函数被剥离
    expect(series[1].data).toEqual([[0, 1]]); // 数据保留
  });

  it('saves a history record whose result contains function-based chart options', async () => {
    const rec: HistoryRecord = {
      id: 'h1', datasetName: 'd', note: '', relatedChartIds: [], createdAt: 1,
      analysisConfig: { datasetId: 'd', analysisType: 'rsm' } as never,
      result: { chartData: [{ chartType: 'surface3d', title: '3D', data: { series: [{ type: 'surface', data: [] }], visualMap: {} } }] } as never,
    };
    await expect(saveHistory(rec)).resolves.toBe('h1');
    const all = await getAllHistory();
    expect(all).toHaveLength(1);
    expect(all[0].result).toBeDefined();
  });
});
