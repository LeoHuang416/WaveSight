import { Layout, Tag, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/useDataStore';

const { Header } = Layout;

export default function TopBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const currentDataset = useDataStore((s) => s.currentDataset);

  return (
    <Header
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
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{ fontSize: 16, width: 36, height: 36 }}
        />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
          实验数据分析工作台
        </span>
      </div>

      <Tag
        style={{
          borderRadius: 8,
          border: 'none',
          background: currentDataset
            ? 'rgba(91,127,149,0.1)'
            : 'rgba(0,0,0,0.04)',
          color: currentDataset ? '#5B7F95' : '#888',
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
