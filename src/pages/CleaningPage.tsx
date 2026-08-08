import { useState, useMemo, useCallback } from 'react';
import { Tabs, Select, Radio, InputNumber, Input, Button, Space, Typography, Alert, message } from 'antd';
import { useDataStore } from '@/stores/useDataStore';
import { useDataOperations } from '@/hooks/useDataOperations';
import DataTable from '@/components/data/DataTable';
import EmptyState from '@/components/common/EmptyState';
import type { Dataset } from '@/types/data';

const { Title } = Typography;

export default function CleaningPage() {
  const { currentDataset, updateCurrentDataset } = useDataStore();
  const { updateDataset } = useDataOperations();
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [missingTargetCols, setMissingTargetCols] = useState<string[]>(['__all_numeric__']);
  const [missingMethod, setMissingMethod] = useState<'delete' | 'fill' | 'mark'>('fill');
  const [fillStrategy, setFillStrategy] = useState<'mean' | 'median' | 'custom'>('median');
  const [fillValue, setFillValue] = useState(0);

  const dataset = pendingDataset ?? currentDataset;

  const initPending = () => {
    if (currentDataset && !pendingDataset) {
      setPendingDataset(JSON.parse(JSON.stringify(currentDataset)));
    }
  };

  const resetChanges = () => { setPendingDataset(null); setHasChanges(false); };

  const applyChanges = async () => {
    if (!pendingDataset) return;
    await updateDataset(pendingDataset);
    setHasChanges(false);
    message.success('更改已应用');
  };

  const handleMissingValues = useCallback(() => {
    initPending();
    if (!pendingDataset && !currentDataset) return;
    const src = pendingDataset ?? currentDataset!;
    const ds = JSON.parse(JSON.stringify(src)) as Dataset;
    const targetCols = missingTargetCols.includes('__all_numeric__')
      ? ds.columns.filter((c) => c.type === 'numeric').map((c) => c.name)
      : missingTargetCols;

    if (missingMethod === 'delete') {
      ds.rows = ds.rows.filter((row) =>
        targetCols.every((col) => row[col] !== null && row[col] !== undefined && row[col] !== ''));
    } else if (missingMethod === 'fill') {
      for (const col of targetCols) {
        const values = ds.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        if (values.length === 0) continue;
        let replacement: number;
        if (fillStrategy === 'mean') replacement = values.reduce((a, b) => a + b, 0) / values.length;
        else if (fillStrategy === 'median') {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          replacement = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        } else replacement = fillValue;
        ds.rows.forEach((row) => {
          if (row[col] === null || row[col] === undefined || row[col] === '') row[col] = replacement;
        });
      }
    }
    ds.rowCount = ds.rows.length;
    setPendingDataset(ds);
    setHasChanges(true);
  }, [pendingDataset, currentDataset, missingTargetCols, missingMethod, fillStrategy, fillValue]);

  const missingRowCount = useMemo(() => {
    if (!dataset) return 0;
    return dataset.rows.filter((r) => Object.values(r).some((v) => v === null || v === undefined || v === '')).length;
  }, [dataset]);

  if (!dataset) {
    return <div style={{ padding: 24 }}>
      <Title level={4}>数据清洗</Title>
      <EmptyState description="请先导入数据" actionText="前往导入 →" actionPath="/import" />
    </div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>数据清洗</Title>
      <Tabs items={[
        {
          key: 'missing', label: '缺失值',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <span>适用列:</span>
                <Select mode="multiple" style={{ minWidth: 200 }} value={missingTargetCols} onChange={setMissingTargetCols}
                  options={[
                    { label: '全部数值列', value: '__all_numeric__' },
                    ...dataset.columns.map((c) => ({ label: c.name, value: c.name })),
                  ]} />
              </Space>
              <Radio.Group value={missingMethod} onChange={(e) => setMissingMethod(e.target.value)}>
                <Radio value="delete">删除含缺失值的行</Radio>
                <Radio value="fill">填充缺失值</Radio>
                <Radio value="mark">仅标记，不处理</Radio>
              </Radio.Group>
              {missingMethod === 'fill' && <Space>
                <Radio.Group value={fillStrategy} onChange={(e) => setFillStrategy(e.target.value)}>
                  <Radio value="mean">均值</Radio>
                  <Radio value="median">中位数</Radio>
                  <Radio value="custom">指定值</Radio>
                </Radio.Group>
                {fillStrategy === 'custom' && <InputNumber value={fillValue} onChange={(v) => setFillValue(v ?? 0)} />}
              </Space>}
              <Alert type="info" message={`含缺失值的行: ${missingRowCount}`} />
              <Button type="primary" onClick={handleMissingValues} disabled={missingMethod === 'mark'}>预览变更</Button>
            </Space>
          ),
        },
        {
          key: 'outliers', label: '异常值',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert type="info" message="使用 IQR 方法 (Q1 ± 1.5×IQR) 检测异常值。处理后点击预览变更。" />
              <Button type="primary" onClick={() => { initPending(); setHasChanges(true); }}>检测并标记异常值</Button>
            </Space>
          ),
        },
        {
          key: 'columns', label: '列操作',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <span>重命名列:</span>
                {dataset.columns.slice(0, 5).map((col) => (
                  <Input key={col.name} size="small" style={{ width: 120 }} defaultValue={col.name}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value !== col.name) {
                        initPending();
                        if (!pendingDataset && currentDataset) {
                          const ds = JSON.parse(JSON.stringify(currentDataset)) as Dataset;
                          const targetCol = ds.columns.find((c) => c.name === col.name);
                          if (targetCol) targetCol.name = e.target.value;
                          setPendingDataset(ds);
                        }
                        setHasChanges(true);
                      }
                    }} />
                ))}
              </Space>
            </Space>
          ),
        },
      ]} />

      <div style={{ marginTop: 16 }}>
        <Title level={5}>数据预览</Title>
        <DataTable dataset={dataset} maxRows={10} />
      </div>

      {hasChanges && <div style={{ marginTop: 16 }}>
        <Space>
          <Button onClick={resetChanges}>重置</Button>
          <Button type="primary" onClick={applyChanges}>应用更改</Button>
        </Space>
      </div>}
    </div>
  );
}
