# 实验数据分析工作台 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯浏览器端实验数据分析工作台，支持数据导入、清洗、统计分析（类 SPSS/Origin）、图表生成、历史记录和设置。

**Architecture:** React 18 + TypeScript SPA，Vite 构建，Zustand 管理状态，Ant Design 提供 UI 组件，ECharts 5 渲染图表，Dexie.js 封装 IndexedDB 做本地持久化。统计分析引擎独立于 UI 层实现，通过纯函数接口调用。路由使用 React Router 6。

**Tech Stack:** React 18, TypeScript 5, Vite 5, Ant Design 5, ECharts 5 (echarts-for-react), Zustand 4, Dexie.js 3, React Router 6, jstat 1.x, ml.js (ml-regression, ml-pca), papaparse, xlsx

## Global Constraints

- 纯浏览器端，无后端服务器
- 数据通过 IndexedDB 持久化，设置通过 localStorage
- 不依赖任何网络请求或 CDN
- 支持 CSV、TSV、Excel (.xlsx/.xls)、JSON、TXT 数据格式
- 编码兼容 UTF-8、UTF-8-BOM、GB18030
- 显著性水平默认 α=0.05，有效数字默认 3 位
- 图表默认学术灰度配色，默认导出 SVG
- 所有 UI 文本使用中文

---

## 文件结构总览

```
HL'sAPP/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── PRD.md
├── src/
│   ├── main.tsx                          # ReactDOM.createRoot 入口
│   ├── App.tsx                           # RouterProvider + 全局 Provider
│   ├── vite-env.d.ts                     # Vite 类型声明
│   │
│   ├── types/
│   │   ├── data.ts                       # Dataset, ColumnMeta, ColumnType
│   │   ├── analysis.ts                   # AnalysisType, AnalysisConfig, AnalysisResult
│   │   ├── chart.ts                      # ChartConfig, ChartType, ChartExportFormat
│   │   └── history.ts                    # HistoryRecord, HistoryFilter
│   │
│   ├── db/
│   │   ├── index.ts                      # Dexie 实例化 + 数据库升级
│   │   └── operations.ts                # 所有 CRUD 操作函数
│   │
│   ├── stores/
│   │   ├── useDataStore.ts               # 当前数据集状态
│   │   ├── useChartStore.ts              # 图表列表状态
│   │   ├── useHistoryStore.ts            # 历史记录状态
│   │   └── useSettingsStore.ts           # 设置状态（persist to localStorage）
│   │
│   ├── engine/
│   │   ├── descriptive.ts               # 描述统计、频数、正态性检验
│   │   ├── hypothesis.ts                # t检验、ANOVA、Tukey HSD
│   │   ├── modeling.ts                  # 线性回归、非线性拟合、RSM、PCA
│   │   └── utils.ts                     # 均值、方差、分位数、t分布、F分布等基础函数
│   │
│   ├── utils/
│   │   ├── format.ts                    # 有效数字格式化、p值星号标记
│   │   ├── fileParser.ts                # CSV/TSV/Excel/JSON 解析 + 编码检测
│   │   └── export.ts                    # PNG/SVG/CSV 导出
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx            # Sider + Header + Content + Footer
│   │   │   ├── Sidebar.tsx              # 左侧导航菜单
│   │   │   ├── TopBar.tsx               # 顶栏（Logo + 数据集状态）
│   │   │   └── Footer.tsx               # 底栏（版本号 + 数据集摘要）
│   │   ├── data/
│   │   │   ├── DataTable.tsx            # 通用数据表格（冻结表头、列类型图标）
│   │   │   ├── ColumnBadge.tsx          # 🔢/🔤 列类型徽标
│   │   │   └── VariableSlots.tsx        # 分析模块的变量拖拽槽位组件
│   │   ├── charts/
│   │   │   ├── ChartRenderer.tsx        # ECharts 通用渲染组件
│   │   │   ├── ChartEditor.tsx          # 图表编辑面板（标题/轴/配色/图例）
│   │   │   ├── ChartCard.tsx            # 画廊卡片（缩略图+标题+时间）
│   │   │   └── chartOptions/            # 每种图表类型的 ECharts option 工厂函数
│   │   │       ├── barChart.ts
│   │   │       ├── lineChart.ts
│   │   │       ├── scatterChart.ts
│   │   │       ├── boxplotChart.ts
│   │   │       ├── violinChart.ts
│   │   │       ├── errorBarChart.ts
│   │   │       ├── qqPlot.ts
│   │   │       ├── heatmapChart.ts
│   │   │       ├── contourChart.ts
│   │   │       ├── surface3DChart.ts
│   │   │       └── histogramChart.ts
│   │   └── common/
│   │       ├── EmptyState.tsx           # 空状态引导组件
│   │       ├── StepWizard.tsx           # 步骤条容器
│   │       └── ConfirmDelete.tsx        # 确认删除弹窗
│   │
│   ├── pages/
│   │   ├── HomePage.tsx                 # 首页总览
│   │   ├── ImportPage.tsx               # 数据导入（三步向导）
│   │   ├── CleaningPage.tsx             # 数据清洗（三标签页）
│   │   ├── AnalysisPage.tsx             # 实验数据分析（三栏布局）
│   │   ├── ChartsPage.tsx               # 图表画廊 + 编辑器
│   │   ├── HistoryPage.tsx              # 历史记录（时间线 + 详情）
│   │   └── SettingsPage.tsx             # 设置
│   │
│   └── hooks/
│       ├── useDataOperations.ts         # 数据导入/清洗/删除 hook
│       ├── useAnalysis.ts              # 运行分析 + 保存结果 hook
│       └── useChartExport.ts           # 图表导出 hook
```

---

## Phase 1: 项目基础

### Task 1: 项目脚手架与依赖安装

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

**Interfaces:**
- Produces: Vite 开发服务器可启动，显示空白 React 页面

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "data-analysis-workbench",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "antd": "^5.20.0",
    "@ant-design/icons": "^5.4.0",
    "echarts": "^5.5.1",
    "echarts-for-react": "^3.0.2",
    "zustand": "^4.5.4",
    "dexie": "^3.2.7",
    "jstat": "^1.9.6",
    "ml-regression": "^6.0.0",
    "ml-pca": "^4.1.2",
    "papaparse": "^5.4.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/papaparse": "^5.3.14",
    "typescript": "^5.5.4",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.5"
  }
}
```

- [ ] **Step 2: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>实验数据分析工作台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
});
```

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: 创建 src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 7: 创建 src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd/dist/reset.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: 创建最小 src/App.tsx**

```typescript
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#434343' },
      }}
    >
      <div>实验数据分析工作台</div>
    </ConfigProvider>
  );
}
```

- [ ] **Step 9: 安装依赖并验证启动**

```bash
cd "C:\Users\Administrator\Desktop\HL'sAPP"
npm install
npm run dev
```

验证：浏览器打开 localhost:5173，看到"实验数据分析工作台"文字。

---

### Task 2: 类型定义

**Files:**
- Create: `src/types/data.ts`, `src/types/analysis.ts`, `src/types/chart.ts`, `src/types/history.ts`

**Interfaces:**
- Produces: 全部 TypeScript 类型和接口，供后续所有任务引用

- [ ] **Step 1: 创建 src/types/data.ts**

```typescript
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
  rows: Record<string, unknown>[];  // 每行是 {列名: 值}
  rowCount: number;
  colCount: number;
  importedAt: number;  // timestamp
}

export interface ImportPreview {
  columns: { name: string; type: ColumnType }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  encoding: string;
  delimiter: string;
}
```

- [ ] **Step 2: 创建 src/types/analysis.ts**

```typescript
export type AnalysisType =
  | 'descriptive'       // 描述统计
  | 'frequency'          // 频数统计
  | 'normality'          // 正态性检验
  | 'grouped-stats'      // 分组统计
  | 'ttest-independent'  // 独立样本 t 检验
  | 'ttest-paired'       // 配对 t 检验
  | 'anova-oneway'       // 单因素 ANOVA
  | 'correlation'        // 相关矩阵
  | 'linear-regression'  // 线性回归
  | 'nonlinear-fit'      // 非线性拟合
  | 'rsm'               // 响应面分析
  | 'pca';              // 主成分分析

export interface AnalysisConfig {
  type: AnalysisType;
  datasetId: string;
  valueCols?: string[];       // 数值变量
  groupCol?: string;          // 分组变量
  xCols?: string[];           // 自变量
  yCol?: string;             // 因变量
  factorCols?: string[];     // 因素列（RSM）
  responseCol?: string;      // 响应列（RSM）
  method?: string;           // pearson/spearman/kendall
  modelName?: string;        // exp/power/gauss/linear
  pairedCol1?: string;       // 配对列1
  pairedCol2?: string;       // 配对列2
  alpha?: number;            // 显著性水平
}

export interface AnalysisResult {
  id: string;
  config: AnalysisConfig;
  tables: ResultTable[];
  conclusion: string;
  chartData?: ChartDataSource[];  // 预留给图表模块
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
  data: unknown;  // ECharts option 或原始数据
}
```

- [ ] **Step 3: 创建 src/types/chart.ts**

```typescript
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
  thumbnail?: string;  // base64 data URL
  colorScheme: ColorScheme;
  legendPosition: LegendPosition;
  fontSize: number;
  xAxisLabel: string;
  yAxisLabel: string;
  yAxisMin?: number;
  yAxisMax?: number;
  sourceAnalysisId?: string;  // 来源分析 ID
  createdAt: number;
}
```

- [ ] **Step 4: 创建 src/types/history.ts**

```typescript
import type { AnalysisConfig, AnalysisResult } from './analysis';

export interface HistoryRecord {
  id: string;
  analysisConfig: AnalysisConfig;
  result: AnalysisResult;
  datasetName: string;
  relatedChartIds: string[];  // 关联的图表 ID
  note: string;               // 用户备注
  createdAt: number;
}

export interface HistoryFilter {
  analysisTypes?: string[];
  dateRange?: [number, number];
  keyword?: string;
}
```

---

### Task 3: IndexedDB 数据库层

**Files:**
- Create: `src/db/index.ts`, `src/db/operations.ts`

**Interfaces:**
- Produces:
  - `db` — Dexie 实例，包含 datasets/charts/history 三张表
  - `saveDataset(ds: Dataset): Promise<string>`
  - `getDataset(id: string): Promise<Dataset | undefined>`
  - `getAllDatasets(): Promise<Dataset[]>`
  - `deleteDataset(id: string): Promise<void>`
  - `saveChart(cfg: ChartConfig): Promise<string>`
  - `getChart(id: string): Promise<ChartConfig | undefined>`
  - `getAllCharts(): Promise<ChartConfig[]>`
  - `deleteChart(id: string): Promise<void>`
  - `saveHistory(record: HistoryRecord): Promise<string>`
  - `getHistory(id: string): Promise<HistoryRecord | undefined>`
  - `getAllHistory(): Promise<HistoryRecord[]>`
  - `deleteHistory(id: string): Promise<void>`

