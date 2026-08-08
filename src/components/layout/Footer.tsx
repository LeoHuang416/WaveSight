import { Layout, Typography } from 'antd';
import { useDataStore } from '@/stores/useDataStore';

const { Footer: AntFooter } = Layout;
const { Text } = Typography;

export default function Footer({ collapsed }: { collapsed: boolean }) {
  const currentDataset = useDataStore((s) => s.currentDataset);

  return (
    <AntFooter
      style={{
        textAlign: 'center',
        padding: '8px 24px',
        fontSize: 11,
        color: '#b0b0b0',
        background: 'transparent',
        borderTop: '1px solid rgba(0,0,0,0.04)',
        marginLeft: collapsed ? 64 : 240,
        transition: 'margin-left 0.2s ease-in-out',
      }}
    >
      <Text style={{ fontSize: 11, color: '#b0b0b0' }}>
        实验数据分析工作台 v1.0
      </Text>
      {currentDataset && (
        <Text style={{ fontSize: 11, color: '#b0b0b0', marginLeft: 16 }}>
          已加载: {currentDataset.name} ({currentDataset.rowCount}行 × {currentDataset.colCount}列)
        </Text>
      )}
    </AntFooter>
  );
}
