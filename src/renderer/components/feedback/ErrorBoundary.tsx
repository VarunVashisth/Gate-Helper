import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Renderer error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-state">
          <div className="fatal-state__icon"><AlertTriangle size={28} /></div>
          <p className="eyebrow">Something went wrong</p>
          <h1>The study workspace could not be displayed.</h1>
          <p>Your local data is safe. Restart the application to try again.</p>
          <button className="button button--primary" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

