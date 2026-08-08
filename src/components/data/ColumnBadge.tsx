import { Tag } from 'antd';
import type { ColumnType } from '@/types/data';

export default function ColumnBadge({ type }: { type: ColumnType }) {
  return (
    <Tag
      style={{
        borderRadius: 8,
        border: 'none',
        background: type === 'numeric' ? 'rgba(91,127,149,0.08)' : 'rgba(201,169,110,0.1)',
        color: type === 'numeric' ? '#5B7F95' : '#C9A96E',
        fontSize: 11,
        padding: '0 8px',
        lineHeight: '20px',
      }}
    >
      {type === 'numeric' ? '数值' : '分类'}
    </Tag>
  );
}
