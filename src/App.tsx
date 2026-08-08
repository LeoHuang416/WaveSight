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
