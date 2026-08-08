/**
 * Theme registry — each theme is a complete visual design scheme.
 * Add new themes here; the settings page auto-populates the selector.
 */

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;

  // Colors
  colorAccent: string;
  colorAccentHover: string;
  colorAccentLight: string;
  colorAccentSubtle: string;
  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextTertiary: string;

  // Backgrounds
  bgApp: string;
  bgGlass: string;
  bgGlassHover: string;
  bgGlassActive: string;
  bgCard: string;
  bgSidebar: string;
  bgTopbar: string;
  bgInput: string;

  // Glass
  glassBlur: string;
  glassBlurLight: string;

  // Borders
  borderThin: string;
  borderSubtle: string;
  borderHover: string;

  // Shadows
  shadowCard: string;
  shadowElevated: string;

  // Radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;

  // Ant Design token overrides
  antBorderRadius: number;
  antColorBgContainer: string;
  antColorBorder: string;
}

/* ─── Theme 1: macOS Glass (current default) ─── */
const macosGlass: ThemeDefinition = {
  id: 'macos-glass',
  label: 'macOS 毛玻璃',
  description: '轻盈、通透、克制的 macOS 风格毛玻璃设计',

  colorAccent: '#5B7F95',
  colorAccentHover: '#4A6B7F',
  colorAccentLight: 'rgba(91, 127, 149, 0.08)',
  colorAccentSubtle: 'rgba(91, 127, 149, 0.04)',
  colorTextPrimary: '#333333',
  colorTextSecondary: '#888888',
  colorTextTertiary: '#b0b0b0',

  bgApp: 'linear-gradient(135deg, #F7F9FC 0%, #EFF2F7 100%)',
  bgGlass: 'rgba(255, 255, 255, 0.65)',
  bgGlassHover: 'rgba(255, 255, 255, 0.85)',
  bgGlassActive: 'rgba(255, 255, 255, 0.95)',
  bgCard: 'rgba(255, 255, 255, 0.55)',
  bgSidebar: 'rgba(255, 255, 255, 0.4)',
  bgTopbar: 'rgba(255, 255, 255, 0.55)',
  bgInput: 'rgba(255, 255, 255, 0.7)',

  glassBlur: 'blur(20px)',
  glassBlurLight: 'blur(10px)',

  borderThin: '1px solid rgba(255, 255, 255, 0.8)',
  borderSubtle: '1px solid rgba(0, 0, 0, 0.06)',
  borderHover: '1px solid rgba(91, 127, 149, 0.2)',

  shadowCard: '0 4px 12px rgba(0, 0, 0, 0.03)',
  shadowElevated: '0 8px 24px rgba(0, 0, 0, 0.05)',

  radiusSm: '8px',
  radiusMd: '12px',
  radiusLg: '16px',
  radiusXl: '20px',

  antBorderRadius: 12,
  antColorBgContainer: 'rgba(255,255,255,0.65)',
  antColorBorder: 'rgba(0,0,0,0.06)',
};

/* ─── Theme Registry ─── */
export const THEMES: ThemeDefinition[] = [macosGlass];

export const DEFAULT_THEME_ID = 'macos-glass';

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? macosGlass;
}