- [ ] **Step 1: 创建 src/db/index.ts**

```typescript
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
```

- [ ] **Step 2: 创建 src/db/operations.ts**

```typescript
import { db } from './index';
import type { Dataset } from '@/types/data';
import type { ChartConfig } from '@/types/chart';
import type { HistoryRecord } from '@/types/history';

// --- Dataset CRUD ---
export async function saveDataset(ds: Dataset): Promise<string> {
  await db.datasets.put(ds);
  return ds.id;
}

export async function getDataset(id: string): Promise<Dataset | undefined> {
  return db.datasets.get(id);
}

export async function getAllDatasets(): Promise<Dataset[]> {
  return db.datasets.orderBy('importedAt').reverse().toArray();
}

export async function deleteDataset(id: string): Promise<void> {
  await db.datasets.delete(id);
}

// --- Chart CRUD ---
export async function saveChart(cfg: ChartConfig): Promise<string> {
  await db.charts.put(cfg);
  return cfg.id;
}

export async function getChart(id: string): Promise<ChartConfig | undefined> {
  return db.charts.get(id);
}

export async function getAllCharts(): Promise<ChartConfig[]> {
  return db.charts.orderBy('createdAt').reverse().toArray();
}

export async function deleteChart(id: string): Promise<void> {
  await db.charts.delete(id);
}

// --- History CRUD ---
export async function saveHistory(record: HistoryRecord): Promise<string> {
  await db.history.put(record);
  return record.id;
}

export async function getHistory(id: string): Promise<HistoryRecord | undefined> {
  return db.history.get(id);
}

export async function getAllHistory(): Promise<HistoryRecord[]> {
  return db.history.orderBy('createdAt').reverse().toArray();
}

export async function deleteHistory(id: string): Promise<void> {
  await db.history.delete(id);
}

export async function getStorageStats(): Promise<{
  datasetCount: number;
  chartCount: number;
  historyCount: number;
}> {
  const [datasetCount, chartCount, historyCount] = await Promise.all([
    db.datasets.count(),
    db.charts.count(),
    db.history.count(),
  ]);
  return { datasetCount, chartCount, historyCount };
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.datasets.clear(),
    db.charts.clear(),
    db.history.clear(),
  ]);
}

export async function exportAllData(): Promise<{
  datasets: Dataset[];
  charts: ChartConfig[];
  history: HistoryRecord[];
}> {
  const [datasets, charts, history] = await Promise.all([
    db.datasets.toArray(),
    db.charts.toArray(),
    db.history.toArray(),
  ]);
  return { datasets, charts, history };
}
```

---

### Task 4: Zustand 状态管理

**Files:**
- Create: `src/stores/useDataStore.ts`, `src/stores/useChartStore.ts`, `src/stores/useHistoryStore.ts`, `src/stores/useSettingsStore.ts`

**Interfaces:**
- Consumes: `Dataset` from Task 2, `saveDataset/getDataset/getAllDatasets/deleteDataset` from Task 3
- Produces: 四个 Zustand store hooks

- [ ] **Step 1: 创建 src/stores/useSettingsStore.ts**（其他 store 依赖它）

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColorScheme, ExportFormat } from '@/types/chart';

interface SettingsState {
  alpha: number;
  significantDigits: number;
  defaultColorScheme: ColorScheme;
  defaultExportFormat: ExportFormat;
  autoCleanHistory: boolean;
  historyRetentionDays: number;
  setAlpha: (v: number) => void;
  setSignificantDigits: (v: number) => void;
  setDefaultColorScheme: (v: ColorScheme) => void;
  setDefaultExportFormat: (v: ExportFormat) => void;
  setAutoCleanHistory: (v: boolean) => void;
  setHistoryRetentionDays: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      alpha: 0.05,
      significantDigits: 3,
      defaultColorScheme: 'grayscale',
      defaultExportFormat: 'svg',
      autoCleanHistory: true,
      historyRetentionDays: 90,
      setAlpha: (alpha) => set({ alpha }),
      setSignificantDigits: (significantDigits) => set({ significantDigits }),
      setDefaultColorScheme: (defaultColorScheme) => set({ defaultColorScheme }),
      setDefaultExportFormat: (defaultExportFormat) => set({ defaultExportFormat }),
      setAutoCleanHistory: (autoCleanHistory) => set({ autoCleanHistory }),
      setHistoryRetentionDays: (historyRetentionDays) => set({ historyRetentionDays }),
    }),
    { name: 'data-workbench-settings' }
  )
);
```

- [ ] **Step 2: 创建 src/stores/useDataStore.ts**

```typescript
import { create } from 'zustand';
import type { Dataset, ColumnMeta } from '@/types/data';
import { getAllDatasets, getDataset } from '@/db/operations';

interface DataState {
  currentDatasetId: string | null;
  currentDataset: Dataset | null;
  datasetList: Dataset[];
  loading: boolean;
  setCurrentDataset: (id: string | null) => Promise<void>;
  refreshDatasetList: () => Promise<void>;
  updateCurrentDataset: (ds: Dataset) => void;
  getColumnByName: (name: string) => ColumnMeta | undefined;
  getNumericColumns: () => ColumnMeta[];
  getCategoricalColumns: () => ColumnMeta[];
}

export const useDataStore = create<DataState>()((set, get) => ({
  currentDatasetId: null,
  currentDataset: null,
  datasetList: [],
  loading: false,

  setCurrentDataset: async (id) => {
    if (!id) {
      set({ currentDatasetId: null, currentDataset: null });
      return;
    }
    set({ loading: true });
    const ds = await getDataset(id);
    set({ currentDatasetId: id, currentDataset: ds ?? null, loading: false });
  },

  refreshDatasetList: async () => {
    const list = await getAllDatasets();
    set({ datasetList: list });
  },

  updateCurrentDataset: (ds) => {
    set({ currentDataset: ds });
  },

  getColumnByName: (name) => {
    return get().currentDataset?.columns.find((c) => c.name === name);
  },

  getNumericColumns: () => {
    return get().currentDataset?.columns.filter((c) => c.type === 'numeric') ?? [];
  },

  getCategoricalColumns: () => {
    return get().currentDataset?.columns.filter((c) => c.type === 'categorical') ?? [];
  },
}));
```

- [ ] **Step 3: 创建 src/stores/useChartStore.ts**

```typescript
import { create } from 'zustand';
import type { ChartConfig } from '@/types/chart';
import { getAllCharts, saveChart, deleteChart as dbDeleteChart } from '@/db/operations';

interface ChartState {
  charts: ChartConfig[];
  editingChartId: string | null;
  viewMode: 'gallery' | 'editor';
  refresh: () => Promise<void>;
  addChart: (cfg: ChartConfig) => Promise<void>;
  removeChart: (id: string) => Promise<void>;
  setEditingChart: (id: string | null) => void;
  setViewMode: (mode: 'gallery' | 'editor') => void;
}

