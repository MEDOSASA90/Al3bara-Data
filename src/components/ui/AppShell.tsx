import { useState, type ReactNode } from 'react';
import type { ViewMode } from '../../domain/types';
import { BrandMark } from './BrandLogo';

export type ShellView = ViewMode;

interface NavItem {
  id: ViewMode;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'entities', label: 'الجهات', icon: '🏭' },
  { id: 'brochures', label: 'الكراسات', icon: '📚' },
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
  /** Download a full Firestore backup JSON (drawer button). */
  onBackup?: () => void;
  /** Open the AI assistant (drawer 🤖 item). */
  onAiToggle: () => void;
  aiSlot?: ReactNode;
  /** Rendered in the top bar before the AI slot (notification bell). */
  notificationsSlot?: ReactNode;
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
  onBackup,
  onAiToggle,
  aiSlot,
  notificationsSlot,
  children,
}: AppShellProps) {
  const current = activeId(view);
  /** Side drawer: hidden by default, opens via the ☰ handle. */
  const [drawerOpen, setDrawerOpen] = useState(false);

  function navigateFromDrawer(target: ViewMode): void {
    onNavigate(target);
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Drawer backdrop */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Side drawer — hidden by default, opens via the ☰ handle */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-slate-200/70 bg-white/95 backdrop-blur transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900/95 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
          <button type="button" onClick={onHome} className="flex min-w-0 items-center gap-2 text-right">
            <BrandMark size={40} className="shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                العبارة للتجارة والتوريدات
              </span>
              {userEmail ? (
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="إغلاق القائمة"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateFromDrawer(item.id)}
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
          {/* AI assistant lives inside the section drawer */}
          <button
            type="button"
            onClick={() => {
              onAiToggle();
              setDrawerOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl bg-gradient-to-l from-violet-600/10 to-indigo-600/10 px-4 py-2.5 font-bold text-violet-700 transition hover:from-violet-600/20 hover:to-indigo-600/20 dark:text-violet-300"
          >
            <span className="text-lg" aria-hidden="true">
              🤖
            </span>
            المساعد الذكي
          </button>
        </nav>
        <div className="border-t border-slate-200/70 p-3 dark:border-slate-800">
          {onBackup ? (
            <button
              type="button"
              onClick={onBackup}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-600/15 dark:text-emerald-300 dark:hover:bg-emerald-600/25"
            >
              💾 نسخة احتياطية
            </button>
          ) : null}
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
      <div>
        {/* Slim top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* ☰ drawer handle */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="فتح القائمة"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ☰
              </button>
              <button
                type="button"
                onClick={onHome}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base text-white shadow-soft"
                aria-label="الصفحة الرئيسية"
              >
                ع
              </button>
              <h1 className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-white">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {notificationsSlot}
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
    </div>
  );
}
