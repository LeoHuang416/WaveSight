import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorScheme, ExportFormat } from '@/types/chart';

interface SettingsState {
  alpha: number;
  significantDigits: number;
  defaultColorScheme: ColorScheme;
  defaultExportFormat: ExportFormat;
  autoCleanHistory: boolean;
  historyRetentionDays: number;
  setAlpha: (v: number) => void;
  setSignificantDigits: (v: number) => void;
  setDefaultColorScheme: (v: ColorScheme) => void;
  setDefaultExportFormat: (v: ExportFormat) => void;
  setAutoCleanHistory: (v: boolean) => void;
  setHistoryRetentionDays: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      alpha: 0.05,
      significantDigits: 3,
      defaultColorScheme: 'grayscale',
      defaultExportFormat: 'svg',
      autoCleanHistory: true,
      historyRetentionDays: 90,
      setAlpha: (alpha) => set({ alpha }),
      setSignificantDigits: (significantDigits) => set({ significantDigits }),
      setDefaultColorScheme: (defaultColorScheme) => set({ defaultColorScheme }),
      setDefaultExportFormat: (defaultExportFormat) => set({ defaultExportFormat }),
      setAutoCleanHistory: (autoCleanHistory) => set({ autoCleanHistory }),
      setHistoryRetentionDays: (historyRetentionDays) => set({ historyRetentionDays }),
    }),
    { name: 'data-workbench-settings' }
  )
);
