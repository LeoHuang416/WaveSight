import { useEffect, useMemo } from 'react';
import { useSettingsStore, ROW_HEIGHT_MAP, FONT_SIZE_MAP } from '@/stores/useSettingsStore';
import { getTheme, getAccentColor } from './index';
import type { ThemeColors } from './index';

/**
 * Resolve 'system' appearance mode to actual light/dark via matchMedia.
 */
function resolveMode(mode: string): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

/**
 * Applies the currently-selected theme's CSS custom properties
 * to `document.documentElement`. Also manages `data-theme` and
 * `data-mode` attributes for CSS selector-driven styling.
 */
export function useTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const kimiRowHeight = useSettingsStore((s) => s.kimiRowHeight);
  const kimiFontSize = useSettingsStore((s) => s.kimiFontSize);
  const kimiDataAlign = useSettingsStore((s) => s.kimiDataAlign);
  const edgeSidebarMode = useSettingsStore((s) => s.edgeSidebarMode);
  const edgeCompactMode = useSettingsStore((s) => s.edgeCompactMode);
  const fluentGradient = useSettingsStore((s) => s.fluentGradient);
  const fluentGlassStrength = useSettingsStore((s) => s.fluentGlassStrength);

  const resolvedMode = useMemo(() => resolveMode(appearanceMode), [appearanceMode]);

  useEffect(() => {
    const t = getTheme(uiTheme);
    const colors: ThemeColors = resolvedMode === 'dark' ? t.dark : t.light;
    const userAccent = getAccentColor(accentColor);
    const accentHover = userAccent + 'cc';
    const accentLight = userAccent + '1f';

    const root = document.documentElement;

    // data attributes for CSS selectors
    root.setAttribute('data-theme', uiTheme);
    root.setAttribute('data-mode', resolvedMode);
    root.setAttribute('data-edge-sidebar', edgeSidebarMode);
    if (edgeCompactMode) root.setAttribute('data-edge-compact', '');
    else root.removeAttribute('data-edge-compact');
    root.setAttribute('data-fluent-gradient', fluentGradient);
    root.setAttribute('data-fluent-glass', fluentGlassStrength);

    // Colors — accent uses user-selected preset
    root.style.setProperty('--color-accent', userAccent);
    root.style.setProperty('--color-accent-hover', accentHover);
    root.style.setProperty('--color-accent-light', accentLight);
    root.style.setProperty('--color-accent-subtle', accentLight);
    root.style.setProperty('--color-text-primary', colors.textPrimary);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-tertiary', colors.textTertiary);

    // Backgrounds
    if (uiTheme === 'fluent-glass') {
      const grad = FLUENT_GRADIENTS[fluentGradient][resolvedMode];
      root.style.setProperty('--bg-app', `linear-gradient(135deg, ${grad.start}, ${grad.end})`);
      root.style.setProperty('--bg-secondary', resolvedMode === 'dark' ? '#1e293b' : '#ffffff');
      root.style.setProperty('--bg-glass', resolvedMode === 'dark' ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.65)');
      root.style.setProperty('--bg-glass-hover', resolvedMode === 'dark' ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.85)');
      root.style.setProperty('--bg-card', resolvedMode === 'dark' ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.55)');
      root.style.setProperty('--bg-sidebar', resolvedMode === 'dark' ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.4)');
      root.style.setProperty('--bg-topbar', resolvedMode === 'dark' ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.55)');
      const blur = FLUENT_BLUR[fluentGlassStrength];
      root.style.setProperty('--glass-blur', `blur(${blur}px) saturate(150%)`);
      root.style.setProperty('--glass-blur-light', `blur(${blur / 2}px) saturate(120%)`);
    } else if (t.hasGlass) {
      root.style.setProperty('--bg-app', `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgSecondary} 100%)`);
      root.style.setProperty('--bg-secondary', colors.bgSecondary);
      root.style.setProperty('--bg-glass', `rgba(255,255,255,${resolvedMode === 'dark' ? '0.08' : '0.65'})`);
      root.style.setProperty('--bg-glass-hover', `rgba(255,255,255,${resolvedMode === 'dark' ? '0.12' : '0.85'})`);
      root.style.setProperty('--bg-card', `rgba(255,255,255,${resolvedMode === 'dark' ? '0.06' : '0.55'})`);
      root.style.setProperty('--bg-sidebar', `rgba(255,255,255,${resolvedMode === 'dark' ? '0.04' : '0.4'})`);
      root.style.setProperty('--bg-topbar', `rgba(255,255,255,${resolvedMode === 'dark' ? '0.07' : '0.55'})`);
      root.style.setProperty('--glass-blur', 'blur(20px)');
      root.style.setProperty('--glass-blur-light', 'blur(10px)');
    } else {
      root.style.setProperty('--bg-app', colors.bg);
      root.style.setProperty('--bg-secondary', colors.bgSecondary);
      root.style.setProperty('--bg-glass', colors.bg);
      root.style.setProperty('--bg-glass-hover', colors.bgSecondary);
      root.style.setProperty('--bg-card', colors.bg);
      root.style.setProperty('--bg-sidebar', colors.bgSecondary);
      root.style.setProperty('--bg-topbar', colors.bg);
      root.style.setProperty('--glass-blur', 'none');
      root.style.setProperty('--glass-blur-light', 'none');
    }

    // Borders
    root.style.setProperty('--border-thin', `1px solid ${colors.border}`);
    root.style.setProperty('--border-subtle', `1px solid ${colors.borderLight}`);
    root.style.setProperty('--border-hover', `1px solid ${userAccent}33`);

    // Shadows — fluent gets elevated card shadow
    if (uiTheme === 'fluent-glass') {
      root.style.setProperty('--shadow-card', '0 8px 32px rgba(0,0,0,0.06)');
      root.style.setProperty('--shadow-elevated', '0 16px 48px rgba(0,0,0,0.1)');
    } else if (t.hasCardShadow) {
      root.style.setProperty('--shadow-card', '0 4px 12px rgba(0,0,0,0.03)');
      root.style.setProperty('--shadow-elevated', '0 8px 24px rgba(0,0,0,0.05)');
    } else {
      root.style.setProperty('--shadow-card', 'none');
      root.style.setProperty('--shadow-elevated', 'none');
    }

    // Radius
    root.style.setProperty('--radius-sm', `${t.buttonRadius - 4}px`);
    root.style.setProperty('--radius-md', `${t.buttonRadius}px`);
    root.style.setProperty('--radius-lg', `${uiTheme === 'fluent-glass' ? 20 : t.buttonRadius + 4}px`);
    root.style.setProperty('--radius-xl', `${uiTheme === 'fluent-glass' ? 24 : t.buttonRadius + 8}px`);

    // Layout dimensions
    root.style.setProperty('--sidebar-width', `${t.sidebarWidth}px`);
    root.style.setProperty('--sidebar-collapsed-width', `${t.sidebarCollapsedWidth}px`);
    root.style.setProperty('--topbar-height', `${t.topbarHeight}px`);

    // Fonts
    root.style.setProperty('--font-mono', t.fontMono);
    root.style.setProperty('--font-sans', t.fontSans);

    // Table settings
    root.style.setProperty('--table-row-height', `${ROW_HEIGHT_MAP[kimiRowHeight]}px`);
    root.style.setProperty('--table-font-size', `${FONT_SIZE_MAP[kimiFontSize]}px`);
    root.style.setProperty('--table-text-align', kimiDataAlign === 'left' ? 'left' : kimiDataAlign === 'decimal' ? 'right' : 'inherit');
  }, [uiTheme, resolvedMode, accentColor, kimiRowHeight, kimiFontSize, kimiDataAlign, edgeSidebarMode, edgeCompactMode, fluentGradient, fluentGlassStrength]);
}

