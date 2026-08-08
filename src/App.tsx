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
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#434343' } }}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
