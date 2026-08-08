import { Tag } from 'antd';
import type { ColumnType } from '@/types/data';

export default function ColumnBadge({ type }: { type: ColumnType }) {
  return <Tag color={type === 'numeric' ? 'blue' : 'orange'}>
    {type === 'numeric' ? '🔢 数值' : '🔤 分类'}
  </Tag>;
}
