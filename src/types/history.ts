import type { AnalysisConfig, AnalysisResult } from './analysis';

export interface HistoryRecord {
  id: string;
  analysisConfig: AnalysisConfig;
  result: AnalysisResult;
  datasetName: string;
  relatedChartIds: string[];
  note: string;
  createdAt: number;
}

export interface HistoryFilter {
  analysisTypes?: string[];
  dateRange?: [number, number];
  keyword?: string;
}
