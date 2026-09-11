import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Entity } from '../../domain/types';
import { lotPaymentDeadline } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';
import { MetricCard } from '../../components/ui/MetricCard';

export interface DashboardMetricsProps {
  entities: Entity[];
  onMetricClick?: (filter: 'unpaid70' | 'all') => void;
}

export type DeadlineStatus = 'متأخر' | 'قيد الانتظار' | 'قادم';

export function deadlineStatus(daysLeft: number): DeadlineStatus {
  if (daysLeft < 0) return 'متأخر';
  if (daysLeft <= 5) return 'قيد الانتظار';
  return 'قادم';
}

interface UpcomingDeadline {
  lotNumber: string;
  lotName: string;
  deadline: Date;
  daysLeft: number;
}

export function DashboardMetrics({ entities, onMetricClick }: DashboardMetricsProps): ReactNode {
  const metrics = useMemo(() => {
    const allLots = entities.flatMap((e) => (e.lots ?? []).filter((l) => l && !l.isArchived));
    const totalInvoices = allLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
    const remaining70 = allLots
      .filter((lot) => !lot.is70Paid)
      .reduce((sum, lot) => sum + (lot.value70 || 0), 0);
    const contract30 = allLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);

    const now = new Date();
    const candidates: UpcomingDeadline[] = [];
    for (const entity of entities) {
      for (const lot of entity.lots ?? []) {
        if (!lot || lot.isArchived || lot.is70Paid) continue;
        const deadline = lotPaymentDeadline(entity.auctionDate);
        const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        candidates.push({ lotNumber: lot.lotNumber, lotName: lot.name, deadline, daysLeft });
      }
    }
    candidates.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    const upcoming = candidates.find((c) => c.deadline.getTime() > now.getTime()) ?? candidates[0];

    return { totalInvoices, remaining70, contract30, upcoming };
  }, [entities]);

  const isFullyPaid = metrics.totalInvoices > 0 && metrics.remaining70 === 0;

  if (isFullyPaid) {
    return (
      <div className="mb-6" dir="rtl">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 text-center shadow-sm dark:border-emerald-900 dark:from-emerald-950 dark:via-slate-900 dark:to-slate-900">
          <h4 className="mb-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            إجمالي حساب المشتريات المترسية
          </h4>
          <p className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100" dir="ltr">
            {formatCurrency(metrics.totalInvoices)}
          </p>
          <div className="mt-4 inline-flex rounded-xl border border-emerald-200 bg-emerald-100 px-5 py-1.5 text-xs font-extrabold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            🎉 تم سداد جميع المستحقات المتبقية (70%) بالكامل
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 text-right" dir="rtl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="إجمالي قيمة الترسيات"
          value={formatCurrency(metrics.totalInvoices)}
          gradient="from-slate-800 to-slate-900"
          icon="📄"
          valueColor="text-yellow-400"
          subText="المبلغ الكلي لكل اللوطات"
        />
        <MetricCard
          title="إجمالي المتبقي (70%)"
          value={formatCurrency(metrics.remaining70)}
          gradient="from-rose-500/10 via-rose-600/5 to-transparent border border-rose-500/25"
          icon="📉"
          valueColor="text-rose-600 dark:text-rose-400"
          subText="المبالغ المعلقة المطلوب سدادها"
          onClick={onMetricClick ? () => onMetricClick('unpaid70') : undefined}
        />
        <MetricCard
          title="دفعة التعاقد (30%)"
          value={formatCurrency(metrics.contract30)}
          gradient="from-indigo-500/10 via-indigo-600/5 to-transparent border border-indigo-500/25"
          icon="📊"
          valueColor="text-indigo-600 dark:text-indigo-400"
          subText="المسدد كمقدمات للوطات"
        />
        {metrics.upcoming ? (
          <MetricCard
            title="أقرب ميعاد دفع (70%)"
            value={metrics.upcoming.deadline.toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            tag={deadlineStatus(metrics.upcoming.daysLeft)}
            gradient="from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/25"
            icon="📅"
            valueColor="text-amber-700 dark:text-amber-400"
            subText={`لوط رقم: ${metrics.upcoming.lotNumber}`}
          />
        ) : (
          <MetricCard
            title="أقرب ميعاد دفع (70%)"
            value="لا يوجد"
            gradient="from-slate-800 to-slate-900"
            icon="📅"
            valueColor="text-slate-400"
            subText="لا يوجد دفعات مستحقة قادمة"
          />
        )}
      </div>
    </div>
  );
}
