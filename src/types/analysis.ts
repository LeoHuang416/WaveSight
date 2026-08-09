export type AnalysisType =
  | 'descriptive'
  | 'frequency'
  | 'normality'
  | 'grouped-stats'
  | 'ttest-independent'
  | 'ttest-paired'
  | 'anova-oneway'
  | 'correlation'
  | 'linear-regression'
  | 'nonlinear-fit'
  | 'rsm'
  | 'pca'
  | 'pipeline';

export interface AnalysisConfig {
  type: AnalysisType;
  datasetId: string;
  valueCols?: string[];
  groupCol?: string;
  xCols?: string[];
  yCol?: string;
  factorCols?: string[];
  responseCol?: string;
  method?: string;
  modelName?: string;
  pairedCol1?: string;
  pairedCol2?: string;
  alpha?: number;
}

export interface AnalysisResult {
  id: string;
  config: AnalysisConfig;
  tables: ResultTable[];
  conclusion: string;
  chartData?: ChartDataSource[];
  timestamp: number;
}

export interface ResultTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartDataSource {
  chartType: string;
  title: string;
  data: unknown;
}
