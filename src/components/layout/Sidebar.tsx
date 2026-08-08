import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  HomeOutlined, ImportOutlined, ExperimentOutlined,
  BarChartOutlined, HistoryOutlined, SettingOutlined, ClearOutlined,
} from '@ant-design/icons';

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

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 0',
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: collapsed ? '8px 16px' : '12px 20px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>📊</span>
        {!collapsed && (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#333',
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
          paddingTop: 4,
        }}
      />
    </div>
  );
}
