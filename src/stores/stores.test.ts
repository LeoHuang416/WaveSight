import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './useSettingsStore';
import { useDataStore } from './useDataStore';
import { useHistoryStore } from './useHistoryStore';
import { db } from '@/db/index';
import { saveDataset } from '@/db/operations';
import type { Dataset } from '@/types/data';

describe('useSettingsStore', () => {
  it('has default values', () => {
    expect(useSettingsStore.getState().alpha).toBe(0.05);
    expect(useSettingsStore.getState().significantDigits).toBe(3);
    expect(useSettingsStore.getState().defaultColorScheme).toBe('grayscale');
  });
  it('updates alpha', () => {
    useSettingsStore.getState().setAlpha(0.01);
    expect(useSettingsStore.getState().alpha).toBe(0.01);
    useSettingsStore.getState().setAlpha(0.05); // reset
  });
  it('updates significant digits', () => {
    useSettingsStore.getState().setSignificantDigits(4);
    expect(useSettingsStore.getState().significantDigits).toBe(4);
    useSettingsStore.getState().setSignificantDigits(3);
  });
  it('supports csv as export format', () => {
    expect(useSettingsStore.getState().defaultExportFormat).toBe('svg');
    useSettingsStore.getState().setDefaultExportFormat('csv');
    expect(useSettingsStore.getState().defaultExportFormat).toBe('csv');
    useSettingsStore.getState().setDefaultExportFormat('svg');
  });
});

describe('useDataStore', () => {
  beforeEach(async () => { await db.datasets.clear(); });
  it('starts with no dataset', () => {
    expect(useDataStore.getState().currentDataset).toBeNull();
  });
  it('loads a dataset by id', async () => {
    const ds: Dataset = { id: 'test-1', name: 'test', fileName: 't.csv', columns: [{ name: 'x', type: 'numeric', index: 0 }], rows: [{ x: 1 }], rowCount: 1, colCount: 1, importedAt: Date.now() };
    await saveDataset(ds);
    await useDataStore.getState().setCurrentDataset('test-1');
    expect(useDataStore.getState().currentDataset?.name).toBe('test');
  });
  it('getNumericColumns returns numeric columns', async () => {
    const ds: Dataset = { id: 'test-2', name: 'test', fileName: 't.csv', columns: [{ name: 'x', type: 'numeric', index: 0 }, { name: 'cat', type: 'categorical', index: 1 }], rows: [{ x: 1, cat: 'A' }], rowCount: 1, colCount: 2, importedAt: Date.now() };
    await saveDataset(ds);
    await useDataStore.getState().setCurrentDataset('test-2');
    expect(useDataStore.getState().getNumericColumns()).toHaveLength(1);
    expect(useDataStore.getState().getCategoricalColumns()).toHaveLength(1);
  });
});

describe('useHistoryStore', () => {
  beforeEach(async () => { await db.history.clear(); });
  it('starts empty', () => {
    expect(useHistoryStore.getState().records).toHaveLength(0);
  });
  it('adds a record', async () => {
    await useHistoryStore.getState().addRecord({
      id: 'hr-1', analysisConfig: { type: 'descriptive', datasetId: 'd1' },
      result: { id: 'r1', config: { type: 'descriptive', datasetId: 'd1' }, tables: [], conclusion: 'ok', timestamp: Date.now() },
      datasetName: 'test', relatedChartIds: [], note: '', createdAt: Date.now(),
    });
    expect(useHistoryStore.getState().records).toHaveLength(1);
  });
});
