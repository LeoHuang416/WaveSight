import { Layout, Tag, Typography } from 'antd';
import { useDataStore } from '@/stores/useDataStore';
const { Header } = Layout;

export default function TopBar() {
  const currentDataset = useDataStore((s) => s.currentDataset);
  return (
    <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 48, lineHeight: '48px' }}>
      <Typography.Title level={5} style={{ margin: 0 }}>📊 实验数据分析工作台</Typography.Title>
      <Tag color={currentDataset ? 'blue' : 'default'}>{currentDataset ? `${currentDataset.name} (${currentDataset.rowCount}行)` : '未加载数据'}</Tag>
    </Header>
  );
}
