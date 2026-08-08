import { Tag } from 'antd';
import type { ColumnType } from '@/types/data';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

export default function ColumnBadge({ type }: { type: ColumnType }) {
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;
  const isKimi = uiTheme === 'kimi-minimal';

  return (
    <Tag
      style={{
        borderRadius: isKimi ? 4 : 8,
        border: isKimi ? `1px solid ${colors.border}` : 'none',
        background: isKimi ? 'transparent' : (
          type === 'numeric' ? 'rgba(91,127,149,0.08)' : 'rgba(201,169,110,0.1)'
        ),
        color: isKimi ? (type === 'numeric' ? colors.accent : colors.textSecondary) : (
          type === 'numeric' ? '#5B7F95' : '#C9A96E'
        ),
        fontSize: 11,
        padding: '0 8px',
        lineHeight: '20px',
      }}
    >
      {type === 'numeric' ? '数值' : '分类'}
    </Tag>
  );
}
