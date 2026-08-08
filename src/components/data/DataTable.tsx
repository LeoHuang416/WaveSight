import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dataset } from '@/types/data';

interface DataTableProps {
  dataset: Dataset;
  highlightCells?: { row: number; col: string; color: string }[];
  maxRows?: number;
}

export default function DataTable({ dataset, highlightCells, maxRows }: DataTableProps) {
  const rows = maxRows ? dataset.rows.slice(0, maxRows) : dataset.rows;

  const columns: ColumnsType<Record<string, unknown>> = dataset.columns.map((col) => ({
    title: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {col.name}
        <span style={{ fontSize: 10, opacity: 0.5 }}>
          {col.type === 'numeric' ? '#' : 'Aa'}
        </span>
      </span>
    ),
    dataIndex: col.name,
    key: col.name,
    ellipsis: true,
    width: 130,
    render: (val: unknown, _record: Record<string, unknown>, idx: number) => {
      const highlight = highlightCells?.find((h) => h.row === idx && h.col === col.name);
      const isMissing = val === null || val === undefined || val === '';
      return (
        <span style={{
          color: highlight?.color ?? (isMissing ? '#c47878' : undefined),
          background: highlight ? `${highlight.color}20` : isMissing ? '#fff1f0' : undefined,
          padding: '1px 6px',
          borderRadius: 4,
          fontSize: 13,
        }}>
          {isMissing ? '—' : String(val)}
        </span>
      );
    },
  }));

  return (
    <div style={{
      background: 'rgba(255,255,255,0.4)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.8)',
      overflow: 'hidden',
    }}>
      <Table
        columns={columns}
        dataSource={rows.map((row, i) => ({ ...row, _key: i }))}
        rowKey="_key"
        size="small"
        bordered={false}
        scroll={{ x: 'max-content', y: 400 }}
        pagination={false}
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
