import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from './index';

/**
 * Applies the currently-selected theme's CSS custom properties
 * to `document.documentElement`. Runs once on mount and whenever
 * the theme selection changes.
 */
export function useTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);

  useEffect(() => {
    const t = getTheme(uiTheme);

    const vars: Record<string, string> = {
      '--color-accent': t.colorAccent,
      '--color-accent-hover': t.colorAccentHover,
      '--color-accent-light': t.colorAccentLight,
      '--color-accent-subtle': t.colorAccentSubtle,
      '--color-text-primary': t.colorTextPrimary,
      '--color-text-secondary': t.colorTextSecondary,
      '--color-text-tertiary': t.colorTextTertiary,

      '--bg-app': t.bgApp,
      '--bg-glass': t.bgGlass,
      '--bg-glass-hover': t.bgGlassHover,
      '--bg-glass-active': t.bgGlassActive,
      '--bg-card': t.bgCard,
      '--bg-sidebar': t.bgSidebar,
      '--bg-topbar': t.bgTopbar,
      '--bg-input': t.bgInput,

      '--glass-blur': t.glassBlur,
      '--glass-blur-light': t.glassBlurLight,

      '--border-thin': t.borderThin,
      '--border-subtle': t.borderSubtle,
      '--border-hover': t.borderHover,

      '--shadow-card': t.shadowCard,
      '--shadow-elevated': t.shadowElevated,

      '--radius-sm': t.radiusSm,
      '--radius-md': t.radiusMd,
      '--radius-lg': t.radiusLg,
      '--radius-xl': t.radiusXl,
    };

    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [uiTheme]);
}

/** Get the Ant Design ConfigProvider theme token overrides for the current theme. */
export function useAntTheme() {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const t = getTheme(uiTheme);

  return {
    token: {
      colorPrimary: t.colorAccent,
      colorSuccess: '#7BA587',
      colorWarning: '#C9A96E',
      colorError: '#C47878',
      colorInfo: t.colorAccent,
      borderRadius: t.antBorderRadius,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: 14,
      colorText: t.colorTextPrimary,
      colorTextSecondary: t.colorTextSecondary,
      colorBgContainer: t.antColorBgContainer,
      colorBorder: t.antColorBorder,
      paddingLG: 24,
    },
  };
}
