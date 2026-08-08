import { Layout, Typography } from 'antd';
import { useDataStore } from '@/stores/useDataStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

const { Footer: AntFooter } = Layout;
const { Text } = Typography;

export default function Footer({ collapsed }: { collapsed: boolean }) {
  const currentDataset = useDataStore((s) => s.currentDataset);
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;

  return (
    <AntFooter
      id="app-footer"
      style={{
        textAlign: 'center',
        padding: '8px 24px',
        fontSize: 11,
        color: colors.textTertiary,
        background: 'transparent',
        borderTop: `1px solid ${colors.border}`,
        marginLeft: collapsed ? t.sidebarCollapsedWidth : t.sidebarWidth,
        transition: 'margin-left 0.2s ease-in-out',
      }}
    >
      <Text style={{ fontSize: 11, color: colors.textTertiary }}>
        实验数据分析工作台 v1.0
      </Text>
      {currentDataset && (
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 16 }}>
          已加载: {currentDataset.name} ({currentDataset.rowCount}行 × {currentDataset.colCount}列)
        </Text>
      )}
    </AntFooter>
  );
}
