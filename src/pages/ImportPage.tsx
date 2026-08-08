import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Steps, Button, Upload, Radio, InputNumber, Switch, Table, Tag, message, Space, Typography, Descriptions, Progress, Alert, Input, Popconfirm } from 'antd';
import { InboxOutlined, DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
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

  // Cell selection for copy/cut — use refs to avoid stale closure
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: string } | null>(null);
  const selectedCellRef = useRef(selectedCell);
  selectedCellRef.current = selectedCell;

  // Undo stack
  const [undoStack, setUndoStack] = useState<Record<string, unknown>[][]>([]);

  const pushUndo = useCallback(() => {
    setEditableRows((prev) => {
      setUndoStack((stack) => [...stack, prev]);
      return prev;
    });
  }, []);

  const colNames = useMemo(() => preview?.columns.map((c) => c.name) ?? [], [preview]);

  /** Get normalized range from selection */
  const getSelectedRange = useCallback(() => {
    const sel = selectedCellRef.current;
    if (!sel || !preview) return null;
    const end = selectionEnd ?? sel;
    const allCols = colNames;
    const c1 = allCols.indexOf(sel.col);
    const c2 = allCols.indexOf(end.col);
    if (c1 === -1 || c2 === -1) return null;
    const minRow = Math.min(sel.row, end.row);
    const maxRow = Math.max(sel.row, end.row);
    const minCol = Math.min(c1, c2);
    const maxCol = Math.max(c1, c2);
    return { minRow, maxRow, minCol, maxCol, cols: allCols.slice(minCol, maxCol + 1) };
  }, [selectionEnd, preview, colNames]);

  /** Check if a cell is in the selected range */
  const isCellSelected = useCallback((row: number, col: string) => {
    const sel = selectedCellRef.current;
    if (!sel) return false;
    const end = selectionEnd ?? sel;
    const allCols = colNames;
    const c1 = allCols.indexOf(sel.col);
    const c2 = allCols.indexOf(end.col);
    if (c1 === -1 || c2 === -1) return row === sel.row && col === sel.col;
    const minRow = Math.min(sel.row, end.row);
    const maxRow = Math.max(sel.row, end.row);
    const minCol = Math.min(c1, c2);
    const maxCol = Math.max(c1, c2);
    const ci = allCols.indexOf(col);
    return row >= minRow && row <= maxRow && ci >= minCol && ci <= maxCol;
  }, [selectionEnd, colNames]);

  const handleCellClick = useCallback((row: number, col: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && selectedCellRef.current) {
      setSelectionEnd({ row, col });
    } else {
      setSelectedCell({ row, col });
      setSelectionEnd(null);
    }
  }, []);

  const handleCellDblClick = useCallback((row: number, col: string, currentVal: unknown) => {
    setEditingCell({ row, col });
    setEditValue(currentVal === null || currentVal === undefined || currentVal === '' ? '' : String(currentVal));
  }, []);

  // Ctrl+C: copy selected range to clipboard
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    const sel = selectedCellRef.current;
    if (!sel) return;
    const end = selectionEnd ?? sel;
    const allCols = colNames;
    const c1 = allCols.indexOf(sel.col);
    const c2 = allCols.indexOf(end.col);
    if (c1 === -1 || c2 === -1) return;
    const minRow = Math.min(sel.row, end.row);
    const maxRow = Math.max(sel.row, end.row);
    const minCol = Math.min(c1, c2);
    const maxCol = Math.max(c1, c2);
    const rangeCols = allCols.slice(minCol, maxCol + 1);
    e.preventDefault();
    const rows = editableRows.slice(minRow, maxRow + 1);
    const tsv = rows.map((row) =>
      rangeCols.map((c) => {
        const v = row[c];
        return v === null || v === undefined || v === '' ? '' : String(v);
      }).join('\t')
    ).join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {});
    message.info(`已复制 ${maxRow - minRow + 1} 行 × ${rangeCols.length} 列`);
  }, [selectionEnd, colNames, editableRows]);

  // Ctrl+X: cut selected range
  const handleCut = useCallback((e: React.ClipboardEvent) => {
    const sel = selectedCellRef.current;
    if (!sel) return;
    const end = selectionEnd ?? sel;
    const allCols = colNames;
    const c1 = allCols.indexOf(sel.col);
    const c2 = allCols.indexOf(end.col);
    if (c1 === -1 || c2 === -1) return;
    const minRow = Math.min(sel.row, end.row);
    const maxRow = Math.max(sel.row, end.row);
    const minCol = Math.min(c1, c2);
    const maxCol = Math.max(c1, c2);
    const rangeCols = allCols.slice(minCol, maxCol + 1);
    e.preventDefault();
    const rows = editableRows.slice(minRow, maxRow + 1);
    const tsv = rows.map((row) =>
      rangeCols.map((c) => {
        const v = row[c];
        return v === null || v === undefined || v === '' ? '' : String(v);
      }).join('\t')
    ).join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {});
    pushUndo();
    setEditableRows((prev) => {
      const next = [...prev];
      for (let r = minRow; r <= maxRow && r < next.length; r++) {
        const rowData = { ...next[r] };
        for (const c of rangeCols) rowData[c] = null;
        next[r] = rowData;
      }
      return next;
    });
    message.info(`已剪切 ${maxRow - minRow + 1} 行 × ${rangeCols.length} 列`);
  }, [selectionEnd, colNames, editableRows, pushUndo]);

  // Ctrl+Z: undo
  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setEditableRows(prev);
      message.info('已撤销');
      return stack.slice(0, -1);
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); return; }
    if (e.ctrlKey && e.key === 'c') handleCopy(e as unknown as React.ClipboardEvent);
    if (e.ctrlKey && e.key === 'x') handleCut(e as unknown as React.ClipboardEvent);
  }, [handleCopy, handleCut, handleUndo]);

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
    pushUndo();
    setEditableRows((prev) => {
      const next = [...prev];
      next[row] = { ...next[row], [col]: editValue === '' ? null : editValue };
      return next;
    });
    setEditingCell(null);
  };

  // Multi-cell paste from Excel/CSV
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pasteText = e.clipboardData.getData('text');
    if (!pasteText) return;

    // Detect tab-separated multi-cell paste (Excel format)
    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return;

    const hasTabs = lines.some((l) => l.includes('\t'));
    if (!hasTabs && lines.length === 1) return; // single value → let native input handle it

    e.preventDefault();
    e.stopPropagation();

    // Determine starting cell
    const startRow = editingCell?.row ?? 0;
    const colNames = preview?.columns.map((c) => c.name) ?? [];
    const startColIdx = editingCell ? colNames.indexOf(editingCell.col) : 0;

    pushUndo();
    setEditableRows((prev) => {
      const next = [...prev];
      for (let r = 0; r < lines.length && startRow + r < next.length; r++) {
        const cells = lines[r].split('\t');
        const rowData = { ...next[startRow + r] };
        for (let c = 0; c < cells.length && startColIdx + c < colNames.length; c++) {
          rowData[colNames[startColIdx + c]] = cells[c].trim() || null;
        }
        next[startRow + r] = rowData;
      }
      return next;
    });

    setEditingCell(null);
    message.success(`已粘贴 ${lines.length} 行 × ${lines[0]?.split('\t').length ?? 0} 列`);
  }, [editingCell, preview]);

  const moveColumn = (colIdx: number, direction: -1 | 1) => {
    const newIdx = colIdx + direction;
    if (newIdx < 0 || !preview || newIdx >= preview.columns.length) return;
    const colNames = preview.columns.map((c) => c.name);

    // Reorder columnTypes
    setColumnTypes((prev) => {
      const next = [...prev];
      [next[colIdx], next[newIdx]] = [next[newIdx], next[colIdx]];
      return next;
    });

    // Reorder data in editableRows
    setEditableRows((prev) => prev.map((row) => {
      const newRow = { ...row };
      const leftCol = colNames[colIdx];
      const rightCol = colNames[newIdx];
      const tmp = newRow[leftCol];
      newRow[leftCol] = newRow[rightCol];
      newRow[rightCol] = tmp;
      return newRow;
    }));

    // Reorder columns in preview metadata
    setPreview((prev) => {
      if (!prev) return prev;
      const nextCols = [...prev.columns];
      [nextCols[colIdx], nextCols[newIdx]] = [nextCols[newIdx], nextCols[colIdx]];
      return { ...prev, columns: nextCols };
    });
  };

  const deleteRow = (rowIdx: number) => {
    pushUndo();
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
            <span style={{ cursor: 'pointer', userSelect: 'none', fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button type="text" size="small" style={{ fontSize: 10, padding: 0, minWidth: 14, height: 18 }}
                disabled={i === 0} onClick={() => moveColumn(i, -1)}><LeftOutlined /></Button>
              <span onClick={() => toggleColumnType(col.name)}>{col.name}</span>
              <Tag color={ct?.type === 'numeric' ? 'blue' : 'orange'} style={{ marginLeft: 2, fontSize: 10, cursor: 'pointer' }}
                onClick={() => toggleColumnType(col.name)}>
                {ct?.type === 'numeric' ? '#' : 'Aa'}
              </Tag>
              <Tag color={role.color} style={{ marginLeft: 2, fontSize: 10, cursor: 'pointer' }}
                onClick={() => toggleColumnRole(col.name)}>
                {role.label}
              </Tag>
              <Button type="text" size="small" style={{ fontSize: 10, padding: 0, minWidth: 14, height: 18 }}
                disabled={i === preview.columns.length - 1} onClick={() => moveColumn(i, 1)}><RightOutlined /></Button>
            </span>
          ),
          dataIndex: col.name, key: col.name, width: 150,
          render: (val: unknown, _record: Record<string, unknown>, idx: number) => {
            const isEditing = editingCell?.row === idx && editingCell?.col === col.name;
            const isDeleted = deletedRows.has(idx);
            const isSelected = isCellSelected(idx, col.name);
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
                onClick={(e) => handleCellClick(idx, col.name, e)}
                onDoubleClick={() => handleCellDblClick(idx, col.name, val)}
                style={{
                  cursor: 'cell',
                  color: isMissing ? '#c47878' : undefined,
                  background: isSelected ? 'rgba(37,99,235,0.15)' : (isMissing ? '#fff1f0' : undefined),
                  outline: isSelected ? '1px solid rgba(37,99,235,0.4)' : undefined,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 13,
                  display: 'inline-block',
                  minWidth: 30,
                  userSelect: 'none',
                }}
                title="单击选择 · 双击编辑 · Ctrl+C/X 复制剪切"
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
            <div onPaste={handlePaste} onKeyDown={handleKeyDown} tabIndex={0} style={{ outline: 'none' }}>
              <Table
                columns={previewColumns}
                dataSource={editableRows.map((row, i) => ({ ...row, _key: i }))}
                rowKey="_key" scroll={{ x: 'max-content', y: 400 }} size="small"
                pagination={false} style={{ marginBottom: 4 }}
              />
            </div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
              单击选择 · 双击编辑 · Shift+点击扩选 · Ctrl+C 复制 · Ctrl+X 剪切 · Ctrl+V 粘贴 · Ctrl+Z 撤销 · 列头 ← → 调整列序
            </Text>
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
