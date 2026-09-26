import { Map } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Map}
      eyebrow="Page not found"
      title="This part of the workspace does not exist."
      description="Return to the dashboard to continue preparing."
      action={<Link className="button button--primary" to="/">Back to dashboard</Link>}
    />
  );
}

