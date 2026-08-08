import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';
import { saveDataset, getDataset, getAllDatasets, deleteDataset, getStorageStats, clearAllData } from './operations';
import type { Dataset } from '@/types/data';

const makeDataset = (id: string): Dataset => ({
  id, name: `test-${id}`, fileName: 'test.csv',
  columns: [{ name: 'x', type: 'numeric', index: 0 }],
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
