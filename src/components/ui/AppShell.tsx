import type { ReactNode } from 'react';
import type { ViewMode } from '../../domain/types';

export type ShellView = ViewMode;

interface NavItem {
  id: ViewMode;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'entities', label: 'الجهات', icon: '🏭' },
  { id: 'advances', label: 'السلف', icon: '💰' },
  { id: 'work', label: 'الشغل', icon: '🧾' },
  { id: 'partnerships', label: 'الشركاء', icon: '🤝' },
  { id: 'archiveMenu', label: 'الأرشيف', icon: '🗂️' },
];

const ARCHIVE_VIEWS: ViewMode[] = ['archiveMenu', 'archiveEntities', 'archiveWork', 'archiveAdvances'];

function activeId(view: ViewMode): ViewMode {
  return ARCHIVE_VIEWS.includes(view) ? 'archiveMenu' : view;
}

export interface AppShellProps {
  view: ViewMode;
  onNavigate: (view: ViewMode) => void;
  title: string;
  userEmail: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onHome: () => void;
  aiSlot?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  view,
  onNavigate,
  title,
  userEmail,
  theme,
  onToggleTheme,
  onLogout,
  onHome,
  aiSlot,
  children,
}: AppShellProps): ReactNode {
  const current = activeId(view);
  return (
    <div className="min-h-screen overflow-x-clip bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-60 flex-col border-l border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:flex">
        <button type="button" onClick={onHome} className="flex items-center gap-2 px-5 pb-4 pt-5 text-right">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xl text-white shadow-soft">
            ع
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
              العبارة للتجارة والتوريدات
            </span>
            {userEmail ? (
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</span>
            ) : null}
          </span>
        </button>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'flex w-full items-center gap-3 rounded-xl bg-brand-600 px-4 py-2.5 font-bold text-white shadow-soft'
                    : 'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-200/70 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-debit-50 px-4 py-2.5 font-bold text-debit-700 transition hover:bg-debit-100 dark:bg-debit-600/15 dark:text-rose-300 dark:hover:bg-debit-600/25"
          >
            🚪 خروج
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="md:pr-60">
        {/* Slim top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={onHome}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base text-white shadow-soft md:hidden"
                aria-label="الصفحة الرئيسية"
              >
                ع
              </button>
              <h1 className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-white">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {aiSlot}
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="تبديل المظهر"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-4 px-4 pb-24 pt-4 md:pb-10 md:pt-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="التنقل الرئيسي"
      >
        <div className="grid grid-cols-6 gap-1 px-2 pb-1.5 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5"
              >
                <span
                  className={
                    isActive
                      ? 'flex h-7 items-center justify-center rounded-full bg-brand-600/15 px-5 text-lg dark:bg-brand-600/25'
                      : 'text-lg text-slate-500 dark:text-slate-400'
                  }
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span
                  className={
                    isActive
                      ? 'text-[11px] font-black text-brand-700 dark:text-brand-200'
                      : 'text-[11px] font-bold text-slate-500 dark:text-slate-400'
                  }
                >
                  {item.label}
                </span>
                {isActive ? (
                  <span className="absolute top-0.5 h-1 w-8 rounded-full bg-brand-600" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
