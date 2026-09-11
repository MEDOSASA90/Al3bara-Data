import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Client, Entity, ViewMode } from '../../domain/types';
import { formatCurrency } from '../../utils/format';
import { DashboardMetrics } from './DashboardMetrics';

export interface DashboardViewProps {
  entities: Entity[];
  advanceClients: Client[];
  workClients: Client[];
  onNavigate: (view: ViewMode) => void;
  onMetricClick?: (filter: 'unpaid70' | 'all') => void;
}

interface NavCard {
  id: ViewMode;
  title: string;
  icon: string;
  gradient: string;
  stat: string;
  subStat: string;
}

const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export interface AdvancedStatisticsProps {
  entities: Entity[];
  workClients: Client[];
}

export function AdvancedStatistics({ entities, workClients }: AdvancedStatisticsProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const e of entities) {
      try {
        set.add(e.auctionDate.toDate().getFullYear());
      } catch {
        continue;
      }
    }
    return [...set].sort((a, b) => b - a);
  }, [entities, now]);

  const stats = useMemo(() => {
    const inPeriod = (d: Date): boolean => d.getMonth() === month && d.getFullYear() === year;

    const filteredEntities = entities.filter((entity) => {
      try {
        return inPeriod(entity.auctionDate.toDate());
      } catch {
        return false;
      }
    });

    const totalLotsValue = filteredEntities.reduce((sum, entity) => {
      const active = (entity.lots ?? []).filter((l) => !l.isArchived);
      return sum + active.reduce((s, lot) => s + (lot.totalValue || 0), 0);
    }, 0);

    const totalWorkSales = workClients.reduce((sum, client) => {
      const txs = (client.transactions ?? []).filter((t) => {
        try {
          return t.date && inPeriod(t.date.toDate());
        } catch {
          return false;
        }
      });
      return sum + txs.reduce((s, t) => s + (t.amount || 0), 0);
    }, 0);

    const contractorTotals = new Map<string, number>();
    for (const entity of filteredEntities) {
      if (!entity.buyerName) continue;
      const active = (entity.lots ?? []).filter((l) => !l.isArchived);
      const total = active.reduce((s, lot) => s + (lot.totalValue || 0), 0);
      contractorTotals.set(entity.buyerName, (contractorTotals.get(entity.buyerName) ?? 0) + total);
    }
    const topContractors = [...contractorTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalLotsValue, totalWorkSales, topContractors, entitiesCount: filteredEntities.length };
  }, [entities, workClients, month, year]);

  return (
    <div className="mt-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div
          className="cursor-pointer p-5 transition-all duration-200 hover:bg-slate-50/60 dark:hover:bg-slate-800/60"
          onClick={() => setIsExpanded((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsExpanded((v) => !v);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                <span className="text-xl">📊</span>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">إحصائيات متقدمة</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">تحليل المبيعات وأداء المنفذين</p>
              </div>
            </div>
            <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-100 bg-slate-50/30 p-5 dark:border-white/10 dark:bg-slate-800/30">
            <div className="mb-5 rounded-xl border border-slate-200/80 bg-white p-5 text-right dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                📅 تحديد الفترة الزمنية للتقارير
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="adv-month" className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                    الشهر
                  </label>
                  <select
                    id="adv-month"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-800 outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {MONTHS.map((label, i) => (
                      <option key={label} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adv-year" className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                    السنة
                  </label>
                  <select
                    id="adv-year"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-800 outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className="inline-block rounded-full border border-slate-200/50 bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                  الفترة النشطة: {MONTHS[month]} {year}
                </span>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <h3 className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-100">منفذو الأعمال والجهات</h3>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                    <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      إجمالي قيمة اللوطات المسحوبة
                    </p>
                    <p className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {formatCurrency(stats.totalLotsValue)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
                    <span>عدد الجهات النشطة:</span>
                    <span className="text-slate-800 dark:text-slate-100">{stats.entitiesCount} جهة</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <h3 className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-100">مبيعات عملاء الشغل</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-800">
                  <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المبيعات المحققة</p>
                  <p className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                    {formatCurrency(stats.totalWorkSales)}
                  </p>
                </div>
              </div>
            </div>

            {stats.topContractors.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <h3 className="mb-3.5 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  👑 أفضل 5 منفذين شراء للوطات
                </h3>
                <div className="space-y-2">
                  {stats.topContractors.map(([name, value], index) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 transition-colors duration-150 hover:bg-slate-100/50 dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                            index === 0
                              ? 'bg-amber-400 text-slate-950'
                              : index === 1
                                ? 'bg-slate-300 text-slate-950'
                                : index === 2
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-xs font-bold break-words text-slate-700 dark:text-slate-200">{name}</span>
                      </div>
                      <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400" dir="ltr">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardView({
  entities,
  advanceClients,
  workClients,
  onNavigate,
  onMetricClick,
}: DashboardViewProps): ReactNode {
  const stats = useMemo(() => {
    const entitiesCount = entities.filter((e) => (e.lots ?? []).some((l) => !l.isArchived)).length;
    const activeLots = entities.reduce(
      (sum, e) => sum + (e.lots ?? []).filter((l) => !l.isArchived).length,
      0,
    );
    const advancesBalance = advanceClients.reduce(
      (sum, c) => sum + (c.transactions ?? []).reduce((acc, t) => acc + (t.amount || 0), 0),
      0,
    );
    const workBalance = workClients.reduce(
      (sum, c) => sum + (c.transactions ?? []).reduce((acc, t) => acc + (t.amount || 0), 0),
      0,
    );
    const archivedLots = entities.reduce(
      (sum, e) => sum + (e.lots ?? []).filter((l) => l.isArchived).length,
      0,
    );
    const totalArchivedClients =
      advanceClients.filter((c) => c.isArchived).length +
      workClients.filter((c) => c.isArchived).length;
    return { entitiesCount, activeLots, advancesBalance, workBalance, archivedLots, totalArchivedClients };
  }, [entities, advanceClients, workClients]);

  const cards: NavCard[] = [
    {
      id: 'entities',
      title: 'حساب الجهات (المزادات)',
      icon: '🏢',
      gradient: 'from-sky-500 via-sky-600 to-cyan-600 shadow-sky-500/10',
      stat: `${stats.entitiesCount} جهة`,
      subStat: `${stats.activeLots} لوط نشط بمواعيد توريد`,
    },
    {
      id: 'work',
      title: 'حساب الشغل (العملاء)',
      icon: '💼',
      gradient: 'from-indigo-500 via-indigo-600 to-blue-600 shadow-indigo-500/10',
      stat: formatCurrency(stats.workBalance) + ' ج.م',
      subStat: `${workClients.length} عميل بيع وتوريد`,
    },
    {
      id: 'advances',
      title: 'حساب السلف والعهد',
      icon: '💰',
      gradient: 'from-amber-500 via-amber-600 to-orange-600 shadow-amber-500/10',
      stat: formatCurrency(stats.advancesBalance) + ' ج.م',
      subStat: `${advanceClients.length} عملاء عهد نقدية`,
    },
    {
      id: 'archiveMenu',
      title: 'الأرشيف العام',
      icon: '📦',
      gradient: 'from-slate-600 via-slate-700 to-slate-800 shadow-slate-700/10',
      stat: `${stats.totalArchivedClients + stats.archivedLots} عنصر`,
      subStat: `${stats.totalArchivedClients} عملاء + ${stats.archivedLots} لوطات مؤرشفة`,
    },
  ];

  return (
    <div className="py-6 text-right" dir="rtl">
      <div className="mb-10">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 md:text-3xl">
          لوحة التحكم الرئيسية
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          مرحباً بك، اختر القسم المالي الذي تود إدارته ومراجعته اليوم.
        </p>
      </div>

      <DashboardMetrics entities={entities} onMetricClick={onMetricClick} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onNavigate(card.id)}
            className={`group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-7 text-right text-white shadow-lg outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${card.gradient}`}
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="mb-8 flex items-center justify-between">
                <div className="rounded-2xl border border-white/10 bg-white/15 p-3 shadow-inner transition-transform duration-300 group-hover:scale-110">
                  <span className="text-4xl" role="img" aria-label={card.title}>
                    {card.icon}
                  </span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/10 transition-transform duration-200 group-hover:translate-x-[-4px]">
                  <span aria-hidden="true">←</span>
                </div>
              </div>
              <div>
                <h2 className="mb-1 text-lg font-extrabold">{card.title}</h2>
                <p className="mb-4 text-xs font-semibold text-slate-100/70">{card.subStat}</p>
                <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                  <span className="text-[10px] font-bold uppercase text-white/60">
                    الرصيد / الحالة الإجمالية
                  </span>
                  <span className="font-mono text-2xl font-black tracking-tight" dir="ltr">
                    {card.stat}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <AdvancedStatistics entities={entities} workClients={workClients} />
    </div>
  );
}
