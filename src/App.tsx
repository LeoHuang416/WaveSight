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
import { useTheme, useAntTheme } from '@/themes/useTheme';
import { useSettingsStore } from '@/stores/useSettingsStore';

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

function ThemeApp() {
  useTheme();
  const antTheme = useAntTheme();
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        ...antTheme,
        algorithm: appearanceMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

export default function App() {
  return <ThemeApp />;
}
