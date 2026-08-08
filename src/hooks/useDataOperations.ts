import { useCallback } from 'react';
import { saveDataset } from '@/db/operations';
import { useDataStore } from '@/stores/useDataStore';
import { generateId } from '@/utils/format';
import type { Dataset, ColumnMeta } from '@/types/data';

const CHUNK_SIZE = 50000; // Save rows in chunks of 50k for IndexedDB performance

export function useDataOperations() {
  const { setCurrentDataset, refreshDatasetList, updateCurrentDataset } = useDataStore();

  const importDataset = useCallback(async (params: {
    name: string;
    fileName: string;
    columns: ColumnMeta[];
    rows: Record<string, unknown>[];
    experimentGroupCol?: string;
  }) => {
    const makeDataset = (chunkRows: Record<string, unknown>[]): Dataset => ({
      id: generateId(),
      name: params.name,
      fileName: params.fileName,
      columns: params.columns,
      rows: chunkRows,
      rowCount: params.rows.length,
      colCount: params.columns.length,
      importedAt: Date.now(),
      experimentGroupCol: params.experimentGroupCol,
    });

    if (params.rows.length > CHUNK_SIZE) {
      const chunks: Record<string, unknown>[][] = [];
      for (let i = 0; i < params.rows.length; i += CHUNK_SIZE) {
        chunks.push(params.rows.slice(i, i + CHUNK_SIZE));
      }
      const ds = makeDataset(chunks[0]);
      await saveDataset(ds);
      for (let i = 1; i < chunks.length; i++) {
        ds.rows.push(...chunks[i]);
        await saveDataset(ds);
      }
      await setCurrentDataset(ds.id);
      await refreshDatasetList();
      return ds;
    }

    const ds = makeDataset(params.rows);
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
