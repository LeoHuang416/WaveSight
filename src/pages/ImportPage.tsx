import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Button, Upload, Radio, InputNumber, Switch, Table, Tag, message, Space, Typography, Descriptions, Progress, Alert, Input, Popconfirm } from 'antd';
import { InboxOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { parseFile, loadFullFile, validateFileSize, type ImportProgress } from '@/utils/fileParser';
import { useDataOperations } from '@/hooks/useDataOperations';
import type { ImportPreview, ColumnType, ColumnRole, ColumnMeta } from '@/types/data';

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
  const [columnTypes, setColumnTypes] = useState<{ name: string; type: ColumnType; role: ColumnRole }[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);

  // Inline editing state
  const [editableRows, setEditableRows] = useState<Record<string, unknown>[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletedRows, setDeletedRows] = useState<Set<number>>(new Set());

  const handleFile = useCallback(async (f: File) => {
    setFile(f); setLoading(true); setSizeWarning(null);
    try {
      const sizeResult = validateFileSize(f);
      if (!sizeResult.valid) { message.error(sizeResult.message); setLoading(false); return; }
      if (sizeResult.message) setSizeWarning(sizeResult.message);

      const p = await parseFile(f); setPreview(p);
      if (p.delimiter === '\t') setDelimiter('tsv');
      else if (p.delimiter === ';') setDelimiter('semicolon');
      setColumnTypes(p.columns.map((c) => ({ name: c.name, type: c.type, role: c.role ?? 'unknown' })));
      setEditableRows(p.rows.map((r) => ({ ...r })));
      setDeletedRows(new Set());
      setStep(1);
    } catch (err) { message.error(`文件解析失败: ${err}`); }
    finally { setLoading(false); }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!file) return; setLoading(true); setImportProgress(null);
    try {
      const delimMap: Record<string, string> = { ',': ',', 'tsv': '\t', 'semicolon': ';' };
      const result = await loadFullFile(file, { hasHeader, skipRows, delimiter: delimMap[delimiter] ?? ',' }, setImportProgress);

      // Apply preview edits to loaded rows (patch first N rows)
      const editedFullRows = result.rows.map((row, idx) => {
        if (idx < editableRows.length) {
          const edited = editableRows[idx];
          // Merge: keep original values for keys not in preview, override with edited
          return { ...row, ...edited };
        }
        return row;
      });

      // Remove deleted rows
      const deletedIndices = new Set(deletedRows);
      const finalRows = editedFullRows.filter((_, idx) => !deletedIndices.has(idx));

      const columns: ColumnMeta[] = result.columns.map((c, i) => {
        const userOverride = columnTypes.find((ct) => ct.name === c.name);
        return { name: c.name, type: userOverride?.type ?? c.type, role: userOverride?.role ?? c.role ?? 'unknown', index: i };
      });
      await importDataset({ name: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, columns, rows: finalRows, experimentGroupCol: result.experimentGroupCol });
      message.success(`成功导入 ${finalRows.length} 行数据`);
      navigate('/');
    } catch (err) { message.error(`导入失败: ${err}`); }
    finally { setLoading(false); setImportProgress(null); }
  }, [file, hasHeader, skipRows, delimiter, columnTypes, editableRows, deletedRows, importDataset, navigate]);

  const toggleColumnType = (colName: string) => {
    setColumnTypes((prev) => prev.map((c) =>
      c.name === colName ? { ...c, type: c.type === 'numeric' ? 'categorical' : 'numeric' } : c));
  };

  const toggleColumnRole = (colName: string) => {
    const order: ColumnRole[] = ['independent', 'dependent', 'metadata', 'unknown'];
    setColumnTypes((prev) => prev.map((c) =>
      c.name === colName ? { ...c, role: order[(order.indexOf(c.role) + 1) % order.length] } : c));
  };

  const startEdit = (rowIdx: number, colName: string, currentVal: unknown) => {
    setEditingCell({ row: rowIdx, col: colName });
    setEditValue(currentVal === null || currentVal === undefined || currentVal === '' ? '' : String(currentVal));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    setEditableRows((prev) => {
      const next = [...prev];
      next[row] = { ...next[row], [col]: editValue === '' ? null : editValue };
      return next;
    });
    setEditingCell(null);
  };

  const deleteRow = (rowIdx: number) => {
    setDeletedRows((prev) => new Set(prev).add(rowIdx));
  };

  const undoDeleteRow = (rowIdx: number) => {
    setDeletedRows((prev) => {
      const next = new Set(prev);
      next.delete(rowIdx);
      return next;
    });
  };

  const ROLE_LABELS: Record<ColumnRole, { label: string; color: string }> = {
    independent: { label: '自变量', color: 'green' },
    dependent: { label: '因变量', color: 'blue' },
    metadata: { label: '元数据', color: 'default' },
    unknown: { label: '未知', color: 'orange' },
  };

  const previewColumns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    if (!preview) return [];
    return [
      ...preview.columns.map((col, i) => {
        const ct = columnTypes[i];
        const role = ROLE_LABELS[ct?.role ?? col.role ?? 'unknown'];
        return {
          title: (
            <span style={{ cursor: 'pointer', userSelect: 'none', fontSize: 12 }}>
              <span onClick={() => toggleColumnType(col.name)}>{col.name}</span>
              <Tag color={ct?.type === 'numeric' ? 'blue' : 'orange'} style={{ marginLeft: 4, fontSize: 10, cursor: 'pointer' }}
                onClick={() => toggleColumnType(col.name)}>
                {ct?.type === 'numeric' ? '#' : 'Aa'}
              </Tag>
              <Tag color={role.color} style={{ marginLeft: 2, fontSize: 10, cursor: 'pointer' }}
                onClick={() => toggleColumnRole(col.name)}>
                {role.label}
              </Tag>
            </span>
          ),
          dataIndex: col.name, key: col.name, width: 150,
          render: (val: unknown, _record: Record<string, unknown>, idx: number) => {
            const isEditing = editingCell?.row === idx && editingCell?.col === col.name;
            const isDeleted = deletedRows.has(idx);
            if (isDeleted) {
              return (
                <span style={{ color: '#ccc', textDecoration: 'line-through', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => undoDeleteRow(idx)} title="点击恢复">
                  {val === null || val === undefined || val === '' ? '—' : String(val)}
                </span>
              );
            }
            if (isEditing) {
              return (
                <Input
                  size="small"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onPressEnter={commitEdit}
                  autoFocus
                  style={{ height: 28, fontSize: 13 }}
                />
              );
            }
            const display = val === null || val === undefined || val === '' ? '—' : String(val);
            const isMissing = val === null || val === undefined || val === '';
            return (
              <span
                onClick={() => startEdit(idx, col.name, val)}
                style={{
                  cursor: 'text',
                  color: isMissing ? '#c47878' : undefined,
                  background: isMissing ? '#fff1f0' : undefined,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 13,
                  display: 'inline-block',
                  minWidth: 30,
                }}
                title="点击编辑"
              >
                {display}
              </span>
            );
          },
        };
      }),
      // Action column: delete row
      {
        title: '',
        key: '_actions',
        width: 40,
        render: (_: unknown, _record: Record<string, unknown>, idx: number) => {
          if (deletedRows.has(idx)) {
            return <Button size="small" type="link" onClick={() => undoDeleteRow(idx)} style={{ fontSize: 11 }}>恢复</Button>;
          }
          return (
            <Popconfirm title="删除此行?" onConfirm={() => deleteRow(idx)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ fontSize: 12 }} />
            </Popconfirm>
          );
        },
      },
    ];
  }, [preview, columnTypes, editingCell, editValue, deletedRows]);

  return (
    <div style={{ padding: '4px 0 24px' }}>
      <Title level={4} style={{ fontWeight: 600, marginBottom: 20, color: '#333' }}>数据导入</Title>

      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 20, background: 'rgba(255,255,255,0.4)' }}>
        <Steps
          current={step}
          items={[{ title: '选择文件' }, { title: '预览与清洗' }, { title: '确认导入' }]}
          style={{ marginBottom: 24 }}
        />

        {sizeWarning && (
          <Alert type="warning" message={sizeWarning} showIcon style={{ marginBottom: 16 }} closable onClose={() => setSizeWarning(null)} />
        )}

        {preview?.experimentGroupCol && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message={`检测到平行实验分组列: "${preview.experimentGroupCol}"`}
            description="此列包含多个实验批次/运行编号，数据将按此列分组管理。"
          />
        )}
        {preview?.irrelevantColumns && preview.irrelevantColumns.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} closable
            message={`检测到 ${preview.irrelevantColumns.length} 个可能无关的列: ${preview.irrelevantColumns.join(', ')}`}
            description={'这些列为空值、常数或无信息量的标识列，已自动标记为「元数据」。可在预览中手动调整。'}
          />
        )}

        {importProgress && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={importProgress.total > 0 ? Math.round((importProgress.loaded / importProgress.total) * 100) : 0}
              status="active"
              format={() => {
                const labels: Record<string, string> = { reading: '读取中...', parsing: '解析中...', saving: '保存中...' };
                return labels[importProgress.phase] ?? '';
              }}
            />
          </div>
        )}

        {step === 0 && (
          <Dragger
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.json"
            showUploadList={false}
            beforeUpload={(f) => { handleFile(f as File); return false; }}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">拖拽文件到此处，或点击选择</p>
            <p className="ant-upload-hint">支持 CSV, TSV, Excel (.xlsx/.xls), JSON, TXT</p>
          </Dragger>
        )}

        {step === 1 && preview && (
          <>
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
            <Table
              columns={previewColumns}
              dataSource={editableRows.map((row, i) => ({ ...row, _key: i }))}
              rowKey="_key" scroll={{ x: 'max-content', y: 400 }} size="small"
              pagination={false} style={{ marginBottom: 12 }}
            />
            <Text type="secondary">
              预览前 {preview.rows.length} 行
              {deletedRows.size > 0 && <span style={{ color: '#c47878' }}>（已标记删除 {deletedRows.size} 行）</span>}
              {' · '}共 {preview.totalRows} 行 · {preview.columns.length} 列
            </Text>
            <div style={{ marginTop: 16 }}>
              <Space>
                <Button onClick={() => { setStep(0); setFile(null); setPreview(null); }}>← 重新选择</Button>
                <Button type="primary" onClick={() => setStep(2)}>下一步 →</Button>
              </Space>
            </div>
          </>
        )}

        {step === 2 && preview && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件名">{file?.name}</Descriptions.Item>
              <Descriptions.Item label="编码">{preview.encoding}</Descriptions.Item>
              <Descriptions.Item label="列数">
                {columnTypes.length}（{columnTypes.filter((c) => c.type === 'numeric').length} 数值, {columnTypes.filter((c) => c.type === 'categorical').length} 分类）
              </Descriptions.Item>
              <Descriptions.Item label="行数">{preview.totalRows}</Descriptions.Item>
              <Descriptions.Item label="第一行为列名">{hasHeader ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="跳过行数">{skipRows}</Descriptions.Item>
            </Descriptions>
            <Space>
              <Button onClick={() => setStep(1)}>← 返回修改</Button>
              <Button type="primary" loading={loading} onClick={handleConfirm}>确认导入</Button>
            </Space>
          </>
        )}
      </div>
    </div>
  );
}
