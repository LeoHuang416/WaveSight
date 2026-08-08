/**
 * Theme registry — each theme is a complete visual design scheme.
 * Add new themes here; the settings page auto-populates the selector.
 */

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  accent: string;
  accentHover: string;
  accentLight: string;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;

  /* Layout */
  sidebarWidth: number;
  sidebarCollapsedWidth: number;
  topbarHeight: number;
  buttonRadius: number;

  /* Feature flags */
  hasGlass: boolean;
  hasCardShadow: boolean;
  hasCardRadius: boolean;

  /* Typography */
  fontMono: string;
  fontSans: string;
  antFontSize: number;
}

/* ────── Theme 1: macOS Glass ────── */
const macosGlass: ThemeDefinition = {
  id: 'macos-glass',
  label: 'macOS 毛玻璃',
  description: '轻盈、通透、克制的 macOS 风格毛玻璃设计',

  light: {
    bg: '#F7F9FC',
    bgSecondary: '#FFFFFF',
    textPrimary: '#333333',
    textSecondary: '#888888',
    textTertiary: '#b0b0b0',
    border: '#eeeeee',
    borderLight: '#f5f5f5',
    accent: '#5B7F95',
    accentHover: '#4A6B7F',
    accentLight: 'rgba(91,127,149,0.08)',
  },
  dark: {
    bg: '#1a1a1a',
    bgSecondary: '#252525',
    textPrimary: '#e0e0e0',
    textSecondary: '#999999',
    textTertiary: '#666666',
    border: '#333333',
    borderLight: '#2a2a2a',
    accent: '#6B8FA5',
    accentHover: '#5B7F95',
    accentLight: 'rgba(107,143,165,0.12)',
  },

  sidebarWidth: 240,
  sidebarCollapsedWidth: 64,
  topbarHeight: 56,
  buttonRadius: 12,

  hasGlass: true,
  hasCardShadow: true,
  hasCardRadius: true,

  fontMono: "'SF Mono', 'JetBrains Mono', 'Consolas', monospace",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  antFontSize: 14,
};

/* ────── Theme 2: Kimi Minimal ────── */
const kimiMinimal: ThemeDefinition = {
  id: 'kimi-minimal',
  label: 'Kimi Minimal',
  description: '极致极简、学术护眼、零装饰的功能优先设计',

  light: {
    bg: '#ffffff',
    bgSecondary: '#fafafa',
    textPrimary: '#111111',
    textSecondary: '#555555',
    textTertiary: '#999999',
    border: '#eeeeee',
    borderLight: '#f5f5f5',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentLight: 'rgba(37,99,235,0.08)',
  },
  dark: {
    bg: '#0a0a0a',
    bgSecondary: '#141414',
    textPrimary: '#e8e8e8',
    textSecondary: '#a0a0a0',
    textTertiary: '#666666',
    border: '#222222',
    borderLight: '#1a1a1a',
    accent: '#3b82f6',
    accentHover: '#60a5fa',
    accentLight: 'rgba(59,130,246,0.12)',
  },

  sidebarWidth: 200,
  sidebarCollapsedWidth: 56,
  topbarHeight: 56,
  buttonRadius: 8,

  hasGlass: false,
  hasCardShadow: false,
  hasCardRadius: false,

  fontMono: "'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  antFontSize: 14,
};

/* ────── Theme 3: Edge Modern ────── */
const edgeModern: ThemeDefinition = {
  id: 'edge-modern',
  label: 'Edge Modern',
  description: '多面板生产力布局 — 清晰区域分割、Acrylic 导航、微软 Edge 风格',

  light: {
    bg: '#f8f9fa',
    bgSecondary: '#ffffff',
    textPrimary: '#202124',
    textSecondary: '#5f6368',
    textTertiary: '#80868b',
    border: '#dadce0',
    borderLight: '#e8eaed',
    accent: '#0078d4',
    accentHover: '#106ebe',
    accentLight: 'rgba(0,120,212,0.08)',
  },
  dark: {
    bg: '#171717',
    bgSecondary: '#202124',
    textPrimary: '#e8eaed',
    textSecondary: '#9aa0a6',
    textTertiary: '#80868b',
    border: '#3c4043',
    borderLight: '#2d2e31',
    accent: '#4dabf7',
    accentHover: '#74bffa',
    accentLight: 'rgba(77,171,247,0.12)',
  },

  sidebarWidth: 200,
  sidebarCollapsedWidth: 56,
  topbarHeight: 48,
  buttonRadius: 8,

  hasGlass: false,
  hasCardShadow: false,
  hasCardRadius: true,

  fontMono: "'Cascadia Code', 'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
  fontSans: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
  antFontSize: 14,
};

/* ────── Theme 4: Fluent Glass ────── */
const fluentGlass: ThemeDefinition = {
  id: 'fluent-glass',
  label: 'Fluent Glass',
  description: '毛玻璃仪表盘 — 全屏渐变背景、悬浮 KPI 卡片、第一眼高级感',

  light: {
    bg: '#e0e7ff',
    bgSecondary: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    border: 'rgba(255,255,255,0.35)',
    borderLight: 'rgba(255,255,255,0.2)',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentLight: 'rgba(37,99,235,0.12)',
  },
  dark: {
    bg: '#0f172a',
    bgSecondary: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    border: 'rgba(255,255,255,0.08)',
    borderLight: 'rgba(255,255,255,0.04)',
    accent: '#60a5fa',
    accentHover: '#93bbfd',
    accentLight: 'rgba(96,165,250,0.15)',
  },

  sidebarWidth: 240,
  sidebarCollapsedWidth: 64,
  topbarHeight: 56,
  buttonRadius: 12,

  hasGlass: true,
  hasCardShadow: true,
  hasCardRadius: true,

  fontMono: "'SF Mono', 'JetBrains Mono', 'Consolas', monospace",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  antFontSize: 14,
};

/* ─── Accent Color Presets ─── */
export interface AccentPreset {
  id: string;
  label: string;
  color: string;
}
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', label: '学术蓝', color: '#2563eb' },
  { id: 'green', label: '生物绿', color: '#059669' },
  { id: 'purple', label: '物理紫', color: '#7c3aed' },
  { id: 'orange', label: '工程橙', color: '#d97706' },
];
export const DEFAULT_ACCENT = 'blue';

export function getAccentColor(presetId: string): string {
  return ACCENT_PRESETS.find((p) => p.id === presetId)?.color ?? ACCENT_PRESETS[0].color;
}

/* ─── Theme Registry ─── */
export const THEMES: ThemeDefinition[] = [macosGlass, kimiMinimal, edgeModern, fluentGlass];

export const DEFAULT_THEME_ID = 'macos-glass';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? macosGlass;
}
