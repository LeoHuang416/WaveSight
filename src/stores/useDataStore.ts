import { create } from 'zustand';
import type { Dataset, ColumnMeta } from '@/types/data';
import { getAllDatasets, getDataset } from '@/db/operations';

interface DataState {
  currentDatasetId: string | null;
  currentDataset: Dataset | null;
  datasetList: Dataset[];
  loading: boolean;
  setCurrentDataset: (id: string | null) => Promise<void>;
  refreshDatasetList: () => Promise<void>;
  updateCurrentDataset: (ds: Dataset) => void;
  getColumnByName: (name: string) => ColumnMeta | undefined;
  getNumericColumns: () => ColumnMeta[];
  getCategoricalColumns: () => ColumnMeta[];
}

export const useDataStore = create<DataState>()((set, get) => ({
  currentDatasetId: null,
  currentDataset: null,
  datasetList: [],
  loading: false,
  setCurrentDataset: async (id) => {
    if (!id) { set({ currentDatasetId: null, currentDataset: null }); return; }
    set({ loading: true });
    const ds = await getDataset(id);
    set({ currentDatasetId: id, currentDataset: ds ?? null, loading: false });
  },
  refreshDatasetList: async () => { const list = await getAllDatasets(); set({ datasetList: list }); },
  updateCurrentDataset: (ds) => set({ currentDataset: ds }),
  getColumnByName: (name) => get().currentDataset?.columns.find((c) => c.name === name),
  getNumericColumns: () => get().currentDataset?.columns.filter((c) => c.type === 'numeric') ?? [],
  getCategoricalColumns: () => get().currentDataset?.columns.filter((c) => c.type === 'categorical') ?? [],
}));
