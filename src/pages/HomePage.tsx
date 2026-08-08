import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Button, Typography, Space, Empty, Steps } from 'antd';
import { ImportOutlined, ExperimentOutlined, BarChartOutlined, ClearOutlined, ThunderboltOutlined, HistoryOutlined } from '@ant-design/icons';
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
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Title level={3}>欢迎使用实验数据分析工作台</Title>
          <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 32 }}>
            一站式数据导入、清洗、分析与可视化工具，助力科研数据处理
          </Text>

          {/* Feature cards */}
          <Row gutter={16} style={{ marginBottom: 32, textAlign: 'left' }}>
            {[
              { icon: <ImportOutlined style={{ fontSize: 24 }} />, title: '数据导入', desc: '支持 CSV / Excel / JSON 等多种格式', color: '#1677ff', path: '/import' },
              { icon: <ClearOutlined style={{ fontSize: 24 }} />, title: '数据清洗', desc: '缺失值填充、异常值检测、列重命名', color: '#fa8c16', path: '/cleaning' },
              { icon: <ExperimentOutlined style={{ fontSize: 24 }} />, title: '统计分析', desc: '描述统计、假设检验、回归、PCA 等 12 种方法', color: '#52c41a', path: '/analysis' },
              { icon: <BarChartOutlined style={{ fontSize: 24 }} />, title: '图表可视化', desc: '12 种图表类型，支持导出 SVG/PNG/CSV', color: '#722ed1', path: '/charts' },
            ].map((feat) => (
              <Col span={6} key={feat.path}>
                <Card hoverable size="small" onClick={() => navigate(feat.path)} style={{ cursor: 'pointer', height: '100%' }}>
                  <div style={{ color: feat.color, marginBottom: 8 }}>{feat.icon}</div>
                  <Text strong>{feat.title}</Text><br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{feat.desc}</Text>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Quick start steps */}
          <div style={{ maxWidth: 560, margin: '0 auto 24px', textAlign: 'left' }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>🚀 快速开始</Text>
            <Steps direction="vertical" size="small" current={-1}
              items={[
                { title: '导入数据', description: '拖拽或选择 CSV / Excel / JSON 文件', icon: <ImportOutlined /> },
                { title: '清洗数据', description: '处理缺失值和异常值，确保数据质量', icon: <ClearOutlined /> },
                { title: '分析数据', description: '选择合适的统计分析方法运行分析', icon: <ExperimentOutlined /> },
                { title: '导出结果', description: '保存图表、导出数据或查看历史记录', icon: <HistoryOutlined /> },
              ]}
            />
          </div>

          <Button type="primary" size="large" icon={<ImportOutlined />} onClick={() => navigate('/import')}>
            导入实验数据
          </Button>
        </div>
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
