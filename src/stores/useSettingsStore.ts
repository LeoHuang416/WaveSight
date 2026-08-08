import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorScheme, ExportFormat } from '@/types/chart';
import { DEFAULT_THEME_ID } from '@/themes';

export type AppearanceMode = 'light' | 'dark';
export type RowHeight = 'compact' | 'standard' | 'relaxed';
export type FontSize = 'small' | 'standard' | 'large';
export type DataAlign = 'auto' | 'left' | 'decimal';
export type EdgeSidebarMode = 'always' | 'auto' | 'hidden';
export type EdgePanelDefault = 'expanded' | 'collapsed';
export type EdgeTabPosition = 'top' | 'left';

export const ROW_HEIGHT_MAP: Record<RowHeight, number> = { compact: 40, standard: 48, relaxed: 56 };
export const FONT_SIZE_MAP: Record<FontSize, number> = { small: 12, standard: 14, large: 16 };

interface SettingsState {
  uiTheme: string;
  appearanceMode: AppearanceMode;
  kimiRowHeight: RowHeight;
  kimiFontSize: FontSize;
  kimiDataAlign: DataAlign;
  edgeSidebarMode: EdgeSidebarMode;
  edgePanelDefault: EdgePanelDefault;
  edgeTabPosition: EdgeTabPosition;
  edgeCompactMode: boolean;
  alpha: number;
  significantDigits: number;
  defaultColorScheme: ColorScheme;
  defaultExportFormat: ExportFormat;
  autoCleanHistory: boolean;
  historyRetentionDays: number;
  setUiTheme: (v: string) => void;
  setAppearanceMode: (v: AppearanceMode) => void;
  setKimiRowHeight: (v: RowHeight) => void;
  setKimiFontSize: (v: FontSize) => void;
  setKimiDataAlign: (v: DataAlign) => void;
  setEdgeSidebarMode: (v: EdgeSidebarMode) => void;
  setEdgePanelDefault: (v: EdgePanelDefault) => void;
  setEdgeTabPosition: (v: EdgeTabPosition) => void;
  setEdgeCompactMode: (v: boolean) => void;
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
      appearanceMode: 'light' as AppearanceMode,
      kimiRowHeight: 'standard' as RowHeight,
      kimiFontSize: 'standard' as FontSize,
      kimiDataAlign: 'auto' as DataAlign,
      edgeSidebarMode: 'always' as EdgeSidebarMode,
      edgePanelDefault: 'expanded' as EdgePanelDefault,
      edgeTabPosition: 'top' as EdgeTabPosition,
      edgeCompactMode: false,
      alpha: 0.05,
      significantDigits: 3,
      defaultColorScheme: 'grayscale',
      defaultExportFormat: 'svg',
      autoCleanHistory: true,
      historyRetentionDays: 90,
      setUiTheme: (uiTheme) => set({ uiTheme }),
      setAppearanceMode: (appearanceMode) => set({ appearanceMode }),
      setKimiRowHeight: (kimiRowHeight) => set({ kimiRowHeight }),
      setKimiFontSize: (kimiFontSize) => set({ kimiFontSize }),
      setKimiDataAlign: (kimiDataAlign) => set({ kimiDataAlign }),
      setEdgeSidebarMode: (edgeSidebarMode) => set({ edgeSidebarMode }),
      setEdgePanelDefault: (edgePanelDefault) => set({ edgePanelDefault }),
      setEdgeTabPosition: (edgeTabPosition) => set({ edgeTabPosition }),
      setEdgeCompactMode: (edgeCompactMode) => set({ edgeCompactMode }),
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
