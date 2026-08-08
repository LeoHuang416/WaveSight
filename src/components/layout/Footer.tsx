import { Layout } from 'antd';
import { useDataStore } from '@/stores/useDataStore';
const { Footer: AntFooter } = Layout;

export default function Footer() {
  const currentDataset = useDataStore((s) => s.currentDataset);
  return (
    <AntFooter style={{ textAlign: 'center', padding: '4px 24px', fontSize: 12, color: '#999', background: '#fff', borderTop: '1px solid #f0f0f0' }}>
      实验数据分析工作台 v1.0
      {currentDataset && <span style={{ marginLeft: 24 }}>已加载: {currentDataset.name} ({currentDataset.rowCount}行 × {currentDataset.colCount}列)</span>}
    </AntFooter>
  );
}
