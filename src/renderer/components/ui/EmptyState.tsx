import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon: Icon, eyebrow, title, description, action, compact }: EmptyStateProps) {
  return (
    <section className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      <div className="empty-state__icon"><Icon size={22} strokeWidth={1.8} /></div>
      <div className="empty-state__copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="empty-state__action">{action}</div>}
    </section>
  );
}

