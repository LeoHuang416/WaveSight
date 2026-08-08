import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Button, Table, Typography, Space, Empty } from 'antd';
import { ImportOutlined, ExperimentOutlined, BarChartOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/useDataStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useChartStore } from '@/stores/useChartStore';
import DataTable from '@/components/data/DataTable';

const { Title, Text } = Typography;

export default function HomePage() {
  const navigate = useNavigate();
  const currentDataset = useDataStore((s) => s.currentDataset);
  const records = useHistoryStore((s) => s.records);
  const charts = useChartStore((s) => s.charts);
  const latestRecord = records[0];
  const latestChart = charts[0];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>首页总览</Title>

      {!currentDataset ? (
        <Empty description="暂无数据" style={{ padding: 60 }}>
          <Button type="primary" icon={<ImportOutlined />} onClick={() => navigate('/import')}>
            导入实验数据
          </Button>
        </Empty>
      ) : (
        <>
          {/* Status cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}><Card size="small"><Statistic title="样本量" value={currentDataset.rowCount} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="变量数" value={currentDataset.colCount}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{currentDataset.columns.filter((c) => c.type === 'numeric').length}数值</Text>} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="数据集" value={currentDataset.name}
              valueStyle={{ fontSize: 16 }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="导入时间" value={new Date(currentDataset.importedAt).toLocaleDateString('zh-CN')}
              valueStyle={{ fontSize: 16 }} /></Card></Col>
          </Row>

          {/* Quick actions */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}><Button block icon={<ImportOutlined />} onClick={() => navigate('/import')}>导入数据</Button></Col>
            <Col span={8}><Button block icon={<ExperimentOutlined />} onClick={() => navigate('/analysis')}>描述统计</Button></Col>
            <Col span={8}><Button block icon={<BarChartOutlined />} onClick={() => navigate('/charts')}>新建图表</Button></Col>
          </Row>

          {/* Preview table */}
          <Card title="数据预览" size="small" style={{ marginBottom: 24 }}>
            <DataTable dataset={currentDataset} maxRows={10} />
          </Card>

          {/* Recent activity */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title="最近分析" size="small" extra={<Button type="link" size="small" onClick={() => navigate('/history')}>全部 →</Button>}>
                {latestRecord ? (
                  <div>
                    <Text strong>{latestRecord.result.tables[0]?.title ?? '分析'}</Text><br />
                    <Text type="secondary">{latestRecord.result.conclusion.slice(0, 60)}</Text><br />
                    <Text style={{ fontSize: 11, color: '#999' }}>{new Date(latestRecord.createdAt).toLocaleString('zh-CN')}</Text>
                    <Button type="link" size="small" onClick={() => { navigate('/history'); }}>查看详情 →</Button>
                  </div>
                ) : <Empty description="暂无分析记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="最近图表" size="small" extra={<Button type="link" size="small" onClick={() => navigate('/charts')}>全部 →</Button>}>
                {latestChart ? (
                  <div>
                    <Text strong>{latestChart.title}</Text><br />
                    <Text style={{ fontSize: 11, color: '#999' }}>{new Date(latestChart.createdAt).toLocaleString('zh-CN')}</Text>
                    <Button type="link" size="small" onClick={() => { navigate('/charts'); }}>查看详情 →</Button>
                  </div>
                ) : <Empty description="暂无图表" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
