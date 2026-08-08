import { Empty, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  actionPath?: string;
}

export default function EmptyState({ description, actionText, actionPath }: EmptyStateProps) {
  const navigate = useNavigate();
  return (
    <div
      className="glass-card"
      style={{
        padding: 48,
        textAlign: 'center',
        background: 'rgba(255,255,255,0.4)',
      }}
    >
      <Empty
        description={
          <span style={{ color: '#888', fontSize: 14 }}>{description}</span>
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
