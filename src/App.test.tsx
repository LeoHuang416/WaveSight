import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import ImportPage from '@/pages/ImportPage';
import CleaningPage from '@/pages/CleaningPage';
import AnalysisPage from '@/pages/AnalysisPage';
import ChartsPage from '@/pages/ChartsPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

function Wrapper({ children, route = '/' }: { children: React.ReactNode; route?: string }) {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#434343' } }}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </ConfigProvider>
  );
}

describe('App Layout', () => {
  it('renders sidebar with all menu items', () => {
    render(<Wrapper><AppLayout /></Wrapper>);
    expect(screen.getByText('总览')).toBeDefined();
    expect(screen.getByText('导入')).toBeDefined();
    expect(screen.getByText('清洗')).toBeDefined();
    expect(screen.getByText('分析')).toBeDefined();
    expect(screen.getByText('图表')).toBeDefined();
    expect(screen.getByText('历史')).toBeDefined();
    expect(screen.getByText('设置')).toBeDefined();
  });
  it('shows app title', () => {
    render(<Wrapper><AppLayout /></Wrapper>);
    expect(screen.getByText('实验数据分析工作台')).toBeDefined();
    expect(screen.getByText('数据工作台')).toBeDefined();
  });
});

describe('HomePage', () => {
  it('shows welcome content when no data', () => {
    render(<Wrapper><HomePage /></Wrapper>);
    expect(screen.getByText('欢迎使用实验数据分析工作台')).toBeDefined();
    expect(screen.getByText('导入实验数据')).toBeDefined();
  });
  it('shows feature cards', () => {
    render(<Wrapper><HomePage /></Wrapper>);
    expect(screen.getByText('数据导入')).toBeDefined();
    expect(screen.getByText('数据清洗')).toBeDefined();
    expect(screen.getByText('统计分析')).toBeDefined();
    expect(screen.getByText('图表可视化')).toBeDefined();
  });
  it('shows quick start steps', () => {
    render(<Wrapper><HomePage /></Wrapper>);
    expect(screen.getByText(/快速开始/)).toBeDefined();
    expect(screen.getByText(/导入数据/)).toBeDefined();
    expect(screen.getByText(/清洗数据/)).toBeDefined();
  });
});

describe('ImportPage', () => {
  it('renders step wizard', () => {
    render(<Wrapper><ImportPage /></Wrapper>);
    expect(screen.getByText('选择文件')).toBeDefined();
    expect(screen.getByText('预览与清洗')).toBeDefined();
    expect(screen.getByText('确认导入')).toBeDefined();
    expect(screen.getByText('拖拽文件到此处，或点击选择')).toBeDefined();
  });
});

describe('CleaningPage', () => {
  it('shows empty state when no dataset', () => {
    render(<Wrapper><CleaningPage /></Wrapper>);
    expect(screen.getByText('请先导入数据')).toBeDefined();
  });
});

describe('AnalysisPage', () => {
  it('shows empty state when no dataset', () => {
    render(<Wrapper><AnalysisPage /></Wrapper>);
    expect(screen.getByText('请先导入数据')).toBeDefined();
  });
});

describe('ChartsPage', () => {
  it('renders gallery with create button', () => {
    render(<Wrapper><ChartsPage /></Wrapper>);
    expect(screen.getByText('新建图表')).toBeDefined();
  });
  it('renders empty state when no charts', () => {
    render(<Wrapper><ChartsPage /></Wrapper>);
    expect(screen.getByText('暂无图表，分析数据后保存图表或点击"新建图表"')).toBeDefined();
  });
  it('shows chart type filter', () => {
    render(<Wrapper><ChartsPage /></Wrapper>);
    expect(screen.getByText('实验图表')).toBeDefined();
  });
});

describe('HistoryPage', () => {
  it('renders search and filter', () => {
    render(<Wrapper><HistoryPage /></Wrapper>);
    expect(screen.getByText('历史记录')).toBeDefined();
  });
  it('shows empty state when no record selected', () => {
    render(<Wrapper><HistoryPage /></Wrapper>);
    expect(screen.getByText('选择一条记录查看详情')).toBeDefined();
  });
  it('shows empty list when no history', () => {
    render(<Wrapper><HistoryPage /></Wrapper>);
    expect(screen.getByText('暂无记录')).toBeDefined();
  });
});

describe('SettingsPage', () => {
  it('renders all setting cards', () => {
    render(<Wrapper><SettingsPage /></Wrapper>);
    expect(screen.getByText('分析默认值')).toBeDefined();
    expect(screen.getByText('图表默认值')).toBeDefined();
    expect(screen.getByText('数据管理')).toBeDefined();
    expect(screen.getByText('关于')).toBeDefined();
  });
  it('shows version info', () => {
    render(<Wrapper><SettingsPage /></Wrapper>);
    expect(screen.getByText('实验数据分析工作台 v1.0')).toBeDefined();
  });
  it('renders without crashing and shows stats', async () => {
    render(<Wrapper><SettingsPage /></Wrapper>);
    // verify stats are displayed (default 0)
    expect(screen.getByText('数据集')).toBeDefined();
    expect(screen.getByText('图表')).toBeDefined();
    expect(screen.getAllByText('历史记录').length).toBeGreaterThan(0);
    // verify export and clear buttons exist
    expect(screen.getByText('导出全部数据 (JSON)')).toBeDefined();
    expect(screen.getByText('清空全部数据')).toBeDefined();
  });
});
