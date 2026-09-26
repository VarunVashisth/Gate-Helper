import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="async-state"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="async-state async-state--error" role="alert">
      <AlertCircle size={22} />
      <span>{message}</span>
      {retry && <button className="button button--secondary" onClick={retry}><RefreshCw size={14} /> Retry</button>}
    </div>
  );
}

