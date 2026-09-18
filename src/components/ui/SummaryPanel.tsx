import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Client } from '../../domain/types';
import { summarizeTransactions } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';

export interface SummaryPanelProps {
  clients: Client[];
  title?: string;
}

export function SummaryPanel({ clients, title = 'الملخص المالي العام' }: SummaryPanelProps): ReactNode {
  const summary = useMemo(() => {
    const active = clients.filter((c) => !c.isArchived);
    return summarizeTransactions(active.flatMap((c) => c.transactions ?? []));
  }, [clients]);

  return (
    <div
      className="mb-8 rounded-3xl border border-slate-200/60 bg-white/70 p-6 text-right shadow-xl shadow-indigo-100/10 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-2xl dark:shadow-indigo-950/25 dark:backdrop-blur-xl"
      dir="rtl"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2.5 text-white shadow-md">
          <span className="text-lg">📊</span>
        </div>
        <h3 className="bg-gradient-to-r from-slate-800 to-slate-900 bg-clip-text text-lg font-black text-transparent dark:from-white dark:to-slate-300">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-5 shadow-md dark:border-white/10 dark:bg-slate-900/60">
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-rose-500 to-red-500 opacity-10 blur-2xl transition-all duration-500 group-hover:scale-125 dark:opacity-20" />
          <div className="relative z-10">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                إجمالي المدين (عليه)
              </span>
              <div className="rounded-xl bg-gradient-to-br from-rose-500 to-red-500 p-2 text-white shadow-md shadow-rose-500/10">
                <span className="text-lg">📈</span>
              </div>
            </div>
            <p className="mb-1.5 font-mono text-2xl font-black text-rose-600 dark:text-rose-400" dir="ltr">
              {formatCurrency(summary.totalDebit)}
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              إجمالي المشتريات والديون المطلوبة
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-5 shadow-md dark:border-white/10 dark:bg-slate-900/60">
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 opacity-10 blur-2xl transition-all duration-500 group-hover:scale-125 dark:opacity-20" />
          <div className="relative z-10">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                إجمالي الدائن (له)
              </span>
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 p-2 text-white shadow-md shadow-emerald-500/10">
                <span className="text-lg">📉</span>
              </div>
            </div>
            <p className="mb-1.5 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
              {formatCurrency(summary.totalCredit)}
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              إجمالي المدفوعات والتسديدات المسجلة
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-5 shadow-md dark:border-white/10 dark:bg-slate-900/60">
          <div
            className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${
              summary.netBalance >= 0 ? 'from-indigo-500 to-blue-500' : 'from-teal-500 to-cyan-500'
            } opacity-10 blur-2xl transition-all duration-500 group-hover:scale-125 dark:opacity-20`}
          />
          <div className="relative z-10">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                الرصيد الصافي
              </span>
              <div
                className={`rounded-xl bg-gradient-to-br p-2 text-white shadow-md ${
                  summary.netBalance >= 0 ? 'from-indigo-500 to-blue-500' : 'from-teal-500 to-cyan-500'
                }`}
              >
                <span className="text-lg">{summary.netBalance >= 0 ? '⚖️' : '✅'}</span>
              </div>
            </div>
            <p
              className={`mb-1.5 font-mono text-2xl font-black ${
                summary.netBalance >= 0
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-teal-600 dark:text-teal-400'
              }`}
              dir="ltr"
            >
              {formatCurrency(Math.abs(summary.netBalance))}
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {summary.netBalance >= 0 ? 'مستحق للشركة' : 'مدفوع مقدماً'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
