import { AlertTriangle, RotateCcw } from 'lucide-react';
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  override componentDidCatch(error: unknown) {
    console.error('Quorix ErrorBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
          <div className="max-w-md w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2.5 text-[var(--error)]">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-semibold">
                {this.props.fallbackTitle || 'Something went wrong in this workspace'}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-2.5 break-words">
              {this.state.errorMessage || 'Unexpected rendering error'}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-text)] text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              <RotateCcw size={13} />
              Recover View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