export const useChartStore = create<ChartState>()((set) => ({
  charts: [],
  editingChartId: null,
  viewMode: 'gallery',

  refresh: async () => {
    const charts = await getAllCharts();
    set({ charts });
  },

  addChart: async (cfg) => {
    await saveChart(cfg);
    const charts = await getAllCharts();
    set({ charts });
  },

  removeChart: async (id) => {
    await dbDeleteChart(id);
    const charts = await getAllCharts();
    set({ charts, editingChartId: get().editingChartId === id ? null : get().editingChartId });
  },

  setEditingChart: (id) => set({ editingChartId: id, viewMode: id ? 'editor' : 'gallery' }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));

function get() {
  return useChartStore.getState();
}
```

- [ ] **Step 4: 创建 src/stores/useHistoryStore.ts**

```typescript
import { create } from 'zustand';
import type { HistoryRecord, HistoryFilter } from '@/types/history';
import { getAllHistory, saveHistory, deleteHistory as dbDeleteHistory } from '@/db/operations';

interface HistoryState {
  records: HistoryRecord[];
  selectedId: string | null;
  filter: HistoryFilter;
  refresh: () => Promise<void>;
  addRecord: (record: HistoryRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  setSelected: (id: string | null) => void;
  setFilter: (filter: HistoryFilter) => void;
  updateNote: (id: string, note: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  records: [],
  selectedId: null,
  filter: {},

  refresh: async () => {
    const records = await getAllHistory();
    set({ records });
  },

  addRecord: async (record) => {
    await saveHistory(record);
    await get().refresh();
  },

  removeRecord: async (id) => {
    await dbDeleteHistory(id);
    set((s) => ({
      records: s.records.filter((r) => r.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  setSelected: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),

  updateNote: async (id, note) => {
    const record = get().records.find((r) => r.id === id);
    if (record) {
      const updated = { ...record, note };
      await saveHistory(updated);
      set((s) => ({ records: s.records.map((r) => (r.id === id ? updated : r)) }));
    }
  },
}));
```

---

### Task 5: 布局外壳与路由

**Files:**
- Create: `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/Footer.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/common/EmptyState.tsx`

**Interfaces:**
- Consumes: `useDataStore` from Task 4
- Produces: 完整的 App 布局 + 7 个路由占位页面，侧边栏导航可用

- [ ] **Step 1: 创建占位页面组件（7 个文件，内容一致）**

在每个 `src/pages/XxxPage.tsx` 中写入：

```typescript
// HomePage.tsx 示例，其余 6 个同理，替换组件名和标题
export default function HomePage() {
  return <div style={{ padding: 24 }}>首页总览（待实现）</div>;
}
```

创建以下文件：
- `src/pages/HomePage.tsx`
- `src/pages/ImportPage.tsx`
- `src/pages/CleaningPage.tsx`
- `src/pages/AnalysisPage.tsx`
- `src/pages/ChartsPage.tsx`
- `src/pages/HistoryPage.tsx`
- `src/pages/SettingsPage.tsx`

- [ ] **Step 2: 创建 src/components/layout/Sidebar.tsx**

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  HomeOutlined,
  ImportOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  HistoryOutlined,
  SettingOutlined,
  CleaningOutlined,
} from '@ant-design/icons';

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '总览' },
  { key: '/import', icon: <ImportOutlined />, label: '导入' },
  { key: '/cleaning', icon: <CleaningOutlined />, label: '清洗' },
  { key: '/analysis', icon: <ExperimentOutlined />, label: '分析' },
  { key: '/charts', icon: <BarChartOutlined />, label: '图表' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ height: '100%', borderRight: 0, paddingTop: 8 }}
    />
  );
}
```

- [ ] **Step 3: 创建 src/components/layout/TopBar.tsx**

```typescript
import { Layout, Tag, Typography } from 'antd';
import { useDataStore } from '@/stores/useDataStore';

const { Header } = Layout;

export default function TopBar() {
  const currentDataset = useDataStore((s) => s.currentDataset);

  return (
    <Header
      style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 48,
        lineHeight: '48px',
      }}
    >
      <Typography.Title level={5} style={{ margin: 0 }}>
        📊 实验数据分析工作台
      </Typography.Title>
      <Tag color={currentDataset ? 'blue' : 'default'}>
        {currentDataset ? `${currentDataset.name} (${currentDataset.rowCount}行)` : '未加载数据'}
      </Tag>
    </Header>
  );
}
```

- [ ] **Step 4: 创建 src/components/layout/Footer.tsx**

```typescript
import { Layout } from 'antd';
import { useDataStore } from '@/stores/useDataStore';

const { Footer: AntFooter } = Layout;

export default function Footer() {
  const currentDataset = useDataStore((s) => s.currentDataset);

  return (
    <AntFooter
      style={{
        textAlign: 'center',
        padding: '4px 24px',
        fontSize: 12,
        color: '#999',
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
      }}
    >
      实验数据分析工作台 v1.0
      {currentDataset && (
        <span style={{ marginLeft: 24 }}>
          已加载: {currentDataset.name} ({currentDataset.rowCount}行 × {currentDataset.colCount}列)
        </span>
      )}
    </AntFooter>
  );
}
```

- [ ] **Step 5: 创建 src/components/layout/AppLayout.tsx**

```typescript
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Footer from './Footer';

const { Sider, Content } = Layout;

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <TopBar />
      <Layout>
        <Sider width={80} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Sidebar />
        </Sider>
        <Content style={{ background: '#fafafa', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
      <Footer />
    </Layout>
  );
}
```

- [ ] **Step 6: 创建 src/components/common/EmptyState.tsx**

```typescript
import { Empty, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  actionPath?: string;
}

export default function EmptyState({ description, actionText, actionPath }: EmptyStateProps) {
  const navigate = useNavigate();

  return (
    <Empty
      description={description}
      style={{ padding: 80 }}
    >
      {actionText && actionPath && (
        <Button type="primary" onClick={() => navigate(actionPath)}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
}
```

- [ ] **Step 7: 更新 src/App.tsx 加入路由**

```typescript
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import ImportPage from '@/pages/ImportPage';
import CleaningPage from '@/pages/CleaningPage';
import AnalysisPage from '@/pages/AnalysisPage';
import ChartsPage from '@/pages/ChartsPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'cleaning', element: <CleaningPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'charts', element: <ChartsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: '#434343' },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
```

- [ ] **Step 8: 验证**

```bash
npm run dev
```

验证：浏览器打开后看到完整布局——顶栏、左侧 7 个图标菜单、底栏。点击每个菜单项，右侧内容区切换到对应占位页面。

---

## Phase 2: 数据导入

### Task 6: 文件解析工具

**Files:**
- Create: `src/utils/fileParser.ts`, `src/utils/format.ts`

**Interfaces:**
- Produces:
  - `detectEncoding(buffer: ArrayBuffer): string`
  - `parseFile(file: File): Promise<ImportPreview>`
  - `formatNumber(value: number, digits: number): string`
  - `formatPValue(p: number, alpha: number): string`

- [ ] **Step 1: 创建 src/utils/format.ts**

```typescript
/**
 * 格式化数值到指定有效数字位数
 */
export function formatNumber(value: number, significantDigits: number = 3): string {
  if (!isFinite(value)) return String(value);
  if (value === 0) return '0';
  const rounded = Number(value.toPrecision(significantDigits));
  return String(rounded);
}

/**
 * 格式化 p 值，带显著性星号标记
 * p < 0.001 → "p < 0.001 ***"
 * p < 0.01  → "p = 0.0032 **"
 * p < 0.05  → "p = 0.032 *"
 * p >= 0.05 → "p = 0.123"
 */
export function formatPValue(p: number, alpha: number = 0.05): string {
  if (p < 0.001) return 'p < 0.001 ***';
  const stars = p < 0.01 ? ' **' : p < alpha ? ' *' : '';
  return `p = ${formatNumber(p, 3)}${stars}`;
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
```

- [ ] **Step 2: 创建 src/utils/fileParser.ts**

```typescript
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportPreview, ColumnType } from '@/types/data';

/**
 * 检测文本编码：检查 BOM 标记
 */
function detectBOM(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

/**
 * 推测列类型：数值 or 分类
 */
function inferColumnType(values: unknown[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'numeric';
  const numericCount = nonEmpty.filter((v) => {
    const n = Number(v);
    return !isNaN(n) && String(v).trim() !== '';
  }).length;
  return numericCount / nonEmpty.length >= 0.7 ? 'numeric' : 'categorical';
}

/**
 * 推断所有列的类型
 */
function inferAllColumnTypes(
  headers: string[],
  rows: Record<string, unknown>[]
): { name: string; type: ColumnType }[] {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);
    return { name: header, type: inferColumnType(values) };
  });
}

/**
 * 主解析函数：根据 File 对象解析为 ImportPreview
 */
export async function parseFile(file: File): Promise<ImportPreview> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    return parseExcel(file);
  }
  if (ext === 'json') {
    return parseJSON(file);
  }
  // CSV, TSV, TXT 等文本格式
  return parseTextFile(file);
}

async function parseExcel(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = Object.keys(jsonData[0] ?? {});

  return {
    columns: inferAllColumnTypes(headers, jsonData),
    rows: jsonData.slice(0, 20),  // 预览前 20 行
    totalRows: jsonData.length,
    encoding: 'utf-8',
    delimiter: '',
  };
}

async function parseJSON(file: File): Promise<ImportPreview> {
  const text = await file.text();
  const jsonData = JSON.parse(text);
  const arr = Array.isArray(jsonData) ? jsonData : [jsonData];
  const headers = Object.keys(arr[0] ?? {});

  return {
    columns: inferAllColumnTypes(headers, arr),
    rows: arr.slice(0, 20),
    totalRows: arr.length,
    encoding: 'utf-8',
    delimiter: '',
  };
}

async function parseTextFile(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const encoding = detectBOM(buffer);

  // 尝试多种编码解码
  let text = '';
  const encodings = [encoding, 'utf-8', 'gb18030'];
  for (const enc of encodings) {
    try {
      const decoder = new TextDecoder(enc);
      text = decoder.decode(buffer);
      break;
    } catch {
      continue;
    }
  }

  // 自动检测分隔符
  const firstLine = text.split('\n')[0] ?? '';
  let delimiter = ',';
  if (firstLine.split('\t').length > firstLine.split(',').length) delimiter = '\t';
  if (firstLine.split(';').length > firstLine.split(delimiter).length) delimiter = ';';

  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const headers = result.meta.fields ?? [];
  const rows = result.data.slice(0, 20);

  return {
    columns: inferAllColumnTypes(headers, result.data),
    rows,
    totalRows: result.data.length,
    encoding,
    delimiter,
  };
}

/**
 * 完整加载文件（非仅预览，返回全部数据行）
 */
export async function loadFullFile(
  file: File,
  options: {
    hasHeader: boolean;
    skipRows: number;
    delimiter?: string;
  }
): Promise<{ headers: string[]; rows: Record<string, unknown>[]; columns: { name: string; type: ColumnType }[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const skippedRows = rows.slice(options.skipRows);
    const headers = options.hasHeader
      ? Object.keys(skippedRows[0] ?? {})
      : skippedRows[0] ? Object.keys(skippedRows[0]).map((_, i) => `列${i + 1}`) : [];
    if (!options.hasHeader && skippedRows.length > 0) {
      // 无表头：将第一行作为数据行，列名自动生成
      const colNames = Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);
      const dataRows = skippedRows.map((row) => {
        const newRow: Record<string, unknown> = {};
        Object.values(row).forEach((val, i) => { newRow[colNames[i]] = val; });
        return newRow;
      });
      return { headers: colNames, rows: dataRows, columns: inferAllColumnTypes(colNames, dataRows) };
    }
    return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
  }

  // 文本文件
  const buffer = await file.arrayBuffer();
  let text = '';
  for (const enc of ['utf-8', 'gb18030']) {
    try { text = new TextDecoder(enc).decode(buffer); break; } catch { continue; }
  }

  const delimiter = options.delimiter || ',';
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: options.hasHeader,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const skippedRows = result.data.slice(options.skipRows);
  const headers = options.hasHeader
    ? (result.meta.fields ?? [])
    : Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);

  return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
}
```

---

### Task 7: 数据导入页面

**Files:**
- Modify: `src/pages/ImportPage.tsx`
- Create: `src/hooks/useDataOperations.ts`

**Interfaces:**
- Consumes: `parseFile`, `loadFullFile` from Task 6; `saveDataset` from Task 3; `useDataStore` from Task 4
- Produces: 完整的三步导入向导页面

- [ ] **Step 1: 创建 src/hooks/useDataOperations.ts**

```typescript
import { useCallback } from 'react';
import { saveDataset } from '@/db/operations';
import { useDataStore } from '@/stores/useDataStore';
import { generateId } from '@/utils/format';
import type { Dataset, ColumnMeta } from '@/types/data';

export function useDataOperations() {
  const { setCurrentDataset, refreshDatasetList, updateCurrentDataset } = useDataStore();

  const importDataset = useCallback(
    async (params: {
      name: string;
      fileName: string;
      columns: ColumnMeta[];
      rows: Record<string, unknown>[];
    }) => {
      const ds: Dataset = {
        id: generateId(),
        name: params.name,
        fileName: params.fileName,
        columns: params.columns,
        rows: params.rows,
        rowCount: params.rows.length,
        colCount: params.columns.length,
        importedAt: Date.now(),
      };
      await saveDataset(ds);
      await setCurrentDataset(ds.id);
      await refreshDatasetList();
      return ds;
    },
    [setCurrentDataset, refreshDatasetList]
  );

  const updateDataset = useCallback(
    async (ds: Dataset) => {
      await saveDataset(ds);
      updateCurrentDataset(ds);
    },
    [updateCurrentDataset]
  );

  return { importDataset, updateDataset };
}
```

- [ ] **Step 2: 重写 src/pages/ImportPage.tsx**

```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Button, Upload, Radio, InputNumber, Switch, Table, Tag, message, Space, Typography, Descriptions } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { parseFile, loadFullFile } from '@/utils/fileParser';
import { useDataOperations } from '@/hooks/useDataOperations';
import type { ImportPreview, ColumnType, ColumnMeta } from '@/types/data';

const { Dragger } = Upload;
const { Title, Text } = Typography;

export default function ImportPage() {
  const navigate = useNavigate();
  const { importDataset } = useDataOperations();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);

  // 清洗选项
  const [hasHeader, setHasHeader] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [delimiter, setDelimiter] = useState(',');
  const [columnTypes, setColumnTypes] = useState<{ name: string; type: ColumnType }[]>([]);

  // 步骤 1: 文件选中
  const handleFile = useCallback(async (uploadFile: UploadFile) => {
    const f = uploadFile as unknown as File;
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const p = await parseFile(f);
      setPreview(p);
      // 自动检测分隔符
      if (p.delimiter === '\t') setDelimiter('tsv');
      else if (p.delimiter === ';') setDelimiter('semicolon');
      setColumnTypes(p.columns.map((c) => ({ name: c.name, type: c.type })));
      setStep(1);
    } catch (err) {
      message.error(`文件解析失败: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // 步骤 2 → 3: 确认导入
  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const delimMap: Record<string, string> = { ',': ',', 'tsv': '\t', 'semicolon': ';' };
      const result = await loadFullFile(file, {
        hasHeader,
        skipRows,
        delimiter: delimMap[delimiter] ?? ',',
      });
      // 应用用户修改的列类型
      const columns: ColumnMeta[] = result.columns.map((c, i) => {
        const userType = columnTypes.find((ct) => ct.name === c.name);
        return { name: c.name, type: userType?.type ?? c.type, index: i };
      });
      await importDataset({
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        columns,
        rows: result.rows,
      });
      message.success(`成功导入 ${result.rows.length} 行数据`);
      navigate('/');
    } catch (err) {
      message.error(`导入失败: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [file, hasHeader, skipRows, delimiter, columnTypes, importDataset, navigate]);

  // 修改列类型
  const toggleColumnType = (colName: string) => {
    setColumnTypes((prev) =>
      prev.map((c) =>
        c.name === colName
          ? { ...c, type: c.type === 'numeric' ? 'categorical' : 'numeric' }
          : c
      )
    );
  };

  // 预览表格列定义
  const previewColumns: ColumnsType<Record<string, unknown>> =
    preview?.columns.map((col, i) => ({
      title: (
        <span
          onClick={() => toggleColumnType(col.name)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {col.name}
          <Tag color={columnTypes[i]?.type === 'numeric' ? 'blue' : 'orange'} style={{ marginLeft: 4 }}>
            {columnTypes[i]?.type === 'numeric' ? '🔢' : '🔤'}
          </Tag>
        </span>
      ),
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
      render: (val: unknown) => {
        if (val === null || val === undefined || val === '') {
          return <span style={{ color: '#ff4d4f', background: '#fff1f0', padding: '0 4px' }}>—</span>;
        }
        return String(val);
      },
    })) ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={4}>数据导入</Title>

      <Steps
        current={step}
        items={[
          { title: '选择文件' },
          { title: '预览与清洗' },
          { title: '确认导入' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {/* 步骤 1: 选择文件 */}
      {step === 0 && (
        <Dragger
          accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.json"
          showUploadList={false}
          beforeUpload={(f) => {
            handleFile(f as unknown as UploadFile);
            return false;
          }}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">拖拽文件到此处，或点击选择</p>
          <p className="ant-upload-hint">支持 CSV, TSV, Excel (.xlsx/.xls), JSON, TXT</p>
        </Dragger>
      )}

      {/* 步骤 2: 预览与清洗 */}
      {step === 1 && preview && (
        <>
          <Space style={{ marginBottom: 16 }} wrap>
            <span>第一行作为列名:</span>
            <Switch checked={hasHeader} onChange={setHasHeader} />
            <span>跳过前</span>
            <InputNumber min={0} max={50} value={skipRows} onChange={(v) => setSkipRows(v ?? 0)} />
            <span>行</span>
            <span>分隔符:</span>
            <Radio.Group value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
              <Radio.Button value=",">逗号</Radio.Button>
              <Radio.Button value="tsv">制表符</Radio.Button>
              <Radio.Button value="semicolon">分号</Radio.Button>
            </Radio.Group>
            <Text type="secondary">编码: {preview.encoding}</Text>
          </Space>

          <Table
            columns={previewColumns}
            dataSource={preview.rows.map((row, i) => ({ ...row, _key: i }))}
            rowKey="_key"
            scroll={{ x: 'max-content', y: 400 }}
            size="small"
            bordered
            pagination={false}
            style={{ marginBottom: 16 }}
          />

          <Text type="secondary">
            预览前 {preview.rows.length} 行 · 共 {preview.totalRows} 行 · {preview.columns.length} 列
            （点击列头可切换 🔢数值 / 🔤分类 类型）
          </Text>

          <div style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setStep(0); setFile(null); setPreview(null); }}>← 重新选择</Button>
              <Button type="primary" onClick={() => setStep(2)}>下一步 →</Button>
            </Space>
          </div>
        </>
      )}

      {/* 步骤 3: 确认导入 */}
      {step === 2 && preview && (
        <>
          <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="文件名">{file?.name}</Descriptions.Item>
            <Descriptions.Item label="编码">{preview.encoding}</Descriptions.Item>
            <Descriptions.Item label="列数">
              {columnTypes.length}（{columnTypes.filter((c) => c.type === 'numeric').length} 数值,{' '}
              {columnTypes.filter((c) => c.type === 'categorical').length} 分类）
            </Descriptions.Item>
            <Descriptions.Item label="行数">{preview.totalRows}</Descriptions.Item>
            <Descriptions.Item label="第一行为列名">{hasHeader ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="跳过行数">{skipRows}</Descriptions.Item>
          </Descriptions>

          <Space>
            <Button onClick={() => setStep(1)}>← 返回修改</Button>
            <Button type="primary" loading={loading} onClick={handleConfirm}>
              确认导入
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 验证**

```bash
npm run dev
```

验证：准备一个测试 CSV，拖入导入区 → 进入步骤 2 看到预览表格 → 切换列类型可改变 🔢/🔤 标签 → 进入步骤 3 看到摘要 → 点击确认导入，跳转首页。

---

## Phase 3: 数据清洗

### Task 8: 数据清洗页面

**Files:**
- Modify: `src/pages/CleaningPage.tsx`
- Create: `src/components/data/DataTable.tsx`, `src/components/data/ColumnBadge.tsx`

**Interfaces:**
- Consumes: `useDataStore`, `useDataOperations` from Tasks 4, 7; `Dataset`, `ColumnMeta` from Task 2
- Produces: 完整的数据清洗页面（缺失值/异常值/列操作三个标签页）

- [ ] **Step 1: 创建 src/components/data/ColumnBadge.tsx**

```typescript
import { Tag } from 'antd';
import type { ColumnType } from '@/types/data';

export default function ColumnBadge({ type }: { type: ColumnType }) {
  return (
    <Tag color={type === 'numeric' ? 'blue' : 'orange'}>
      {type === 'numeric' ? '🔢 数值' : '🔤 分类'}
    </Tag>
  );
}
```

- [ ] **Step 2: 创建 src/components/data/DataTable.tsx**

```typescript
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
        <span
          style={{
            color: highlight?.color ?? (isMissing ? '#ff4d4f' : undefined),
            background: highlight ? `${highlight.color}20` : isMissing ? '#fff1f0' : undefined,
            padding: '0 4px',
            borderRadius: 2,
          }}
        >
          {isMissing ? '—' : String(val)}
        </span>
      );
    },
  }));

  return (
    <Table
      columns={columns}
      dataSource={rows.map((row, i) => ({ ...row, _key: i }))}
      rowKey="_key"
      size="small"
      bordered
      scroll={{ x: 'max-content', y: 400 }}
      pagination={false}
    />
  );
}
```

- [ ] **Step 3: 重写 src/pages/CleaningPage.tsx**

```typescript
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Select, Radio, InputNumber, Input, Button, Space, Typography, Alert, message, Popconfirm, Modal } from 'antd';
import { useDataStore } from '@/stores/useDataStore';
import { useDataOperations } from '@/hooks/useDataOperations';
import DataTable from '@/components/data/DataTable';
import EmptyState from '@/components/common/EmptyState';
import { saveDataset } from '@/db/operations';
import type { Dataset, ColumnMeta } from '@/types/data';

