import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorScheme, ExportFormat } from '@/types/chart';
import { DEFAULT_THEME_ID } from '@/themes';

interface SettingsState {
  uiTheme: string;
  alpha: number;
  significantDigits: number;
  defaultColorScheme: ColorScheme;
  defaultExportFormat: ExportFormat;
  autoCleanHistory: boolean;
  historyRetentionDays: number;
  setUiTheme: (v: string) => void;
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
      uiTheme: DEFAULT_THEME_ID,
      alpha: 0.05,
      significantDigits: 3,
      defaultColorScheme: 'grayscale',
      defaultExportFormat: 'svg',
      autoCleanHistory: true,
      historyRetentionDays: 90,
      setUiTheme: (uiTheme) => set({ uiTheme }),
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
