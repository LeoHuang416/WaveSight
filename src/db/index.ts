import Dexie, { type Table } from 'dexie';
import type { Dataset } from '@/types/data';
import type { ChartConfig } from '@/types/chart';
import type { HistoryRecord } from '@/types/history';

export class DataWorkbenchDB extends Dexie {
  datasets!: Table<Dataset, string>;
  charts!: Table<ChartConfig, string>;
  history!: Table<HistoryRecord, string>;

  constructor() {
    super('DataWorkbenchDB');
    this.version(1).stores({
      datasets: 'id, name, importedAt',
      charts: 'id, title, chartType, createdAt',
      history: 'id, createdAt, datasetName',
    });
  }
}

export const db = new DataWorkbenchDB();
