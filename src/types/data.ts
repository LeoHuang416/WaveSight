export type ColumnType = 'numeric' | 'categorical';

/** Semantic role of a column in an experiment context */
export type ColumnRole = 'independent' | 'dependent' | 'metadata' | 'unknown';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  role: ColumnRole;
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
  /** If this dataset contains parallel experiments, the column name that groups them */
  experimentGroupCol?: string;
}

export interface ImportPreview {
  columns: { name: string; type: ColumnType; role: ColumnRole }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  encoding: string;
  delimiter: string;
  /** Detected experiment/batch grouping column */
  experimentGroupCol?: string;
  /** Columns flagged as potentially irrelevant */
  irrelevantColumns?: string[];
}
