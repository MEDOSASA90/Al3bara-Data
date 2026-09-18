import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../../components/ui/Modal';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  run: () => Promise<string>;
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; text: string };

/** Generic AI result dialog: runs on open, with loading / error / retry. */
export function AnalysisModal({ isOpen, onClose, title, run }: AnalysisModalProps): ReactNode {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ status: 'loading' });
    runRef
      .current()
      .then((text) => {
        if (!cancelled) setState({ status: 'ready', text });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : 'تعذر التحليل' });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, attempt]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div dir="rtl" className="min-h-[120px] text-right">
        {state.status === 'loading' ? (
          <div className="space-y-2">
            <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <p className="pt-2 text-xs text-slate-400">✨ الذكاء الاصطناعي يحلّل البيانات...</p>
          </div>
        ) : state.status === 'error' ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
              {state.message}
            </p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-primary w-full">
              🔄 إعادة المحاولة
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{state.text}</p>
        )}
      </div>
    </Modal>
  );
}