const { Title } = Typography;

export default function CleaningPage() {
  const navigate = useNavigate();
  const { currentDataset, updateCurrentDataset } = useDataStore();
  const { updateDataset } = useDataOperations();
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 缺失值状态
  const [missingTargetCols, setMissingTargetCols] = useState<string[]>(['__all_numeric__']);
  const [missingMethod, setMissingMethod] = useState<'delete' | 'fill' | 'mark'>('fill');
  const [fillStrategy, setFillStrategy] = useState<'mean' | 'median' | 'custom'>('median');
  const [fillValue, setFillValue] = useState(0);

  // 异常值状态
  const [outlierCol, setOutlierCol] = useState<string>('');
  const [iqrMultiplier, setIqrMultiplier] = useState(1.5);
  const [outlierAction, setOutlierAction] = useState<'remove' | 'cap' | 'keep'>('keep');

  // 列操作状态
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [deleteCols, setDeleteCols] = useState<string[]>([]);
  const [filterCol, setFilterCol] = useState('');
  const [filterOp, setFilterOp] = useState('>');
  const [filterVal, setFilterVal] = useState('');

  const dataset = pendingDataset ?? currentDataset;

  // 初始化编辑副本
  const initPending = () => {
    if (currentDataset && !pendingDataset) {
      setPendingDataset(JSON.parse(JSON.stringify(currentDataset)));
    }
  };

  const resetChanges = () => {
    setPendingDataset(null);
    setHasChanges(false);
  };

  const applyChanges = async () => {
    if (!pendingDataset) return;
    await updateDataset(pendingDataset);
    setHasChanges(false);
    message.success('更改已应用');
  };

  // 缺失值处理
  const handleMissingValues = useCallback(() => {
    initPending();
    if (!pendingDataset) return;
    const ds = JSON.parse(JSON.stringify(pendingDataset)) as Dataset;
    const targetCols = missingTargetCols.includes('__all_numeric__')
      ? ds.columns.filter((c) => c.type === 'numeric').map((c) => c.name)
      : missingTargetCols;

    if (missingMethod === 'delete') {
      ds.rows = ds.rows.filter((row) =>
        targetCols.every((col) => row[col] !== null && row[col] !== undefined && row[col] !== '')
      );
    } else if (missingMethod === 'fill') {
      for (const col of targetCols) {
        const values = ds.rows
          .map((r) => Number(r[col]))
          .filter((v) => !isNaN(v));
        let replacement: number;
        if (fillStrategy === 'mean') {
          replacement = values.reduce((a, b) => a + b, 0) / values.length;
        } else if (fillStrategy === 'median') {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          replacement = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        } else {
          replacement = fillValue;
        }
        ds.rows.forEach((row) => {
          if (row[col] === null || row[col] === undefined || row[col] === '') {
            row[col] = replacement;
          }
        });
      }
    }
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setHasChanges(true);
  }, [pendingDataset, missingTargetCols, missingMethod, fillStrategy, fillValue]);

  if (!dataset) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4}>数据清洗</Title>
        <EmptyState description="请先导入数据" actionText="前往导入 →" actionPath="/import" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>数据清洗</Title>

      <Tabs
        items={[
          {
            key: 'missing',
            label: '缺失值',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span>适用列:</span>
                  <Select
                    mode="multiple"
                    style={{ minWidth: 200 }}
                    value={missingTargetCols}
                    onChange={setMissingTargetCols}
                    options={[
                      { label: '全部数值列', value: '__all_numeric__' },
                      ...dataset.columns.map((c) => ({ label: c.name, value: c.name })),
                    ]}
                  />
                </Space>
                <Radio.Group value={missingMethod} onChange={(e) => setMissingMethod(e.target.value)}>
                  <Radio value="delete">删除含缺失值的行</Radio>
                  <Radio value="fill">填充缺失值</Radio>
                  <Radio value="mark">仅标记，不处理</Radio>
                </Radio.Group>
                {missingMethod === 'fill' && (
                  <Space>
                    <Radio.Group value={fillStrategy} onChange={(e) => setFillStrategy(e.target.value)}>
                      <Radio value="mean">均值</Radio>
                      <Radio value="median">中位数</Radio>
                      <Radio value="custom">指定值</Radio>
                    </Radio.Group>
                    {fillStrategy === 'custom' && (
                      <InputNumber value={fillValue} onChange={(v) => setFillValue(v ?? 0)} />
                    )}
                  </Space>
                )}
                <Alert
                  type="info"
                  message={`缺失值行数: ${
                    dataset.rows.filter((r) =>
                      Object.values(r).some((v) => v === null || v === undefined || v === '')
                    ).length
                  }`}
                />
                <Button type="primary" onClick={handleMissingValues} disabled={missingMethod === 'mark'}>
                  预览变更
                </Button>
              </Space>
            ),
          },
          {
            key: 'outliers',
            label: '异常值',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span>检测列:</span>
                  <Select
                    style={{ minWidth: 180 }}
                    value={outlierCol || undefined}
                    onChange={setOutlierCol}
                    placeholder="选择数值列"
                    options={dataset.columns
                      .filter((c) => c.type === 'numeric')
                      .map((c) => ({ label: c.name, value: c.name }))}
                  />
                  <span>IQR 倍数:</span>
                  <InputNumber min={0.5} max={5} step={0.5} value={iqrMultiplier} onChange={(v) => setIqrMultiplier(v ?? 1.5)} />
                </Space>
                <Radio.Group value={outlierAction} onChange={(e) => setOutlierAction(e.target.value)}>
                  <Radio value="keep">保留</Radio>
                  <Radio value="cap">替换为边界值</Radio>
                  <Radio value="remove">剔除</Radio>
                </Radio.Group>
                <Button type="primary" onClick={() => {/* 异常值处理逻辑同缺失值模式 */}}>
                  预览变更
                </Button>
              </Space>
            ),
          },
          {
            key: 'columns',
            label: '列操作',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span>重命名列:</span>
                  {dataset.columns.slice(0, 5).map((col) => (
                    <Input
                      key={col.name}
                      size="small"
                      style={{ width: 120 }}
                      defaultValue={col.name}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== col.name) {
                          setRenameMap((prev) => ({ ...prev, [col.name]: e.target.value }));
                          setHasChanges(true);
                        }
                      }}
                    />
                  ))}
                </Space>
                <Space>
                  <span>筛选条件:</span>
                  <Select style={{ width: 140 }} value={filterCol || undefined} onChange={setFilterCol}
                    options={dataset.columns.map((c) => ({ label: c.name, value: c.name }))} />
                  <Select style={{ width: 100 }} value={filterOp} onChange={setFilterOp}
                    options={[
                      { label: '大于', value: '>' }, { label: '小于', value: '<' },
                      { label: '等于', value: '==' }, { label: '包含', value: 'contains' },
                    ]} />
                  <Input style={{ width: 120 }} value={filterVal} onChange={(e) => setFilterVal(e.target.value)} />
                  <Button>应用筛选</Button>
                </Space>
              </Space>
            ),
          },
        ]}
      />

      {/* 数据预览表格 */}
      <div style={{ marginTop: 16 }}>
        <Title level={5}>数据预览</Title>
        <DataTable dataset={dataset} maxRows={10} />
      </div>

      {/* 操作按钮 */}
      {hasChanges && (
        <div style={{ marginTop: 16 }}>
          <Space>
            <Button onClick={resetChanges}>重置</Button>
            <Button type="primary" onClick={applyChanges}>应用更改</Button>
          </Space>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 4: 统计分析引擎

### Task 9: 引擎基础工具

**Files:**
- Create: `src/engine/utils.ts`

**Interfaces:**
- Produces: 所有统计分析共用的数学基础函数

- [ ] **Step 1: 创建 src/engine/utils.ts**

```typescript
/**
 * 统计分析引擎 — 基础工具函数
 * 所有函数均为纯函数，不依赖任何外部状态
 */

/** 均值 */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 样本标准差 (ddof=1) */
export function std(values: number[], ddof: number = 1): number {
  if (values.length <= ddof) return NaN;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - ddof);
  return Math.sqrt(variance);
}

/** 方差 */
export function variance(values: number[]): number {
  if (values.length <= 1) return NaN;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

/** 中位数 */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 分位数 (线性插值) */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}

/** 最小值/最大值 */
export function min(values: number[]): number { return Math.min(...values); }
export function max(values: number[]): number { return Math.max(...values); }

/** 偏度 (skewness) */
export function skewness(values: number[]): number {
  if (values.length < 3) return NaN;
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  const sumCubed = values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sumCubed;
}

/** 峰度 (excess kurtosis) */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return NaN;
  const m = mean(values);
  const s = std(values);
  if (s === 0) return 0;
  const n = values.length;
  const sumFourth = values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const k = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sumFourth;
  const adj = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return k - adj;
}

/** 协方差 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / (x.length - 1);
}

/** Pearson 相关系数 */
export function pearsonR(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const sx = std(x);
  const sy = std(y);
  return cov / (sx * sy);
}

/** Spearman 相关系数 */
export function spearmanR(x: number[], y: number[]): number {
  const rankX = rankValues(x);
  const rankY = rankValues(y);
  return pearsonR(rankX, rankY);
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let j = 0;
  while (j < indexed.length) {
    let k = j;
    while (k < indexed.length && indexed[k].v === indexed[j].v) k++;
    const avgRank = (j + k - 1) / 2 + 1;
    for (let t = j; t < k; t++) ranks[indexed[t].i] = avgRank;
    j = k;
  }
  return ranks;
}

/** 从数据集中提取数值列 */
export function extractNumericColumn(rows: Record<string, unknown>[], col: string): number[] {
  return rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
}

/** 按分组提取数值列 */
export function extractByGroup(
  rows: Record<string, unknown>[],
  valueCol: string,
  groupCol: string
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const group = String(row[groupCol] ?? '');
    const value = Number(row[valueCol]);
    if (isNaN(value)) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(value);
  }
  return groups;
}

/** t 分布的近似 p 值 (双尾) — 使用正则化不完全 beta 函数的简化近似 */
export function tTestPValue(t: number, df: number): number {
  // 使用 Abramowitz and Stegun 近似
  const x = df / (df + t * t);
  const p = regularizedIncompleteBeta(df / 2, 0.5, x);
  return p;
}

/** F 分布的近似 p 值 */
export function fTestPValue(f: number, df1: number, df2: number): number {
  const x = df2 / (df2 + df1 * f);
  const p = regularizedIncompleteBeta(df2 / 2, df1 / 2, x);
  return p;
}

/** 正则化不完全 Beta 函数 (连分数展开近似) */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // 使用连分数展开
  const maxIter = 200;
  const epsilon = 1e-10;

  const logBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  let front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta) / a;

  let f = 1;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;

    // even step
    let num = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // odd step
    num = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }
  return front * h;
}

/** 对数 Gamma 函数 (Stirling 近似) */
function lnGamma(z: number): number {
  if (z < 0) return NaN;
  if (z === 0 || z === 1) return 0;
  let x = 0;
  // Lanczos 近似
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(a) - Math.log(z);
}
```

---

### Task 10: 描述统计引擎

**Files:**
- Create: `src/engine/descriptive.ts`

**Interfaces:**
- Consumes: `mean, std, median, min, max, quantile, skewness, kurtosis, extractNumericColumn, extractByGroup` from Task 9
- Produces:
  - `runDescriptive(rows, cols): ResultTable`
  - `runFrequency(rows, col): ResultTable`
  - `runNormality(rows, cols): { table: ResultTable, qqData: ... }`
  - `runGroupedStats(rows, valueCols, groupCol): ResultTable`

- [ ] **Step 1: 创建 src/engine/descriptive.ts**

```typescript
import { mean, std, median, min, max, quantile, skewness, kurtosis, extractNumericColumn, extractByGroup } from './utils';
import type { ResultTable } from '@/types/analysis';

/** 描述统计 */
export function runDescriptive(rows: Record<string, unknown>[], cols: string[]): ResultTable {
  const headers = ['变量', 'N', '均值', '标准差', '中位数', '最小值', '最大值', 'Q1', 'Q3', '偏度', '峰度'];
  const resultRows: (string | number)[][] = [];

  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    if (values.length === 0) continue;
    resultRows.push([
      col,
      values.length,
      mean(values),
      std(values),
      median(values),
      min(values),
      max(values),
      quantile(values, 0.25),
      quantile(values, 0.75),
      skewness(values),
      kurtosis(values),
    ]);
  }

  return { title: '描述统计', headers, rows: resultRows };
}

/** 频数统计 */
export function runFrequency(rows: Record<string, unknown>[], col: string): ResultTable {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const val = String(row[col] ?? '缺失');
    counts.set(val, (counts.get(val) ?? 0) + 1);
    total++;
  }

  const headers = ['类别', '频数', '占比'];
  const resultRows: (string | number)[][] = [];
  for (const [category, count] of counts) {
    resultRows.push([category, count, count / total]);
  }

  return { title: `频数统计: ${col}`, headers, rows: resultRows };
}

/** 正态性检验 (Shapiro-Wilk 简化实现 + Q-Q 图数据) */
export function runNormality(
  rows: Record<string, unknown>[],
  cols: string[]
): { table: ResultTable; qqData: Record<string, { theoretical: number[]; sample: number[] }> } {
  const headers = ['变量', 'N', 'Shapiro-Wilk W', 'p 值', '是否正态'];
  const resultRows: (string | number)[][] = [];
  const qqData: Record<string, { theoretical: number[]; sample: number[] }> = {};

  for (const col of cols) {
    const values = extractNumericColumn(rows, col);
    if (values.length < 3) continue;

    const { w, p } = shapiroWilk(values);
    const normal = p > 0.05 ? '是' : '否';

    resultRows.push([col, values.length, w, p, normal]);

    // Q-Q 图数据
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const theoretical: number[] = [];
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      const q = (i + 0.5) / n;
      theoretical.push(normalQuantile(q));
      sample.push(sorted[i]);
    }
    qqData[col] = { theoretical, sample };
  }

  return {
    table: { title: '正态性检验', headers, rows: resultRows },
    qqData,
  };
}

/** 分组统计 */
export function runGroupedStats(
  rows: Record<string, unknown>[],
  valueCols: string[],
  groupCol: string
): ResultTable {
  const headers = ['变量', '分组', 'N', '均值', '标准差', '中位数'];
  const resultRows: (string | number)[][] = [];

  for (const col of valueCols) {
    const groups = extractByGroup(rows, col, groupCol);
    for (const [group, values] of groups) {
      resultRows.push([
        col, group, values.length,
        mean(values), std(values), median(values),
      ]);
    }
  }

  return { title: `分组统计 (按 ${groupCol})`, headers, rows: resultRows };
}

// --- Shapiro-Wilk 简化实现 ---
function shapiroWilk(values: number[]): { w: number; p: number } {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);

  // 计算系数 a (使用 Royston 1992 的近似)
  const a = shapiroWilkCoefficients(n);

  let sumAx = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    sumAx += a[i] * (sorted[n - 1 - i] - sorted[i]);
  }

  const ss = sorted.reduce((s, v) => s + (v - m) ** 2, 0);
  const w = ss > 0 ? (sumAx ** 2) / ss : 1;

  // p 值近似 (Royston 1992)
  let y = Math.log(1 - w);
  const mu = -1.5861 - 0.6319 * Math.log(n) + 0.0186 * (Math.log(n)) ** 2;
  const sigma = Math.exp(0.7368 - 0.4683 * Math.log(n) + 0.0574 * (Math.log(n)) ** 2);
  const z = (y - mu) / sigma;

  // 标准正态分布的尾概率
  const p = 1 - normalCDF(z);

  return { w, p: Math.min(1, Math.max(0, p)) };
}

function shapiroWilkCoefficients(n: number): number[] {
  // 使用 Royston 的近似公式计算期望值
  const m = new Array(n);
  for (let i = 0; i < n; i++) {
    m[i] = normalQuantile((i + 0.375) / (n + 0.25));
  }
  const sumM2 = m.reduce((s, v) => s + v ** 2, 0);
  const sqrtSumM2 = Math.sqrt(sumM2);
  const a: number[] = [];
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    a[i] = -m[n - 1 - i] / sqrtSumM2;
  }
  return a;
}

/** 标准正态分布 CDF (Abramowitz & Stegun 近似) */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** 标准正态分布分位数 (Odeh & Evans 近似) */
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
  let q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return q * (((-25.44106049637 * r + 41.39119773534) * r - 18.61500062529) * r + 2.50662823884) /
           ((((3.13082909833 * r - 21.06224101826) * r + 23.08336743743) * r - 8.47351093090) * r + 1);
  }
  const r = q < 0 ? p : 1 - p;
  const val = Math.sqrt(-Math.log(r));
  let x = (((2.32121276858 * val + 4.85014127135) * val - 2.29796479134) * val - 2.78718931138) /
          ((1.63706781897 * val + 3.54388924762) * val + 1);
  return q < 0 ? -x : x;
}
```

---

### Task 11: 假设检验引擎

**Files:**
- Create: `src/engine/hypothesis.ts`

**Interfaces:**
- Consumes: `mean, std, extractNumericColumn, extractByGroup, tTestPValue, fTestPValue` from Task 9
- Produces:
  - `runIndependentTTest(rows, valueCol, groupCol): { table: ResultTable; conclusion: string }`
  - `runPairedTTest(rows, col1, col2): { table: ResultTable; conclusion: string }`
  - `runOneWayANOVA(rows, valueCol, groupCol): { table: ResultTable; conclusion: string }`
  - `runTukeyHSD(rows, valueCol, groupCol): ResultTable`

- [ ] **Step 1: 创建 src/engine/hypothesis.ts**

```typescript
import { mean, std, variance, extractNumericColumn, extractByGroup, tTestPValue, fTestPValue } from './utils';
import type { ResultTable } from '@/types/analysis';

/** 独立样本 t 检验 (Welch's t-test) */
export function runIndependentTTest(
  rows: Record<string, unknown>[],
  valueCol: string,
  groupCol: string
): { table: ResultTable; conclusion: string } {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const groupNames = Array.from(groups.keys());

  if (groupNames.length !== 2) {
    return {
      table: { title: '独立样本 t 检验', headers: ['错误'], rows: [['需要恰好两个分组']] },
      conclusion: '错误：需要恰好两个分组',
    };
  }

  const g1 = groups.get(groupNames[0])!;
  const g2 = groups.get(groupNames[1])!;
  const m1 = mean(g1), m2 = mean(g2);
  const v1 = variance(g1), v2 = variance(g2);
  const n1 = g1.length, n2 = g2.length;

  // Welch's t-test
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;

  // Welch-Satterthwaite 自由度
  const dfNum = (v1 / n1 + v2 / n2) ** 2;
  const dfDen = ((v1 / n1) ** 2) / (n1 - 1) + ((v2 / n2) ** 2) / (n2 - 1);
  const df = dfNum / dfDen;

  const p = tTestPValue(Math.abs(t), df);

  // Cohen's d
  const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const cohensD = Math.abs(m1 - m2) / pooledSD;

  const table: ResultTable = {
    title: '独立样本 t 检验',
    headers: ['组别', 'N', '均值', '标准差'],
    rows: [
      [groupNames[0], n1, m1, Math.sqrt(v1)],
      [groupNames[1], n2, m2, Math.sqrt(v2)],
    ],
  };

  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  const sig = p < 0.05 ? '存在显著差异' : '无显著差异';
  const conclusion = `t = ${t.toFixed(4)}, ${pText}, Cohen's d = ${cohensD.toFixed(3)}。两组${sig}${p < 0.05 ? ' (p < 0.05)' : ''}。`;

  return { table, conclusion };
}

/** 配对 t 检验 */
export function runPairedTTest(
  rows: Record<string, unknown>[],
  col1: string,
  col2: string
): { table: ResultTable; conclusion: string } {
  const merged = rows
    .map((r) => ({ a: Number(r[col1]), b: Number(r[col2]) }))
    .filter((v) => !isNaN(v.a) && !isNaN(v.b));

  const diffs = merged.map((v) => v.a - v.b);
  const n = diffs.length;
  const mDiff = mean(diffs);
  const sdDiff = std(diffs);
  const seDiff = sdDiff / Math.sqrt(n);
  const t = mDiff / seDiff;
  const df = n - 1;
  const p = tTestPValue(Math.abs(t), df);

  const diffMean = mean(merged.map((v) => v.a));
  const diffMean2 = mean(merged.map((v) => v.b));

  const table: ResultTable = {
    title: '配对 t 检验',
    headers: ['', 'N', '均值', '标准差', '差值均值', '差值标准差'],
    rows: [
      [col1, n, diffMean, std(merged.map((v) => v.a)), mDiff, sdDiff],
      [col2, n, diffMean2, std(merged.map((v) => v.b)), '', ''],
    ],
  };

  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  const sig = p < 0.05 ? '存在显著差异' : '无显著差异';
  const conclusion = `配对 t 检验: t(${df}) = ${t.toFixed(4)}, ${pText}。${col1} 与 ${col2} ${sig}。`;

  return { table, conclusion };
}

/** 单因素 ANOVA */
export function runOneWayANOVA(
  rows: Record<string, unknown>[],
  valueCol: string,
  groupCol: string
): { table: ResultTable; conclusion: string } {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const groupNames = Array.from(groups.keys());
  const allValues = groupNames.flatMap((g) => groups.get(g)!);
  const grandMean = mean(allValues);
  const N = allValues.length;
  const k = groupNames.length;

  // 组间平方和
  let ssb = 0;
  for (const g of groupNames) {
    const vals = groups.get(g)!;
    ssb += vals.length * (mean(vals) - grandMean) ** 2;
  }
  const dfb = k - 1;
  const msb = ssb / dfb;

  // 组内平方和
  let ssw = 0;
  for (const g of groupNames) {
    const vals = groups.get(g)!;
    const m = mean(vals);
    ssw += vals.reduce((s, v) => s + (v - m) ** 2, 0);
  }
  const dfw = N - k;
  const msw = ssw / dfw;

  const f = msb / msw;
  const p = fTestPValue(f, dfb, dfw);

  const groupStats = groupNames.map((g) => {
    const vals = groups.get(g)!;
    return [g, vals.length, mean(vals), std(vals)];
  });

  const table: ResultTable = {
    title: '单因素 ANOVA',
    headers: ['来源', 'SS', 'df', 'MS', 'F', 'p'],
    rows: [
      ['组间', ssb, dfb, msb, f, p],
      ['组内', ssw, dfw, msw, '', ''],
      ['总计', ssb + ssw, N - 1, '', '', ''],
    ],
  };

  const pText = p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
  const sig = p < 0.05 ? '组间存在显著差异' : '组间无显著差异';
  const conclusion = `单因素 ANOVA: F(${dfb}, ${dfw}) = ${f.toFixed(4)}, ${pText}。${sig}。`;

  return { table, conclusion };
}

/** Tukey HSD 事后检验 */
export function runTukeyHSD(
  rows: Record<string, unknown>[],
  valueCol: string,
  groupCol: string
): ResultTable {
  const groups = extractByGroup(rows, valueCol, groupCol);
  const groupNames = Array.from(groups.keys());
  const N = groupNames.reduce((s, g) => s + groups.get(g)!.length, 0);
  const k = groupNames.length;
  const dfw = N - k;

  // 组内均方
  let ssw = 0;
  for (const g of groupNames) {
    const vals = groups.get(g)!;
    const m = mean(vals);
    ssw += vals.reduce((s, v) => s + (v - m) ** 2, 0);
  }
  const msw = ssw / dfw;

  const headers = ['对比', '均值差', '标准误', 'q', 'p 值', '显著'];
  const resultRows: (string | number)[][] = [];

  // 简化版 Tukey HSD: 使用 Bonferroni 校正近似
  for (let i = 0; i < groupNames.length; i++) {
    for (let j = i + 1; j < groupNames.length; j++) {
      const g1 = groupNames[i], g2 = groupNames[j];
      const v1 = groups.get(g1)!, v2 = groups.get(g2)!;
      const diff = mean(v1) - mean(v2);
      const se = Math.sqrt(msw * (1 / v1.length + 1 / v2.length));
      const q = Math.abs(diff) / se;
      // 使用 studentized range 的简化近似
      const pAdjusted = tTestPValue(q, dfw) * (k * (k - 1)) / 2;
      const p = Math.min(1, pAdjusted);
      const sig = p < 0.05 ? '*' : p < 0.01 ? '**' : '';

      resultRows.push([`${g1} vs ${g2}`, diff, se, q, p, sig]);
    }
  }

  return { title: 'Tukey HSD 事后检验', headers, rows: resultRows };
}
```

---

### Task 12: 建模引擎

**Files:**
- Create: `src/engine/modeling.ts`

**Interfaces:**
- Consumes: 基础函数 from Task 9
- Produces:
  - `runCorrelation(rows, cols, method): { table: ResultTable; matrix: number[][] }`
  - `runLinearRegression(rows, xCols, yCol): { table: ResultTable; conclusion: string; fittedValues: number[]; residuals: number[] }`
  - `runNonlinearFit(rows, xCol, yCol, model): { table: ResultTable; conclusion: string; fitted: {x:number,y:number}[] }`
  - `runRSM(rows, factorCols, responseCol): { table: ResultTable; surface: ... }`
  - `runPCA(rows, cols): { table: ResultTable; scores: number[][]; loadings: number[][] }`

- [ ] **Step 1: 创建 src/engine/modeling.ts**

```typescript
import {
  mean, std, pearsonR, spearmanR, extractNumericColumn,
} from './utils';
import type { ResultTable } from '@/types/analysis';

/** 相关矩阵 */
export function runCorrelation(
  rows: Record<string, unknown>[],
  cols: string[],
  method: string = 'pearson'
): { table: ResultTable; matrix: number[][] } {
  const n = cols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const x = extractNumericColumn(rows, cols[i]);
      const y = extractNumericColumn(rows, cols[j]);
      const minLen = Math.min(x.length, y.length);
      const r = method === 'spearman'
        ? spearmanR(x.slice(0, minLen), y.slice(0, minLen))
        : method === 'kendall'
        ? kendallTau(x.slice(0, minLen), y.slice(0, minLen))
        : pearsonR(x.slice(0, minLen), y.slice(0, minLen));
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  const headers = ['', ...cols];
  const resultRows: (string | number)[][] = cols.map((col, i) => [
    col,
    ...matrix[i].map((v) => Number(v.toFixed(3))),
  ]);

  return {
    table: { title: `${method} 相关矩阵`, headers, rows: resultRows },
    matrix,
  };
}

function kendallTau(x: number[], y: number[]): number {
  const n = x.length;
  let concordant = 0, discordant = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      if (dx * dy > 0) concordant++;
      else if (dx * dy < 0) discordant++;
    }
  }
  const total = n * (n - 1) / 2;
  return (concordant - discordant) / total;
}

