import React, { useMemo } from 'react';
import { Entity, Lot } from '../types';
import { Timestamp } from 'firebase/firestore';
import { MetricCard } from './MetricCard';
import { formatDate, formatCurrency } from '../utils/helpers';

interface DashboardMetricsProps {
    entities: Entity[];
    onMetricClick?: (filter: 'unpaid70' | 'all') => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ entities, onMetricClick }) => {
    const metrics = useMemo(() => {
        if (!entities) return { totalInvoices: 0, remainingToSupply: 0, remaining30: 0, upcomingLot: undefined };

        const allLots = entities.flatMap(e => (e.lots || []).filter(l => l && !l.isArchived));

        const totalInvoices = allLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
        const remainingToSupply = allLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);
        const remaining30 = allLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);

        const upcomingLot = allLots
            .filter(lot => !lot.is70Paid)
            .map(lot => {
                const entity = entities.find(e => e.lots && e.lots.some(l => l.id === lot.id));
                return { ...lot, auctionDate: entity?.auctionDate };
            })
            .filter(lot => lot.auctionDate && typeof lot.auctionDate.toMillis === 'function' && (new Date(lot.auctionDate.toMillis() + 15 * 24 * 60 * 60 * 1000) > new Date()))
            .sort((a, b) => {
                const dateA = a.auctionDate ? a.auctionDate.toMillis() : 0;
                const dateB = b.auctionDate ? b.auctionDate.toMillis() : 0;
                return dateA - dateB;
            })[0];

        return {
            totalInvoices,
            remainingToSupply,
            remaining30,
            upcomingLot,
        };
    }, [entities]);

    const getStatusTag = (days: number) => {
        if (isNaN(days)) return null;
        if (days < 0) return <span className="text-[10px] font-extrabold bg-rose-50 border border-rose-200/50 text-rose-700 px-2.5 py-0.5 rounded-full animate-pulse">متأخر</span>;
        if (days <= 5) return <span className="text-[10px] font-extrabold bg-amber-50 border border-amber-200/50 text-amber-700 px-2.5 py-0.5 rounded-full">قيد الانتظار</span>;
        return <span className="text-[10px] font-extrabold bg-cyan-50 border border-cyan-200/50 text-cyan-700 px-2.5 py-0.5 rounded-full">قادم</span>;
    };

    const getDaysDiff = (date: Timestamp) => {
        if (!date || typeof date.toMillis !== 'function') return 0;
        const deadline = new Date(date.toMillis());
        deadline.setDate(deadline.getDate() + 15);
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const isFullyPaid = metrics.totalInvoices > 0 && metrics.remainingToSupply === 0;

    if (isFullyPaid) {
        return (
            <div className="mb-6 animate-fadeIn">
                <div className="bg-gradient-to-br from-emerald-50 via-white to-white p-6 rounded-3xl shadow-sm border border-emerald-250/60 text-center">
                    <h4 className="text-sm font-bold text-slate-500 mb-2">إجمالي حساب المشتريات المترسية</h4>
                    <p className="text-3xl font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(metrics.totalInvoices)}</p>
                    <div className="mt-4 inline-flex bg-emerald-100 border border-emerald-200 text-emerald-800 px-5 py-1.5 rounded-xl font-extrabold text-xs">
                        🎉 تم سداد جميع المستحقات المتبقية (70%) بالكامل
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-6 animate-fadeIn text-right" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    value={formatCurrency(metrics.remainingToSupply)}
                    gradient="from-rose-500/10 via-rose-600/5 to-transparent border border-rose-500/25"
                    icon="📉"
                    valueColor="text-rose-600"
                    subText="المبالغ المعلقة المطلوب سدادها"
                    onClick={onMetricClick ? () => onMetricClick('unpaid70') : undefined}
                />
                <MetricCard
                    title="دفعة التعاقد (30%)"
                    value={formatCurrency(metrics.remaining30)}
                    gradient="from-indigo-500/10 via-indigo-600/5 to-transparent border border-indigo-500/25"
                    icon="📊"
                    valueColor="text-indigo-600"
                    subText="المسدد كمقدمات للوطات"
                />
                {metrics.upcomingLot && metrics.upcomingLot.auctionDate ? (() => {
                    const deadlineDate = new Date(metrics.upcomingLot.auctionDate.toMillis());
                    deadlineDate.setDate(deadlineDate.getDate() + 15);
                    const deadlineTimestamp = Timestamp.fromDate(deadlineDate);

                    return (
                        <MetricCard
                            title="أقرب ميعاد دفع (70%)"
                            value={formatDate(deadlineTimestamp)}
                            tag={getStatusTag(getDaysDiff(metrics.upcomingLot.auctionDate))}
                            gradient="from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/25"
                            icon="📅"
                            valueColor="text-amber-700"
                            subText={`لوط رقم: ${metrics.upcomingLot.lotNumber}`}
                        />
                    );
                })() : (
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
};
