import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import { HomeOutlined, ImportOutlined, ExperimentOutlined, BarChartOutlined, HistoryOutlined, SettingOutlined, ClearOutlined } from '@ant-design/icons';

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '总览' },
  { key: '/import', icon: <ImportOutlined />, label: '导入' },
  { key: '/cleaning', icon: <ClearOutlined />, label: '清洗' },
  { key: '/analysis', icon: <ExperimentOutlined />, label: '分析' },
  { key: '/charts', icon: <BarChartOutlined />, label: '图表' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Menu mode="inline" selectedKeys={[location.pathname]}
      items={menuItems} onClick={({ key }) => navigate(key)}
      style={{ height: '100%', borderRight: 0, paddingTop: 8 }} />
  );
}
