import { useCallback } from 'react';
import { saveDataset } from '@/db/operations';
import { useDataStore } from '@/stores/useDataStore';
import { generateId } from '@/utils/format';
import type { Dataset, ColumnMeta } from '@/types/data';

export function useDataOperations() {
  const { setCurrentDataset, refreshDatasetList, updateCurrentDataset } = useDataStore();

  const importDataset = useCallback(async (params: {
    name: string;
    fileName: string;
    columns: ColumnMeta[];
    rows: Record<string, unknown>[];
  }) => {
    const ds: Dataset = {
      id: generateId(),
      name: params.name,
      fileName: params.fileName,
      columns: params.columns,
      rows: params.rows,
      rowCount: params.rows.length,
      colCount: params.columns.length,
      importedAt: Date.now(),
    };
    await saveDataset(ds);
    await setCurrentDataset(ds.id);
    await refreshDatasetList();
    return ds;
  }, [setCurrentDataset, refreshDatasetList]);

  const updateDataset = useCallback(async (ds: Dataset) => {
    await saveDataset(ds);
    updateCurrentDataset(ds);
  }, [updateCurrentDataset]);

  return { importDataset, updateDataset };
}
