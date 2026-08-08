import { Layout, Tag, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/useDataStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

const { Header } = Layout;

export default function TopBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const currentDataset = useDataStore((s) => s.currentDataset);
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;

  return (
    <Header
      id="app-topbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: 56,
        lineHeight: '56px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.hasGlass
          ? (appearanceMode === 'dark' ? 'rgba(30,30,30,0.55)' : 'rgba(255,255,255,0.55)')
          : colors.bg,
        backdropFilter: t.hasGlass ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: t.hasGlass ? 'blur(20px)' : 'none',
        borderBottom: `1px solid ${t.hasGlass ? 'rgba(0,0,0,0.06)' : colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{ fontSize: 16, width: 36, height: 36 }}
        />
        <span style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>
          实验数据分析工作台
        </span>
      </div>

      <Tag
        style={{
          borderRadius: t.buttonRadius,
          border: 'none',
          background: currentDataset
            ? colors.accentLight
            : (appearanceMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: currentDataset ? colors.accent : colors.textSecondary,
          fontSize: 12,
          padding: '2px 10px',
        }}
      >
        {currentDataset
          ? `${currentDataset.name} (${currentDataset.rowCount}行)`
          : '未加载数据'}
      </Tag>
    </Header>
  );
}
