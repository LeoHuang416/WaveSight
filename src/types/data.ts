export type ColumnType = 'numeric' | 'categorical';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  index: number;
}

export interface Dataset {
  id: string;
  name: string;
  fileName: string;
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  rowCount: number;
  colCount: number;
  importedAt: number;
}

export interface ImportPreview {
  columns: { name: string; type: ColumnType }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  encoding: string;
  delimiter: string;
}
