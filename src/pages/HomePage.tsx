import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Button, Typography, Space, Steps } from 'antd';
import { ImportOutlined, ExperimentOutlined, BarChartOutlined, ClearOutlined, HistoryOutlined } from '@ant-design/icons';
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
    <div style={{ padding: '4px 0 24px' }}>
      {!currentDataset ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Title level={3} style={{ fontWeight: 600, marginBottom: 8, color: '#333' }}>
            欢迎使用实验数据分析工作台
          </Title>
          <Text type="secondary" style={{ fontSize: 15, display: 'block', marginBottom: 40 }}>
            一站式数据导入、清洗、分析与可视化工具
          </Text>

          {/* Feature cards */}
          <Row gutter={20} style={{ marginBottom: 40, textAlign: 'left' }}>
            {[
              { icon: <ImportOutlined style={{ fontSize: 22 }} />, title: '数据导入', desc: '支持 CSV / Excel / JSON', color: '#5B7F95', path: '/import' },
              { icon: <ClearOutlined style={{ fontSize: 22 }} />, title: '数据清洗', desc: '缺失值、异常值、列操作', color: '#C9A96E', path: '/cleaning' },
              { icon: <ExperimentOutlined style={{ fontSize: 22 }} />, title: '统计分析', desc: '12 种分析方法', color: '#7BA587', path: '/analysis' },
              { icon: <BarChartOutlined style={{ fontSize: 22 }} />, title: '图表可视化', desc: '12 种图表，可导出', color: '#8B7BA5', path: '/charts' },
            ].map((feat) => (
              <Col span={6} key={feat.path}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate(feat.path)}
                  className="glass-card"
                  style={{ cursor: 'pointer', height: '100%', border: '1px solid rgba(255,255,255,0.8)' }}
                  bodyStyle={{ padding: '20px 16px' }}
                >
                  <div style={{ color: feat.color, marginBottom: 10 }}>{feat.icon}</div>
                  <Text strong style={{ fontSize: 14 }}>{feat.title}</Text><br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{feat.desc}</Text>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Quick start */}
          <div style={{ maxWidth: 520, margin: '0 auto 36px', textAlign: 'left' }}>
            <div className="glass-card" style={{ padding: '24px 28px', background: 'rgba(255,255,255,0.4)' }}>
              <Text strong style={{ display: 'block', marginBottom: 16, fontSize: 15 }}>
                🚀 快速开始
              </Text>
              <Steps
                direction="vertical"
                size="small"
                current={-1}
                items={[
                  { title: '导入数据', description: '拖拽或选择 CSV / Excel / JSON 文件', icon: <ImportOutlined /> },
                  { title: '清洗数据', description: '处理缺失值和异常值，确保数据质量', icon: <ClearOutlined /> },
                  { title: '分析数据', description: '选择合适的统计分析方法运行分析', icon: <ExperimentOutlined /> },
                  { title: '导出结果', description: '保存图表、导出数据或查看历史', icon: <HistoryOutlined /> },
                ]}
              />
            </div>
          </div>

          <Button type="primary" size="large" icon={<ImportOutlined />} onClick={() => navigate('/import')}>
            导入实验数据
          </Button>
        </div>
      ) : (
        <>
          {/* Status cards */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Card size="small" className="glass-card" bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title="样本量" value={currentDataset.rowCount} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="glass-card" bodyStyle={{ padding: '16px 20px' }}>
                <Statistic
                  title="变量数"
                  value={currentDataset.colCount}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {currentDataset.columns.filter((c) => c.type === 'numeric').length} 数值
                    </Text>
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="glass-card" bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title="数据集" value={currentDataset.name} valueStyle={{ fontSize: 15 }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="glass-card" bodyStyle={{ padding: '16px 20px' }}>
                <Statistic
                  title="导入时间"
                  value={new Date(currentDataset.importedAt).toLocaleDateString('zh-CN')}
                  valueStyle={{ fontSize: 15 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Quick actions */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Button block icon={<ImportOutlined />} onClick={() => navigate('/import')} style={{ height: 40 }}>
                导入数据
              </Button>
            </Col>
            <Col span={8}>
              <Button block icon={<ExperimentOutlined />} onClick={() => navigate('/analysis')} style={{ height: 40 }}>
                描述统计
              </Button>
            </Col>
            <Col span={8}>
              <Button block icon={<BarChartOutlined />} onClick={() => navigate('/charts')} style={{ height: 40 }}>
                新建图表
              </Button>
            </Col>
          </Row>

          {/* Preview table */}
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 14 }}>数据预览</Text>
            <DataTable dataset={currentDataset} maxRows={10} />
          </div>

          {/* Recent activity */}
          <Row gutter={16}>
            <Col span={12}>
              <Card
                size="small"
                className="glass-card"
                title={<Text strong style={{ fontSize: 14 }}>最近分析</Text>}
                extra={
                  <Button type="link" size="small" onClick={() => navigate('/history')}>
                    全部 →
                  </Button>
                }
                bodyStyle={{ padding: '12px 16px' }}
              >
                {latestRecord ? (
                  <div>
                    <Text strong style={{ fontSize: 13 }}>
                      {latestRecord.result.tables[0]?.title ?? '分析'}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {latestRecord.result.conclusion.slice(0, 60)}
                    </Text>
                    <br />
                    <Text style={{ fontSize: 11, color: '#b0b0b0' }}>
                      {new Date(latestRecord.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>暂无分析记录</Text>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                className="glass-card"
                title={<Text strong style={{ fontSize: 14 }}>最近图表</Text>}
                extra={
                  <Button type="link" size="small" onClick={() => navigate('/charts')}>
                    全部 →
                  </Button>
                }
                bodyStyle={{ padding: '12px 16px' }}
              >
                {latestChart ? (
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{latestChart.title}</Text>
                    <br />
                    <Text style={{ fontSize: 11, color: '#b0b0b0' }}>
                      {new Date(latestChart.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>暂无图表</Text>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