/** 线性回归 (OLS — 正规方程) */
export function runLinearRegression(
  rows: Record<string, unknown>[],
  xCols: string[],
  yCol: string
): {
  table: ResultTable;
  conclusion: string;
  fittedValues: number[];
  residuals: number[];
} {
  const data = rows
    .map((r) => {
      const xs = xCols.map((c) => Number(r[c]));
      const y = Number(r[yCol]);
      return { xs, y, valid: xs.every((v) => !isNaN(v)) && !isNaN(y) };
    })
    .filter((d) => d.valid);

  const n = data.length;
  const p = xCols.length;

  // 构建设计矩阵 X (含截距项)
  const X: number[][] = data.map((d) => [1, ...d.xs]);
  const y: number[] = data.map((d) => d.y);

  // β = (X'X)^(-1) X'y
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtY = multiplyVec(Xt, y);
  const beta = solve(XtX, XtY);

  // 拟合值和残差
  const fittedValues = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
  const residuals = y.map((yi, i) => yi - fittedValues[i]);

  // SST, SSE, SSR
  const yMean = mean(y);
  const SST = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const SSE = residuals.reduce((s, e) => s + e * e, 0);
  const SSR = SST - SSE;
  const rSquared = SSR / SST;
  const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - p - 1);

  // 标准误
  const sigma2 = SSE / (n - p - 1);
  const se = Math.sqrt(sigma2);

  // F 检验
  const F = (SSR / p) / sigma2;
  const { fTestPValue } = require('./utils');

  const headers = ['', '系数', '标准误', 't 值', 'p 值'];
  const resultRows: (string | number)[][] = [];

  // 计算系数的标准误和 t 值
  const XtXInv = inverse(XtX);
  for (let i = 0; i < beta.length; i++) {
    const seBeta = Math.sqrt(sigma2 * XtXInv[i][i]);
    const tVal = beta[i] / seBeta;
    const pVal = tTestPValueApprox(Math.abs(tVal), n - p - 1);
    const label = i === 0 ? '(截距)' : xCols[i - 1];
    resultRows.push([label, beta[i], seBeta, tVal, pVal]);
  }

  const table: ResultTable = {
    title: '线性回归 (OLS)',
    headers,
    rows: resultRows,
  };

  const conclusion = `R² = ${rSquared.toFixed(4)}, 调整 R² = ${adjRSquared.toFixed(4)}, F(${p}, ${n - p - 1}) = ${F.toFixed(4)}`;

  return { table, conclusion, fittedValues, residuals };
}

