import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Button, Upload, Radio, InputNumber, Switch, Table, Tag, message, Space, Typography, Descriptions, Progress, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { parseFile, loadFullFile, validateFileSize, type ImportProgress } from '@/utils/fileParser';
import { useDataOperations } from '@/hooks/useDataOperations';
import type { ImportPreview, ColumnType, ColumnMeta } from '@/types/data';

const { Dragger } = Upload;
const { Title, Text } = Typography;

export default function ImportPage() {
  const navigate = useNavigate();
  const { importDataset } = useDataOperations();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [delimiter, setDelimiter] = useState(',');
  const [columnTypes, setColumnTypes] = useState<{ name: string; type: ColumnType }[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f); setLoading(true); setSizeWarning(null);
    try {
      const sizeResult = validateFileSize(f);
      if (!sizeResult.valid) { message.error(sizeResult.message); setLoading(false); return; }
      if (sizeResult.message) setSizeWarning(sizeResult.message);

      const p = await parseFile(f); setPreview(p);
      if (p.delimiter === '\t') setDelimiter('tsv');
      else if (p.delimiter === ';') setDelimiter('semicolon');
      setColumnTypes(p.columns.map((c) => ({ name: c.name, type: c.type })));
      setStep(1);
    } catch (err) { message.error(`文件解析失败: ${err}`); }
    finally { setLoading(false); }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!file) return; setLoading(true); setImportProgress(null);
    try {
      const delimMap: Record<string, string> = { ',': ',', 'tsv': '\t', 'semicolon': ';' };
      const result = await loadFullFile(file, { hasHeader, skipRows, delimiter: delimMap[delimiter] ?? ',' }, setImportProgress);
      const columns: ColumnMeta[] = result.columns.map((c, i) => {
        const userType = columnTypes.find((ct) => ct.name === c.name);
        return { name: c.name, type: userType?.type ?? c.type, index: i };
      });
      await importDataset({ name: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, columns, rows: result.rows });
      message.success(`成功导入 ${result.rows.length} 行数据`);
      navigate('/');
    } catch (err) { message.error(`导入失败: ${err}`); }
    finally { setLoading(false); setImportProgress(null); }
  }, [file, hasHeader, skipRows, delimiter, columnTypes, importDataset, navigate]);

  const toggleColumnType = (colName: string) => {
    setColumnTypes((prev) => prev.map((c) =>
      c.name === colName ? { ...c, type: c.type === 'numeric' ? 'categorical' : 'numeric' } : c));
  };

  const previewColumns: ColumnsType<Record<string, unknown>> = preview?.columns.map((col, i) => ({
    title: (
      <span onClick={() => toggleColumnType(col.name)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {col.name}
        <Tag color={columnTypes[i]?.type === 'numeric' ? 'blue' : 'orange'} style={{ marginLeft: 4 }}>
          {columnTypes[i]?.type === 'numeric' ? '🔢' : '🔤'}
        </Tag>
      </span>
    ),
    dataIndex: col.name, key: col.name, ellipsis: true,
    render: (val: unknown) => {
      if (val === null || val === undefined || val === '')
        return <span style={{ color: '#ff4d4f', background: '#fff1f0', padding: '0 4px' }}>—</span>;
      return String(val);
    },
  })) ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={4}>数据导入</Title>
      <Steps current={step} items={[
        { title: '选择文件' }, { title: '预览与清洗' }, { title: '确认导入' },
      ]} style={{ marginBottom: 24 }} />

      {sizeWarning && <Alert type="warning" message={sizeWarning} showIcon style={{ marginBottom: 16 }} closable onClose={() => setSizeWarning(null)} />}

      {importProgress && (
        <div style={{ marginBottom: 16 }}>
          <Progress percent={importProgress.total > 0 ? Math.round((importProgress.loaded / importProgress.total) * 100) : 0}
            status="active" format={() => {
              const labels = { reading: '读取中...', parsing: '解析中...', saving: '保存中...' };
              return labels[importProgress.phase];
            }} />
        </div>
      )}
      {step === 0 && (
        <Dragger accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.json" showUploadList={false}
          beforeUpload={(f) => { handleFile(f as File); return false; }} disabled={loading}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">拖拽文件到此处，或点击选择</p>
          <p className="ant-upload-hint">支持 CSV, TSV, Excel (.xlsx/.xls), JSON, TXT</p>
        </Dragger>
      )}
      {step === 1 && preview && (<>
        <Space style={{ marginBottom: 16 }} wrap>
          <span>第一行作为列名:</span><Switch checked={hasHeader} onChange={setHasHeader} />
          <span>跳过前</span><InputNumber min={0} max={50} value={skipRows} onChange={(v) => setSkipRows(v ?? 0)} /><span>行</span>
          <span>分隔符:</span>
          <Radio.Group value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
            <Radio.Button value=",">逗号</Radio.Button>
            <Radio.Button value="tsv">制表符</Radio.Button>
            <Radio.Button value="semicolon">分号</Radio.Button>
          </Radio.Group>
          <Text type="secondary">编码: {preview.encoding}</Text>
        </Space>
        <Table columns={previewColumns}
          dataSource={preview.rows.map((row, i) => ({ ...row, _key: i }))}
          rowKey="_key" scroll={{ x: 'max-content', y: 400 }} size="small" bordered pagination={false}
          style={{ marginBottom: 16 }} />
        <Text type="secondary">
          预览前 {preview.rows.length} 行 · 共 {preview.totalRows} 行 · {preview.columns.length} 列
          （点击列头可切换 🔢数值 / 🔤分类 类型）
        </Text>
        <div style={{ marginTop: 16 }}><Space>
          <Button onClick={() => { setStep(0); setFile(null); setPreview(null); }}>← 重新选择</Button>
          <Button type="primary" onClick={() => setStep(2)}>下一步 →</Button>
        </Space></div>
      </>)}
      {step === 2 && preview && (<>
        <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="文件名">{file?.name}</Descriptions.Item>
          <Descriptions.Item label="编码">{preview.encoding}</Descriptions.Item>
          <Descriptions.Item label="列数">{columnTypes.length}（{columnTypes.filter((c) => c.type === 'numeric').length} 数值, {columnTypes.filter((c) => c.type === 'categorical').length} 分类）</Descriptions.Item>
          <Descriptions.Item label="行数">{preview.totalRows}</Descriptions.Item>
          <Descriptions.Item label="第一行为列名">{hasHeader ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="跳过行数">{skipRows}</Descriptions.Item>
        </Descriptions>
        <Space>
          <Button onClick={() => setStep(1)}>← 返回修改</Button>
          <Button type="primary" loading={loading} onClick={handleConfirm}>确认导入</Button>
        </Space>
      </>)}
    </div>
  );
}
