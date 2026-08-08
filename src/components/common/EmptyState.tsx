import { Empty, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getTheme } from '@/themes';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  actionPath?: string;
}

export default function EmptyState({ description, actionText, actionPath }: EmptyStateProps) {
  const navigate = useNavigate();
  const uiTheme = useSettingsStore((s) => s.uiTheme);
  const appearanceMode = useSettingsStore((s) => s.appearanceMode);
  const t = getTheme(uiTheme);
  const colors = appearanceMode === 'dark' ? t.dark : t.light;
  const isKimi = uiTheme === 'kimi-minimal';

  return (
    <div
      className="glass-card"
      style={{
        padding: 48,
        textAlign: 'center',
        background: isKimi ? 'transparent' : 'rgba(255,255,255,0.4)',
        borderBottom: isKimi ? `1px solid ${colors.border}` : undefined,
      }}
    >
      <Empty
        description={
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>{description}</span>
        }
        style={{ margin: 0 }}
      >
        {actionText && actionPath && (
          <Button type="primary" onClick={() => navigate(actionPath)}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
}
