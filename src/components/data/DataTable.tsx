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
      <span>
        {col.name}
        <span style={{ marginLeft: 4, fontSize: 12 }}>
          {col.type === 'numeric' ? '🔢' : '🔤'}
        </span>
      </span>
    ),
    dataIndex: col.name,
    key: col.name,
    ellipsis: true,
    width: 120,
    render: (val: unknown, _record: Record<string, unknown>, idx: number) => {
      const highlight = highlightCells?.find((h) => h.row === idx && h.col === col.name);
      const isMissing = val === null || val === undefined || val === '';
      return (
        <span style={{
          color: highlight?.color ?? (isMissing ? '#ff4d4f' : undefined),
          background: highlight ? `${highlight.color}20` : isMissing ? '#fff1f0' : undefined,
          padding: '0 4px', borderRadius: 2,
        }}>
          {isMissing ? '—' : String(val)}
        </span>
      );
    },
  }));

  return (
    <Table columns={columns}
      dataSource={rows.map((row, i) => ({ ...row, _key: i }))}
      rowKey="_key" size="small" bordered
      scroll={{ x: 'max-content', y: 400 }} pagination={false} />
  );
}
