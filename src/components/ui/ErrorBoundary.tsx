import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Changing the key remounts the boundary and clears the error state. */
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render crashes so one broken screen never blanks the whole app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen crashed:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="card card-pad space-y-3 text-center" role="alert">
          <p className="text-4xl">😵</p>
          <p className="font-black text-slate-800 dark:text-slate-100">
            حصل خطأ في عرض الشاشة دي
          </p>
          <p className="break-words text-xs text-slate-500 dark:text-slate-400" dir="ltr">
            {this.state.error.message}
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={this.reset} className="btn-primary">
              إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-ghost"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
