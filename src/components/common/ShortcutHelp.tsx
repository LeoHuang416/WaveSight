import { Modal, Table, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Text } = Typography;

const SHORTCUTS: { combo: string; desc: ReactNode }[] = [
  { combo: 'Alt + 1 ~ 7', desc: '切换模块（总览 / 导入 / 清洗 / 分析 / 图表 / 历史 / 设置）' },
  { combo: 'Ctrl + Enter', desc: '运行当前分析（分析页）' },
  { combo: 'Ctrl + S', desc: '导出当前图表 PNG（图表编辑器）' },
  { combo: 'Ctrl + E', desc: '导出当前图表 Excel（图表编辑器）' },
  { combo: '?', desc: '显示本快捷键帮助面板' },
];

export default function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="键盘快捷键" width={520}>
      <Table
        size="small"
        rowKey="combo"
        pagination={false}
        dataSource={SHORTCUTS}
        columns={[
          { title: '快捷键', dataIndex: 'combo', width: 160, render: (v: string) => <Text code>{v}</Text> },
          { title: '功能', dataIndex: 'desc' },
        ]}
      />
    </Modal>
  );
}