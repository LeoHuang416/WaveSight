import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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

const router = createBrowserRouter([{
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
}]);

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#5B7F95',
          colorSuccess: '#7BA587',
          colorWarning: '#C9A96E',
          colorError: '#C47878',
          colorInfo: '#5B7F95',
          borderRadius: 12,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          fontSize: 14,
          colorText: '#333333',
          colorTextSecondary: '#888888',
          colorBgContainer: 'rgba(255,255,255,0.65)',
          colorBorder: 'rgba(0,0,0,0.06)',
          paddingLG: 24,
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
