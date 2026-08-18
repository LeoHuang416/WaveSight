import { Table, Dropdown } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import type { Dataset, ColumnMeta } from '@/types/data';
import { useSettingsStore, ROW_HEIGHT_MAP, FONT_SIZE_MAP } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

interface DataTableProps {
  dataset: Dataset;
  highlightCells?: { row: number; col: string; color: string }[];
  maxRows?: number;
  /** 列头右键菜单项（不传则禁用右键菜单） */
  columnMenuItems?: (col: ColumnMeta) => NonNullable<MenuProps['items']>;
  onColumnMenuClick?: (key: string, col: ColumnMeta) => void;
}

export default function DataTable({ dataset, highlightCells, maxRows, columnMenuItems, onColumnMenuClick }: DataTableProps) {
  const rows = maxRows ? dataset.rows.slice(0, maxRows) : dataset.rows;
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const rowHeight = useSettingsStore((s) => s.kimiRowHeight);
  const fontSize = useSettingsStore((s) => s.kimiFontSize);
  const dataAlign = useSettingsStore((s) => s.kimiDataAlign);

  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;
  const isKimi = uiTheme === 'kimi-minimal';
  const rh = ROW_HEIGHT_MAP[rowHeight];
  const fs = FONT_SIZE_MAP[fontSize];

  const align = dataAlign === 'left' ? 'left' : dataAlign === 'decimal' ? 'right' : undefined;

  const columns: ColumnsType<Record<string, unknown>> = dataset.columns.map((col) => ({
    title: (
      <Dropdown
        menu={{
          items: columnMenuItems?.(col) ?? [],
          onClick: ({ key }) => onColumnMenuClick?.(key, col),
        }}
        trigger={['contextMenu']}
        disabled={!columnMenuItems}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: isKimi ? t.fontSans : undefined, cursor: columnMenuItems ? 'context-menu' : undefined }}>
          {col.name}
          <span style={{ fontSize: 10, opacity: 0.5, fontFamily: isKimi ? t.fontSans : undefined }}>
            {col.type === 'numeric' ? '#' : 'Aa'}
          </span>
        </span>
      </Dropdown>
    ),
    dataIndex: col.name,
    key: col.name,
    ellipsis: true,
    width: 130,
    align: col.type === 'numeric' ? (align ?? 'right') : (align ?? 'left'),
    render: (val: unknown, _record: Record<string, unknown>, idx: number) => {
      const highlight = highlightCells?.find((h) => h.row === idx && h.col === col.name);
      const isMissing = val === null || val === undefined || val === '';
      const numVal = Number(val);
      const displayText = isMissing ? '—' : (
        col.type === 'numeric' && !isNaN(numVal)
          ? numVal.toLocaleString('zh-CN', { maximumSignificantDigits: 6 })
          : String(val)
      );

      return (
        <span style={{
          color: highlight?.color ?? (isMissing ? (appearanceMode === 'dark' ? '#c47878' : '#c47878') : undefined),
          background: highlight ? `${highlight.color}20` : isMissing ? (appearanceMode === 'dark' ? '#3a1a1a' : '#fff1f0') : undefined,
          padding: '1px 6px',
          borderRadius: isKimi ? 2 : 4,
          fontSize: isKimi ? fs : 13,
          fontFamily: isKimi && col.type === 'numeric' ? t.fontMono : undefined,
          fontVariantNumeric: isKimi && col.type === 'numeric' ? 'tabular-nums' as const : undefined,
        }}>
          {displayText}
        </span>
      );
    },
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
      <Table
        columns={columns}
        dataSource={rows.map((row, i) => ({ ...row, _key: i }))}
        rowKey="_key"
        size={isKimi ? 'middle' : 'small'}
        bordered={false}
        scroll={{ x: 'max-content', y: 400 }}
        pagination={false}
        style={{ background: 'transparent' }}
        onRow={() => ({
          style: {
            height: isKimi ? rh : undefined,
          },
        })}
      />
    </div>
  );
}
