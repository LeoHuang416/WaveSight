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
  it('has default theme', () => {
    expect(useSettingsStore.getState().uiTheme).toBe('macos-glass');
  });
  it('switches theme', () => {
    useSettingsStore.getState().setUiTheme('kimi-minimal');
    expect(useSettingsStore.getState().uiTheme).toBe('kimi-minimal');
    useSettingsStore.getState().setUiTheme('macos-glass');
  });
  it('has default appearance mode light', () => {
    expect(useSettingsStore.getState().appearanceMode).toBe('light');
  });
  it('toggles dark mode', () => {
    useSettingsStore.getState().setAppearanceMode('dark');
    expect(useSettingsStore.getState().appearanceMode).toBe('dark');
    useSettingsStore.getState().setAppearanceMode('light');
  });
  it('has kimi defaults', () => {
    expect(useSettingsStore.getState().kimiRowHeight).toBe('standard');
    expect(useSettingsStore.getState().kimiFontSize).toBe('standard');
    expect(useSettingsStore.getState().kimiDataAlign).toBe('auto');
  });
  it('has edge defaults', () => {
    expect(useSettingsStore.getState().edgeSidebarMode).toBe('always');
    expect(useSettingsStore.getState().edgePanelDefault).toBe('expanded');
    expect(useSettingsStore.getState().edgeTabPosition).toBe('top');
    expect(useSettingsStore.getState().edgeCompactMode).toBe(false);
  });
  it('has fluent defaults', () => {
    expect(useSettingsStore.getState().accentColor).toBe('blue');
    expect(useSettingsStore.getState().fluentGradient).toBe('cool');
    expect(useSettingsStore.getState().fluentGlassStrength).toBe('standard');
  });
  it('has system appearance mode', () => {
    expect(useSettingsStore.getState().appearanceMode).toBe('light');
    useSettingsStore.getState().setAppearanceMode('system');
    expect(useSettingsStore.getState().appearanceMode).toBe('system');
    useSettingsStore.getState().setAppearanceMode('light');
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
  it('refreshes dataset list to empty after db clear', async () => {
    await useDataStore.getState().refreshDatasetList();
    const list = useDataStore.getState().datasetList;
    expect(list).toHaveLength(0);
  });
});

describe('useHistoryStore', () => {
  beforeEach(async () => { await db.history.clear(); useHistoryStore.getState().refresh(); });
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
  it('clears records from view after clearAllData + refresh', async () => {
    await useHistoryStore.getState().addRecord({
      id: 'hr-clr', analysisConfig: { type: 'descriptive', datasetId: 'd1' },
      result: { id: 'r2', config: { type: 'descriptive', datasetId: 'd1' }, tables: [], conclusion: 'ok', timestamp: Date.now() },
      datasetName: 'test', relatedChartIds: [], note: '', createdAt: Date.now(),
    });
    expect(useHistoryStore.getState().records).toHaveLength(1);
    await db.history.clear();
    await useHistoryStore.getState().refresh();
    expect(useHistoryStore.getState().records).toHaveLength(0);
  });
});