const FLUENT_GRADIENTS: Record<string, Record<string, { start: string; end: string }>> = {
  cool: { light: { start: '#e0e7ff', end: '#f0f9ff' }, dark: { start: '#0f172a', end: '#1e293b' } },
  warm: { light: { start: '#fef3c7', end: '#fef9c3' }, dark: { start: '#1c1917', end: '#292524' } },
  dark: { light: { start: '#e2e8f0', end: '#cbd5e1' }, dark: { start: '#020617', end: '#0f172a' } },
};
const FLUENT_BLUR: Record<string, number> = { light: 12, standard: 24, heavy: 40 };

/** Get the Ant Design ConfigProvider theme token overrides for the current theme. */
export function useAntTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const resolvedMode = useMemo(() => resolveMode(appearanceMode), [appearanceMode]);
  const t = getTheme(uiTheme);
  const colors = resolvedMode === 'dark' ? t.dark : t.light;
  const userAccent = getAccentColor(accentColor);

  return {
    token: {
      colorPrimary: userAccent,
      colorSuccess: '#7BA587',
      colorWarning: '#C9A96E',
      colorError: '#C47878',
      colorInfo: userAccent,
      borderRadius: uiTheme === 'fluent-glass' ? 20 : t.hasCardRadius ? 12 : t.buttonRadius,
      fontFamily: t.fontSans,
      fontSize: t.antFontSize,
      colorText: colors.textPrimary,
      colorTextSecondary: colors.textSecondary,
      colorBgContainer: t.hasGlass
        ? (resolvedMode === 'dark' ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.65)')
        : colors.bg,
      colorBorder: colors.border,
      paddingLG: 24,
      colorBgElevated: colors.bgSecondary,
      colorBgLayout: colors.bg,
      colorBgSpotlight: colors.textPrimary,
      colorTextPlaceholder: colors.textTertiary,
      colorBorderSecondary: colors.borderLight,
    },
    algorithm: undefined as unknown,
  };
}