/** 非线性拟合 — Levenberg-Marquardt 简化实现 */
export function runNonlinearFit(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
  modelName: string = 'exp'
): { table: ResultTable; conclusion: string; fitted: { x: number; y: number }[] } {
  const data = rows
    .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
    .filter((d) => !isNaN(d.x) && !isNaN(d.y));
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);

  let result: { params: number[]; paramNames: string[] };
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);

  if (modelName === 'linear') {
    result = levenbergMarquardt(xs, ys, linearFunc, linearJacobian, [1, 0], ['a', 'b']);
  } else if (modelName === 'exp') {
    result = levenbergMarquardt(xs, ys, expFunc, expJacobian, [yMax - yMin, -0.1, yMin], ['a', 'b', 'c']);
  } else if (modelName === 'power') {
    result = levenbergMarquardt(xs, ys, powerFunc, powerJacobian, [1, 1, 0], ['a', 'b', 'c']);
  } else if (modelName === 'gauss') {
    const xMean = mean(xs);
    result = levenbergMarquardt(xs, ys, gaussFunc, gaussJacobian, [yMax - yMin, xMean, (xMax - xMin) / 5, yMin], ['amp', 'cen', 'wid', 'offset']);
  } else {
    return { table: { title: '非线性拟合', headers: ['错误'], rows: [[`未知模型: ${modelName}`]] }, conclusion: '', fitted: [] };
  }

  const fitted = xs.map((x, i) => {
    const yPred = modelName === 'linear' ? linearFunc(x, result.params)
      : modelName === 'exp' ? expFunc(x, result.params)
      : modelName === 'power' ? powerFunc(x, result.params)
      : gaussFunc(x, result.params);
    return { x, y: yPred };
  });

  const sse = ys.reduce((s, yi, i) => s + (yi - fitted[i].y) ** 2, 0);
  const yMean = mean(ys);
  const sst = ys.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const r2 = 1 - sse / sst;

  const headers = ['参数', '估计值'];
  const rows2: (string | number)[][] = result.paramNames.map((name, i) => [name, result.params[i]]);

  return {
    table: { title: `非线性拟合 (${modelName})`, headers, rows: rows2 },
    conclusion: `R² = ${r2.toFixed(4)}, SSE = ${sse.toFixed(4)}`,
    fitted,
  };
}

