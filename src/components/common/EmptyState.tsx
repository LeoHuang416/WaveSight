import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  actionPath?: string;
}

export default function EmptyState({ description, actionText, actionPath }: EmptyStateProps) {
  const navigate = useNavigate();
  return (
    <div className="glass-card-static p-12 text-center animate-fade-in">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-light)]">
        <span className="text-2xl">🧪</span>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      {actionText && actionPath && (
        <button className="btn-primary mt-5" onClick={() => navigate(actionPath)}>
          {actionText} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
