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
  }) => {
    // For very large datasets, split rows and store as separate smaller datasets
    // with a shared prefix, or chunk the save operation
    if (params.rows.length > CHUNK_SIZE) {
      // Chunk the rows into the dataset to avoid IndexedDB transaction limits
      const chunks: Record<string, unknown>[][] = [];
      for (let i = 0; i < params.rows.length; i += CHUNK_SIZE) {
        chunks.push(params.rows.slice(i, i + CHUNK_SIZE));
      }

      // Save first chunk with metadata, then append remaining chunks
      const ds: Dataset = {
        id: generateId(),
        name: params.name,
        fileName: params.fileName,
        columns: params.columns,
        rows: chunks[0],
        rowCount: params.rows.length,
        colCount: params.columns.length,
        importedAt: Date.now(),
      };
      await saveDataset(ds);

      // Append remaining chunks
      for (let i = 1; i < chunks.length; i++) {
        ds.rows.push(...chunks[i]);
        await saveDataset(ds);
      }

      await setCurrentDataset(ds.id);
      await refreshDatasetList();
      return ds;
    }

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
