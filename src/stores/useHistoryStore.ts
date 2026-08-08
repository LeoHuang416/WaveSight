import { create } from 'zustand';
import type { HistoryRecord, HistoryFilter } from '@/types/history';
import { getAllHistory, saveHistory, deleteHistory as dbDeleteHistory } from '@/db/operations';

interface HistoryState {
  records: HistoryRecord[];
  selectedId: string | null;
  filter: HistoryFilter;
  refresh: () => Promise<void>;
  addRecord: (record: HistoryRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  setSelected: (id: string | null) => void;
  setFilter: (filter: HistoryFilter) => void;
  updateNote: (id: string, note: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  records: [],
  selectedId: null,
  filter: {},
  refresh: async () => { const records = await getAllHistory(); set({ records }); },
  addRecord: async (record) => { await saveHistory(record); await get().refresh(); },
  removeRecord: async (id) => { await dbDeleteHistory(id); set((s) => ({ records: s.records.filter((r) => r.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })); },
  setSelected: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
  updateNote: async (id, note) => {
    const record = get().records.find((r) => r.id === id);
    if (record) { const updated = { ...record, note }; await saveHistory(updated); set((s) => ({ records: s.records.map((r) => (r.id === id ? updated : r)) })); }
  },
}));
