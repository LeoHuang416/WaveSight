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
  buttonRadius: 8,

  hasGlass: false,
  hasCardShadow: false,
  hasCardRadius: false,

  fontMono: "'JetBrains Mono', 'SF Mono', 'Consolas', monospace",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  antFontSize: 14,
};

/* ─── Theme Registry ─── */
export const THEMES: ThemeDefinition[] = [macosGlass, kimiMinimal];

export const DEFAULT_THEME_ID = 'macos-glass';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? macosGlass;
}
