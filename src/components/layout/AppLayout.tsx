import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Footer from './Footer';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

const { Sider, Content } = Layout;

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const t = getTheme(uiTheme);

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Layout style={{ background: 'transparent', marginTop: 56 }}>
        <Sider
          id="app-sidebar"
          width={t.sidebarWidth}
          collapsedWidth={t.sidebarCollapsedWidth}
          collapsible
          collapsed={collapsed}
          trigger={null}
          style={{
            background: 'transparent',
            border: 'none',
            height: 'calc(100vh - 56px)',
            position: 'fixed',
            left: 0,
            top: 56,
            zIndex: 100,
          }}
        >
          <Sidebar collapsed={collapsed} />
        </Sider>
        <Content
          style={{
            marginLeft: collapsed ? t.sidebarCollapsedWidth : t.sidebarWidth,
            transition: 'margin-left 0.2s ease-in-out',
            background: 'transparent',
            minHeight: 'calc(100vh - 56px - 32px)',
          }}
        >
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 24px 0' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
      <Footer collapsed={collapsed} />
    </Layout>
  );
}