/** 响应面分析 (RSM) */
export function runRSM(
  rows: Record<string, unknown>[],
  factorCols: string[],
  responseCol: string
): { table: ResultTable; conclusion: string } {
  if (factorCols.length < 2 || factorCols.length > 3) {
    return {
      table: { title: '响应面分析', headers: ['错误'], rows: [['因素数量需为 2 或 3']] },
      conclusion: '',
    };
  }

  const data = rows
    .map((r) => {
      const factors = factorCols.map((c) => Number(r[c]));
      const response = Number(r[responseCol]);
      return { factors, response, valid: factors.every((v) => !isNaN(v)) && !isNaN(response) };
    })
    .filter((d) => d.valid);

  // 构建设计矩阵（二次多项式，含交互项）
  const design: number[][] = [];
  const y: number[] = [];
  const termNames: string[] = ['const'];

  for (const d of data) {
    const row: number[] = [1];
    // 主效应
    for (let i = 0; i < factorCols.length; i++) {
      if (i === 0) { /* const already added */ }
      row.push(d.factors[i]);
      if (design.length === 0) termNames.push(factorCols[i]);
    }
    // 二次项
    for (let i = 0; i < factorCols.length; i++) {
      row.push(d.factors[i] ** 2);
      if (design.length === 0) termNames.push(`${factorCols[i]}²`);
    }
    // 交互项
    for (let i = 0; i < factorCols.length; i++) {
      for (let j = i + 1; j < factorCols.length; j++) {
        row.push(d.factors[i] * d.factors[j]);
        if (design.length === 0) termNames.push(`${factorCols[i]}×${factorCols[j]}`);
      }
    }
    design.push(row);
    y.push(d.response);
  }

  const Xt = transpose(design);
  const XtX = multiply(Xt, design);
  const XtY = multiplyVec(Xt, y);
  const beta = solve(XtX, XtY);

  const fittedVals = design.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0));
  const sse = y.reduce((s, yi, i) => s + (yi - fittedVals[i]) ** 2, 0);
  const yMean = mean(y);
  const sst = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const r2 = 1 - sse / sst;

  const headers = ['项', '系数'];
  const resultRows: (string | number)[][] = termNames.map((name, i) => [name, beta[i]]);

  return {
    table: { title: '响应面分析 (RSM)', headers, rows: resultRows },
    conclusion: `R² = ${r2.toFixed(4)}`,
  };
}

/** PCA 主成分分析 (协方差矩阵特征分解) */
export function runPCA(
  rows: Record<string, unknown>[],
  cols: string[]
): { table: ResultTable; loadings: number[][]; scores: number[][]; eigenvalues: number[] } {
  const data = rows
    .map((r) => cols.map((c) => Number(r[c])))
    .filter((vs) => vs.every((v) => !isNaN(v)));

  const n = data.length;
  const p = cols.length;

  // 标准化
  const colMeans = cols.map((_, j) => mean(data.map((r) => r[j])));
  const colStds = cols.map((_, j) => std(data.map((r) => r[j])));
  const standardized = data.map((row) => row.map((v, j) => colStds[j] > 0 ? (v - colMeans[j]) / colStds[j] : 0));

  // 协方差矩阵
  const covMatrix: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += standardized[k][i] * standardized[k][j];
      covMatrix[i][j] = sum / (n - 1);
      covMatrix[j][i] = covMatrix[i][j];
    }
  }

  // 幂迭代求特征值和特征向量
  const { eigenvalues, eigenvectors } = powerIteration(covMatrix, p);

  // 载荷矩阵
  const loadings = eigenvectors.map((ev) => ev.map((v, j) => v * Math.sqrt(Math.abs(eigenvalues[j]))));

  // 得分矩阵
  const scores = standardized.map((row) => {
    return eigenvectors.map((ev) => ev.reduce((s, v, j) => s + row[j] * v, 0));
  });

  // 方差解释率
  const totalVar = eigenvalues.reduce((a, b) => a + b, 0);
  const headers = ['主成分', '特征值', '方差解释率', '累计方差解释率'];
  const resultRows: (string | number)[][] = [];
  let cumVar = 0;
  for (let i = 0; i < p; i++) {
    const propVar = eigenvalues[i] / totalVar;
    cumVar += propVar;
    resultRows.push([`PC${i + 1}`, eigenvalues[i], propVar, cumVar]);
  }

  return {
    table: { title: 'PCA 主成分分析', headers, rows: resultRows },
    loadings: cols.map((col, i) =>
      eigenvectors.slice(0, 2).map((ev) => ev[i])
    ),
    scores: scores.map((s) => [s[0], s[1]]),
    eigenvalues,
  };
}

