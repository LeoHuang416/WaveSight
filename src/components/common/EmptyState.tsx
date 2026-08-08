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
    <Empty description={description} style={{ padding: 80 }}>
      {actionText && actionPath && <Button type="primary" onClick={() => navigate(actionPath)}>{actionText}</Button>}
    </Empty>
  );
}
