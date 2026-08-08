import { create } from 'zustand';
import type { ChartConfig } from '@/types/chart';
import { getAllCharts, saveChart, deleteChart as dbDeleteChart } from '@/db/operations';

interface ChartState {
  charts: ChartConfig[];
  editingChartId: string | null;
  viewMode: 'gallery' | 'editor';
  refresh: () => Promise<void>;
  addChart: (cfg: ChartConfig) => Promise<void>;
  removeChart: (id: string) => Promise<void>;
  setEditingChart: (id: string | null) => void;
  setViewMode: (mode: 'gallery' | 'editor') => void;
}

export const useChartStore = create<ChartState>()((set, get) => ({
  charts: [],
  editingChartId: null,
  viewMode: 'gallery',
  refresh: async () => { const charts = await getAllCharts(); set({ charts }); },
  addChart: async (cfg) => { set((s) => ({ charts: [cfg, ...s.charts] })); await saveChart(cfg); const charts = await getAllCharts(); set({ charts }); },
  removeChart: async (id) => { await dbDeleteChart(id); const charts = await getAllCharts(); set({ charts, editingChartId: get().editingChartId === id ? null : get().editingChartId }); },
  setEditingChart: (id) => set({ editingChartId: id, viewMode: id ? 'editor' : 'gallery' }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
