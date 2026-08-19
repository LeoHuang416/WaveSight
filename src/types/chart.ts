export type ChartType =
  | 'bar' | 'line' | 'scatter' | 'area'
  | 'boxplot' | 'violin' | 'errorbar' | 'qq'
  | 'heatmap' | 'contour' | 'surface3d' | 'histogram';

export type ColorScheme = 'grayscale' | 'color';
export type ExportFormat = 'png' | 'svg' | 'csv';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ChartConfig {
  id: string;
  title: string;
  chartType: ChartType;
  datasetId: string;
  columnMapping: Record<string, string | string[]>;
  echartsOption: Record<string, unknown>;
  thumbnail?: string;
  colorScheme: ColorScheme;
  legendPosition: LegendPosition;
  fontSize: number;
  xAxisLabel: string;
  yAxisLabel: string;
  yAxisMin?: number;
  yAxisMax?: number;
  animationDuration?: number;
  animationEasing?: string;
  sourceAnalysisId?: string;
  createdAt: number;
}
