import { useEffect } from 'react';
import { useSettingsStore, ROW_HEIGHT_MAP, FONT_SIZE_MAP } from '@/stores/useSettingsStore';
import { getTheme } from './index';
import type { ThemeColors } from './index';

/**
 * Applies the currently-selected theme's CSS custom properties
 * to `document.documentElement`. Also manages `data-theme` and
 * `data-mode` attributes for CSS selector-driven styling.
 */
export function useTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const kimiRowHeight = useSettingsStore((s) => s.kimiRowHeight);
  const kimiFontSize = useSettingsStore((s) => s.kimiFontSize);
  const kimiDataAlign = useSettingsStore((s) => s.kimiDataAlign);
  const edgeSidebarMode = useSettingsStore((s) => s.edgeSidebarMode);
  const edgeCompactMode = useSettingsStore((s) => s.edgeCompactMode);

  useEffect(() => {
    const t = getTheme(uiTheme);
    const colors: ThemeColors = appearanceMode === 'dark' ? t.dark : t.light;

    const root = document.documentElement;

    // data attributes for CSS selectors
    root.setAttribute('data-theme', uiTheme);
    root.setAttribute('data-mode', appearanceMode);
    root.setAttribute('data-edge-sidebar', edgeSidebarMode);
    if (edgeCompactMode) root.setAttribute('data-edge-compact', '');
    else root.removeAttribute('data-edge-compact');

    // Colors
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-accent-hover', colors.accentHover);
    root.style.setProperty('--color-accent-light', colors.accentLight);
    root.style.setProperty('--color-text-primary', colors.textPrimary);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-text-tertiary', colors.textTertiary);

    // Backgrounds
    root.style.setProperty('--bg-app', colors.bg);
    root.style.setProperty('--bg-secondary', colors.bgSecondary);
    if (t.hasGlass) {
      root.style.setProperty('--bg-glass', `rgba(255,255,255,${appearanceMode === 'dark' ? '0.08' : '0.65'})`);
      root.style.setProperty('--bg-glass-hover', `rgba(255,255,255,${appearanceMode === 'dark' ? '0.12' : '0.85'})`);
      root.style.setProperty('--bg-card', `rgba(255,255,255,${appearanceMode === 'dark' ? '0.06' : '0.55'})`);
      root.style.setProperty('--bg-sidebar', `rgba(255,255,255,${appearanceMode === 'dark' ? '0.04' : '0.4'})`);
      root.style.setProperty('--bg-topbar', `rgba(255,255,255,${appearanceMode === 'dark' ? '0.07' : '0.55'})`);
      root.style.setProperty('--glass-blur', 'blur(20px)');
      root.style.setProperty('--glass-blur-light', 'blur(10px)');
    } else {
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
    root.style.setProperty('--border-hover', `1px solid ${colors.accent}33`);

    // Shadows
    if (t.hasCardShadow) {
      root.style.setProperty('--shadow-card', '0 4px 12px rgba(0,0,0,0.03)');
      root.style.setProperty('--shadow-elevated', '0 8px 24px rgba(0,0,0,0.05)');
    } else {
      root.style.setProperty('--shadow-card', 'none');
      root.style.setProperty('--shadow-elevated', 'none');
    }

    // Radius
    root.style.setProperty('--radius-sm', `${t.buttonRadius - 4}px`);
    root.style.setProperty('--radius-md', `${t.buttonRadius}px`);
    root.style.setProperty('--radius-lg', `${t.buttonRadius + 4}px`);
    root.style.setProperty('--radius-xl', `${t.buttonRadius + 8}px`);

    // Layout dimensions
    root.style.setProperty('--sidebar-width', `${t.sidebarWidth}px`);
    root.style.setProperty('--sidebar-collapsed-width', `${t.sidebarCollapsedWidth}px`);
    root.style.setProperty('--topbar-height', `${t.topbarHeight}px`);

    // Fonts
    root.style.setProperty('--font-mono', t.fontMono);
    root.style.setProperty('--font-sans', t.fontSans);

    // Table settings (from store)
    root.style.setProperty('--table-row-height', `${ROW_HEIGHT_MAP[kimiRowHeight]}px`);
    root.style.setProperty('--table-font-size', `${FONT_SIZE_MAP[kimiFontSize]}px`);
    root.style.setProperty('--table-text-align', kimiDataAlign === 'left' ? 'left' : kimiDataAlign === 'decimal' ? 'right' : 'inherit');
  }, [uiTheme, appearanceMode, kimiRowHeight, kimiFontSize, kimiDataAlign]);
}

/** Get the Ant Design ConfigProvider theme token overrides for the current theme. */
export function useAntTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;

  return {
    token: {
      colorPrimary: colors.accent,
      colorSuccess: '#7BA587',
      colorWarning: '#C9A96E',
      colorError: '#C47878',
      colorInfo: colors.accent,
      borderRadius: t.hasCardRadius ? 12 : t.buttonRadius,
      fontFamily: t.fontSans,
      fontSize: t.antFontSize,
      colorText: colors.textPrimary,
      colorTextSecondary: colors.textSecondary,
      colorBgContainer: t.hasGlass
        ? (appearanceMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)')
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
