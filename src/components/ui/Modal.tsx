import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Dialog width. 'xl' is for wide content like the auction brochure. */
  size?: 'md' | 'xl';
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'md:max-w-2xl',
  xl: 'md:max-w-5xl xl:max-w-6xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps): ReactNode {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`card flex max-h-[97dvh] min-h-0 w-full flex-col overflow-hidden rounded-t-3xl shadow-pop md:max-h-[90vh] md:rounded-2xl dark:bg-slate-900 ${SIZE_CLASSES[size]}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Grab handle — mobile bottom-sheet affordance */}
        <div className="shrink-0 pt-2 md:hidden" aria-hidden="true">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-3 sm:px-6 md:pt-5">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold break-words text-slate-900 sm:text-xl dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            ✕
          </button>
        </div>
        {/* Single scroll container for all modal content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
