import { Circle, LoaderCircle } from 'lucide-react';
import type { OllamaStatus } from '../../../shared/contracts/api';

type StatusPillProps = {
  status: OllamaStatus | null;
  loading?: boolean;
  compact?: boolean;
};

export function StatusPill({ status, loading, compact }: StatusPillProps) {
  const state = loading ? 'checking' : (status?.state ?? 'unavailable');
  const label =
    state === 'checking'
      ? 'Checking Ollama'
      : state === 'ready'
        ? `${status?.models.length ?? 0} model${status?.models.length === 1 ? '' : 's'} ready`
        : state === 'no-models'
          ? 'Model needed'
          : 'Ollama offline';

  return (
    <span className={`status-pill status-pill--${state}${compact ? ' status-pill--compact' : ''}`}>
      {loading ? <LoaderCircle className="spin" size={14} /> : <Circle size={9} fill="currentColor" />}
      {label}
    </span>
  );
}

