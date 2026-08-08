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
        <Sider width={120} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}><Sidebar /></Sider>
        <Content style={{ background: '#fafafa', overflow: 'auto' }}><Outlet /></Content>
      </Layout>
      <Footer />
    </Layout>
  );
}
