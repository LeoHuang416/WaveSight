# 实验数据分析工作台 · Experimental Data Analysis Workbench

纯前端（Client-side）的科研实验数据分析工具。数据完全存储在浏览器本地（IndexedDB），无需后端，离线可用。界面为中文。

A client-side statistical data analysis workbench for experimental research. All data stays in your browser (IndexedDB) — no backend, works offline. UI is in Chinese.

## 功能特性 / Features

- **数据导入 / Import**：Excel（.xlsx）、CSV，自动列类型推断
- **统计分析 / Statistics**
  - 描述统计、正态性检验、方差分析（ANOVA）
  - 相关分析（Pearson / Spearman）、线性与非线性回归
  - **响应面分析 RSM**：完整二次模型（编码/实际变量）、向后剔除变量筛选、残差诊断（标准化残差 / Cook 距离 / 影响点）、规划求解最优条件、编码与实际变量双形式方程
  - 主成分分析 PCA、全流程分析 pipeline（缺失诊断 → 异常值 → 标准化 → 假设检验 → 建模）
- **图表 / Charts**：柱状、折线、散点、面积、箱线、小提琴、误差棒、Q-Q、热力图、等高线图、3D 响应曲面、直方图
- **本地持久化 / Local persistence**：分析与图表历史保存于 IndexedDB，刷新不丢失

## 技术栈 / Tech Stack

React 18 · TypeScript · Vite · Ant Design 5 · ECharts 5 + echarts-gl · Zustand · Dexie (IndexedDB) · jstat · ml-pca · ml-regression · PapaParse · xlsx · Vitest

## 快速开始 / Getting Started

```bash
npm install       # 安装依赖
npm run dev       # 开发服务器
npm run build     # 生产构建（tsc 类型检查 + vite 打包）
npm run test      # 运行单元测试
npm run preview   # 预览生产构建
```

构建产物输出到 `dist/`，可直接部署为静态站点。

## 项目结构 / Project Structure

```
src/
  components/    UI 组件
  pages/         页面（导入 / 分析 / 图表 / 历史）
  engine/        统计分析引擎（纯函数，含单元测试）
  db/            IndexedDB 持久化层
  stores/        Zustand 状态管理
  types/         TypeScript 类型定义
  utils/         通用工具（导出、格式化等）
tools/
  *.py           Python 参考实现，用于与前端分析结果交叉验证
docs/
  PRD.md         产品需求文档
```

## 数据说明 / Data & Privacy

所有数据与分析结果仅保存在浏览器本地（IndexedDB），**不会上传到任何服务器**。清除浏览器站点数据即完成删除。

## 许可证 / License

[MIT](LICENSE)
