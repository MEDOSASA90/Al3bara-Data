import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getBusinessInsights } from '../../ai/insights';
import type { BusinessInsights, InsightSeverity } from '../../ai/schemas';
import { formatCurrency } from '../../utils/format';

export interface InsightsCardsProps {
  /** Business context built in App via buildBusinessSnapshot. Refetch happens only when it changes. */
  snapshot: string;
}

type LoadStatus = 'idle' | 'loading' | 'done' | 'error';

const SEVERITY_STYLE: Record<InsightSeverity, { card: string; badge: string; label: string }> = {
  critical: {
    card: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
    badge: 'bg-rose-600 text-white',
    label: 'حرج 🔴',
  },
  warning: {
    card: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    badge: 'bg-amber-500 text-white',
    label: 'تنبيه 🟡',
  },
  info: {
    card: 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40',
    badge: 'bg-sky-600 text-white',
    label: 'معلومة 🔵',
  },
};

export function InsightsCards({ snapshot }: InsightsCardsProps): ReactNode {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [insights, setInsights] = useState<BusinessInsights | null>(null);
  const [loadError, setLoadError] = useState('');
  const loadedFor = useRef<string | null>(null);

  const loadInsights = useCallback(async (): Promise<void> => {
    const key = snapshot;
    if (key.trim() === '') {
      setStatus('idle');
      return;
    }
    loadedFor.current = key;
    setStatus('loading');
    setLoadError('');
    try {
      const data = await getBusinessInsights(key);
      if (loadedFor.current !== key) return;
      setInsights(data);
      setStatus('done');
    } catch (err) {
      if (loadedFor.current !== key) return;
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل التحليلات الذكية');
      setStatus('error');
    }
  }, [snapshot]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  if (status === 'idle') return null;

  return (
    <section dir="rtl" aria-label="تحليلات ذكية" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">✨ تحليلات ذكية</h2>
        {status === 'done' || status === 'error' ? (
          <button
            type="button"
            onClick={() => void loadInsights()}
            className="rounded-lg bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            🔄 تحديث
          </button>
        ) : null}
      </div>

      {status === 'loading' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : null}

      {status === 'error' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
        >
          <span>⚠️ {loadError}</span>
          <button
            type="button"
            onClick={() => void loadInsights()}
            className="rounded-lg bg-rose-600 px-3 py-1.5 font-black text-white hover:bg-rose-700"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {status === 'done' && insights ? (
        <div className="space-y-3">
          {insights.alerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {insights.alerts.map((alert, index) => {
                const style = SEVERITY_STYLE[alert.severity];
                return (
                  <article
                    key={`${alert.title}-${index}`}
                    className={`rounded-2xl border p-4 shadow-sm ${style.card}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">{alert.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-5 font-semibold text-slate-600 dark:text-slate-300">
                      {alert.detail}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-2 text-xs font-black text-slate-800 dark:text-slate-100">💰 أكبر المدينين</h3>
              {insights.topDebtors.length === 0 ? (
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">لا توجد مديونيات حالية 🎉</p>
              ) : (
                <ul className="space-y-1.5">
                  {insights.topDebtors.map((debtor) => (
                    <li
                      key={debtor.name}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <span>{debtor.name}</span>
                      <span className="font-mono" dir="ltr">
                        {formatCurrency(debtor.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/40">
              <h3 className="mb-2 text-xs font-black text-indigo-800 dark:text-indigo-200">📈 توقع السيولة</h3>
              <p className="text-[11px] leading-6 font-semibold whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                {insights.cashOutlook}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
