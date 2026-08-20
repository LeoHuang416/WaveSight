import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AnalysisPage from '@/pages/AnalysisPage';
import { useDataStore } from '@/stores/useDataStore';
import type { Dataset } from '@/types/data';

const ds: Dataset = {
  id: 'd1', name: '实验数据', fileName: 'a.csv',
  columns: [
    { name: 'x', type: 'numeric', role: 'independent', index: 0 },
    { name: 'y', type: 'numeric', role: 'dependent', index: 1 },
  ],
  rows: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }],
  rowCount: 3, colCount: 2, importedAt: Date.now(),
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#6366f1' } }}>
      <MemoryRouter>{children}</MemoryRouter>
    </ConfigProvider>
  );
}

describe('AnalysisPage 收起功能（问题3）', () => {
  beforeEach(() => {
    useDataStore.setState({ currentDatasetId: ds.id, currentDataset: ds, datasetList: [ds] });
  });

  it('运行分析后：模块级收起按钮可隐藏/展开该模块内容，且不删除其他模块', async () => {
    const { container } = render(<Wrapper><AnalysisPage /></Wrapper>);
    // 引导创建默认会话（描述统计，默认勾选前 2 个输出模块）
    await waitFor(() => expect(screen.getByText('运行分析')).toBeDefined());
    fireEvent.click(screen.getByText('运行分析'));
    await waitFor(() => {
      expect(screen.getByLabelText('收起模块 样本量 (N)')).toBeDefined();
    });
    await waitFor(() => {
      expect(container.querySelectorAll('.ant-table').length).toBe(2);
    });

    // 收起第一个模块
    fireEvent.click(screen.getByLabelText('收起模块 样本量 (N)'));
    await waitFor(() => {
      expect(container.querySelectorAll('.ant-table').length).toBe(1);
    });
    // 重新展开
    fireEvent.click(screen.getByLabelText('展开模块 样本量 (N)'));
    await waitFor(() => {
      expect(container.querySelectorAll('.ant-table').length).toBe(2);
    });
  });

  it('会话级收起按钮隐藏全部输出模块，并显示已收起提示', async () => {
    const { container } = render(<Wrapper><AnalysisPage /></Wrapper>);
    await waitFor(() => expect(screen.getByText('运行分析')).toBeDefined());
    fireEvent.click(screen.getByText('运行分析'));
    await waitFor(() => {
      expect(container.querySelectorAll('.ant-table').length).toBe(2);
    });

    fireEvent.click(screen.getByLabelText('收起会话'));
    expect(await screen.findByText(/已收起 · 2 个输出模块/)).toBeDefined();
    expect(container.querySelectorAll('.ant-table').length).toBe(0);

    fireEvent.click(screen.getByLabelText('展开会话'));
    await waitFor(() => {
      expect(container.querySelectorAll('.ant-table').length).toBe(2);
    });
  });
});