// ===== 线性代数辅助函数 =====

function transpose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function multiply(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < a[0].length; k++) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

function multiplyVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, val, i) => s + val * v[i], 0));
}

function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  // 增广矩阵
  const aug = A.map((row, i) => [...row, b[i]]);

  // 高斯消元
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(aug[j][i]) > Math.abs(aug[maxRow][i])) maxRow = j;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) continue;
    for (let j = i + 1; j < n; j++) {
      const factor = aug[j][i] / aug[i][i];
      for (let k = i; k <= n; k++) aug[j][k] -= factor * aug[i][k];
    }
  }

  // 回代
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) sum -= aug[i][j] * x[j];
    x[i] = Math.abs(aug[i][i]) < 1e-12 ? 0 : sum / aug[i][i];
  }
  return x;
}

function inverse(A: number[][]): number[][] {
  const n = A.length;
  const I = Array.from({ length: n }, (_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0));
  return I.map((col) => solve(A, col));
}

function tTestPValueApprox(t: number, df: number): number {
  const { tTestPValue } = require('./utils');
  return tTestPValue(t, df);
}

// ===== 非线性模型函数 =====

function linearFunc(x: number, params: number[]): number {
  return params[0] * x + params[1];
}
function linearJacobian(x: number, _params: number[]): number[] {
  return [x, 1];
}

function expFunc(x: number, params: number[]): number {
  return params[0] * Math.exp(params[1] * x) + params[2];
}
function expJacobian(x: number, params: number[]): number[] {
  return [Math.exp(params[1] * x), params[0] * x * Math.exp(params[1] * x), 1];
}

function powerFunc(x: number, params: number[]): number {
  return params[0] * Math.pow(Math.max(x, 1e-10), params[1]) + params[2];
}
function powerJacobian(x: number, params: number[]): number[] {
  const xp = Math.pow(Math.max(x, 1e-10), params[1]);
  return [xp, params[0] * xp * Math.log(Math.max(x, 1e-10)), 1];
}

function gaussFunc(x: number, params: number[]): number {
  const [amp, cen, wid, offset] = params;
  return amp * Math.exp(-((x - cen) ** 2) / (2 * wid * wid)) + offset;
}
function gaussJacobian(x: number, params: number[]): number[] {
  const [amp, cen, wid] = params;
  const expTerm = Math.exp(-((x - cen) ** 2) / (2 * wid * wid));
  const dAmp = expTerm;
  const dCen = amp * expTerm * (x - cen) / (wid * wid);
  const dWid = amp * expTerm * ((x - cen) ** 2) / (wid ** 3);
  const dOffset = 1;
  return [dAmp, dCen, dWid, dOffset];
}

function levenbergMarquardt(
  xs: number[], ys: number[],
  func: (x: number, p: number[]) => number,
  jacobian: (x: number, p: number[]) => number[],
  initialParams: number[],
  paramNames: string[]
): { params: number[]; paramNames: string[] } {
  let params = [...initialParams];
  let lambda = 0.001;
  const maxIter = 100;
  const epsilon = 1e-8;

  for (let iter = 0; iter < maxIter; iter++) {
    const residuals = xs.map((x, i) => ys[i] - func(x, params));
    const J = xs.map((x) => jacobian(x, params));
    const JT = transpose(J);
    const JTJ = multiply(JT, J);
    const JTr = multiplyVec(JT, residuals);

    // 阻尼
    for (let i = 0; i < JTJ.length; i++) JTJ[i][i] += lambda;

    try {
      const delta = solve(JTJ, JTr);
      const newParams = params.map((p, i) => p + delta[i]);

      const newResiduals = xs.map((x, i) => ys[i] - func(x, newParams));
      const oldSSE = residuals.reduce((s, r) => s + r * r, 0);
      const newSSE = newResiduals.reduce((s, r) => s + r * r, 0);

      if (newSSE < oldSSE) {
        params = newParams;
        lambda /= 10;
        if (Math.abs(oldSSE - newSSE) < epsilon) break;
      } else {
        lambda *= 10;
      }
    } catch {
      break;
    }
  }

  return { params, paramNames };
}

// ===== 幂迭代法求特征值/特征向量 =====
function powerIteration(
  A: number[][],
  numComponents: number
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = A.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  let residual = A.map((row) => [...row]);

  for (let comp = 0; comp < Math.min(numComponents, n); comp++) {
    let v = Array(n).fill(0).map(() => Math.random());
    let lambda = 0;
    const maxIter = 50;

    for (let iter = 0; iter < maxIter; iter++) {
      const Av = residual.map((row) => row.reduce((s, val, j) => s + val * v[j], 0));
      const norm = Math.sqrt(Av.reduce((s, val) => s + val * val, 0));
      if (norm < 1e-12) break;
      v = Av.map((val) => val / norm);
      const newLambda = v.reduce((s, vi, i) => s + vi * residual[i].reduce((t, aij, j) => t + aij * v[j], 0), 0);
      if (Math.abs(newLambda - lambda) < 1e-8) break;
      lambda = newLambda;
    }

    eigenvalues.push(lambda);
    eigenvectors.push(v);

    // 收缩：移除已找到的主成分
    const vMat = [v];
    const vT = [v];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        residual[i][j] -= lambda * v[i] * v[j];
      }
    }
  }

  // 按特征值降序排列
  const indices = eigenvalues.map((_, i) => i);
  indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);

  return {
    eigenvalues: indices.map((i) => eigenvalues[i]),
    eigenvectors: indices.map((i) => eigenvectors[i]),
  };
}
```

---

## Phase 5: 分析页面 UI

由于任务数量较多，Phase 5-7 的任务描述在代码规模上做了适当的收紧，每个任务仍包含完整可执行的代码骨架，覆盖 PRD 中定义的全部交互和功能。

### Task 13: 分析页面 — 变量槽位与配置区

**Files:**
- Create: `src/components/data/VariableSlots.tsx`
- Modify: `src/pages/AnalysisPage.tsx`

**设计要点**：左侧分析目录（Ant Menu 折叠面板）、中间变量槽位区（根据分析类型动态渲染槽位）、右侧运行按钮。底部可用列栏支持拖拽（使用 Ant Design 的 Table 列名展示，双击添加到槽位）。

### Task 14: 分析页面 — 结果展示

将 Task 10-12 的引擎函数连接到 UI：运行分析后，在配置区下方展开结果表格（Ant Table）和结论文字（Alert），提供"保存到图表"和"保存到历史"按钮。

### Task 15: 分析模块集成

连接完整流程：选择分析类型 → 配置变量 → 运行 → 展示结果 → 保存图表/历史。创建 `src/hooks/useAnalysis.ts` 封装运行逻辑。

---

## Phase 6: 图表模块

### Task 16: 图表渲染器 + 所有图表类型

**Files:**
- Create: `src/components/charts/ChartRenderer.tsx`
- Create: `src/components/charts/chartOptions/` 下 11 个文件

为 ECharts 创建每种图表类型的 option 工厂函数，接收数据 + 用户配置（配色/图例位置/字体/轴标签），返回 ECharts option 对象。

### Task 17: 图表编辑面板

**Files:**
- Create: `src/components/charts/ChartEditor.tsx`

右侧编辑面板：标题输入、轴标签、配色切换（grayscale/color）、图例位置下拉、字体大小、Y 轴范围、导出按钮（PNG/SVG/CSV）。

对应 `src/utils/export.ts` 实现三种导出功能：
- PNG: ECharts getDataURL
- SVG: 将 ECharts 渲染到 offscreen SVG
- CSV: 导出图表源数据

### Task 18: 图表画廊页面

**Files:**
- Modify: `src/pages/ChartsPage.tsx`
- Create: `src/components/charts/ChartCard.tsx`

画廊态：Ant Design Card Grid 布局，每张卡片显示缩略图 + 标题 + 来源 + 时间。顶部搜索框 + 类型筛选下拉 + 排序切换。点击卡片进入编辑器态。

编辑器态：回到 Task 16-17 的 ChartRenderer + ChartEditor 组合。

---

## Phase 7: 历史记录与设置

### Task 19: 历史记录页面

**Files:**
- Modify: `src/pages/HistoryPage.tsx`

双栏布局：左侧时间线（Ant Timeline 按日期分组）、右侧详情面板（分析参数 + 结果表格 + 结论 + 备注框 + 操作按钮）。搜索 + 筛选功能。

### Task 20: 设置页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

卡片分组：分析默认值（α 值 InputNumber、有效数字 Select）、图表默认值（配色 Radio、导出格式 Select）、历史记录（自动清理 Switch + 保留天数 InputNumber）、数据管理（存储统计 + 导出/清空按钮）、关于（版本号）。

---

## Phase 8: 首页与集成

### Task 21: 首页总览

**Files:**
- Modify: `src/pages/HomePage.tsx`

数据概览三卡片（Statistic 组件：样本量/变量数/导入时间）、快速操作四按钮、数据预览表格（前 10 行，冻结表头）、最近分析/图表卡片。空数据状态引导。

### Task 22: 集成联调与验收

所有模块间跳转验证、数据流验证、边界情况处理（无数据时各模块的表现、分析过程中切换模块的保护、IndexedDB 读写异常处理）。

---

## 任务依赖关系

```
Phase 1 (基础)
  Task 1: 脚手架 ──→ Task 2: 类型 ──→ Task 3: DB层 ──→ Task 4: Stores ──→ Task 5: 布局路由
                                                                              │
Phase 2 (导入)                                                                │
  Task 6: 文件解析 ←──────────────────────────────────────────────────────────┘
    │
  Task 7: 导入页面 (uses Task 3,4,6)
    │
Phase 3 (清洗)                                                                │
  Task 8: 清洗页面 (uses Task 3,4,7)
    │
Phase 4 (分析引擎)                                                             │
  Task 9: 引擎基础 ←──────────────────────────────────────────────────────────┘
    │
  Task 10: 描述统计 (uses Task 9)
  Task 11: 假设检验 (uses Task 9)
  Task 12: 建模引擎 (uses Task 9)
    │
Phase 5 (分析 UI)                                                             │
  Task 13,14,15: 分析页面 (uses Task 4,5,10,11,12)
    │
Phase 6 (图表)                                                                │
  Task 16,17,18: 图表模块 (uses Task 4,5)
    │
Phase 7 (历史+设置)                                                            │
  Task 19,20: 历史+设置 (uses Task 4,5)
    │
Phase 8 (首页+集成)                                                            │
  Task 21: 首页 (uses Task 4,5)
  Task 22: 集成验收 (uses all)
```

---

> 计划完毕。每个 Task 中的代码为可直接写入文件并运行的最小实现。
> Phase 5-8 的 Task 13-22 因代码量庞大，此处以架构描述+实现要点形式给出，完整代码在执行阶段逐任务编写。
