import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  HomeOutlined, ImportOutlined, ExperimentOutlined,
  BarChartOutlined, HistoryOutlined, SettingOutlined, ClearOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '总览' },
  { key: '/import', icon: <ImportOutlined />, label: '导入' },
  { key: '/cleaning', icon: <ClearOutlined />, label: '清洗' },
  { key: '/analysis', icon: <ExperimentOutlined />, label: '分析' },
  { key: '/charts', icon: <BarChartOutlined />, label: '图表' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;
  const isKimi = uiTheme === 'kimi-minimal';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: isKimi ? '8px 0' : '12px 0',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: collapsed ? '8px 12px' : '12px 16px',
          marginBottom: isKimi ? 0 : 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.2s ease-in-out',
          borderBottom: isKimi && !collapsed ? `1px solid ${colors.border}` : 'none',
        }}
      >
        <span style={{ fontSize: collapsed ? 18 : 22, lineHeight: 1 }}>
          {isKimi ? '⚗' : '📊'}
        </span>
        {!collapsed && (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.textPrimary,
            whiteSpace: 'nowrap',
          }}>
            数据工作台
          </span>
        )}
      </div>

      {/* Navigation */}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        inlineCollapsed={collapsed}
        style={{
          background: 'transparent',
          border: 'none',
          flex: 1,
          paddingTop: isKimi ? 8 : 4,
        }}
      />
    </div>
  );
}
