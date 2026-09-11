import React, { useState, useMemo } from 'react';
import { Entity, Client, ViewMode } from '../types';
import { formatCurrency } from '../utils/helpers';

interface AdvancedStatisticsProps {
    entities: Entity[];
    workClients: Client[];
}

const AdvancedStatistics: React.FC<AdvancedStatisticsProps> = ({ entities, workClients }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showYearly, setShowYearly] = useState(false);

    const calculateStats = useMemo(() => {
        const now = new Date();
        let start: Date;
        let end: Date;

        if (showYearly) {
            start = new Date(now.getFullYear(), 0, 1);
            end = now;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = now;
        }

        const filteredEntities = entities.filter(entity => {
            if (!entity.auctionDate) return false;
            const auctionDate = entity.auctionDate.toDate();
            return auctionDate >= start && auctionDate <= end;
        });

        const totalLotsValue = filteredEntities.reduce((sum, entity) => {
            const activeLots = (entity.lots || []).filter(l => !l.isArchived);
            return sum + activeLots.reduce((lotSum, lot) => lotSum + (lot.totalValue || 0), 0);
        }, 0);

        const totalWorkSales = workClients.reduce((sum, client) => {
            const clientTransactions = (client.transactions || []).filter(t => {
                if (!t.date) return false;
                const transDate = t.date.toDate();
                return transDate >= start && transDate <= end;
            });
            return sum + clientTransactions.reduce((tSum, t) => tSum + (t.amount || 0), 0);
        }, 0);

        const contractorStats: { [key: string]: number } = {};
        filteredEntities.forEach(entity => {
            if (entity.buyerName) {
                const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                const totalValue = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
                contractorStats[entity.buyerName] = (contractorStats[entity.buyerName] || 0) + totalValue;
            }
        });

        const topContractors = Object.entries(contractorStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return {
            totalLotsValue,
            totalWorkSales,
            topContractors,
            period: showYearly ? `${start.getFullYear()}` : `${start.toLocaleDateString('ar-EG')} - ${end.toLocaleDateString('ar-EG')}`,
            entitiesCount: filteredEntities.length
        };
    }, [entities, workClients, startDate, endDate, showYearly]);

    const handleYearlyStats = () => {
        setShowYearly(true);
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="mt-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {/* Expand Toggle Header */}
                <div
                    className="p-5 cursor-pointer hover:bg-slate-50/60 transition-all duration-200"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                                </svg>
                            </div>
                            <div className="text-right">
                                <h2 className="text-lg font-black text-slate-800">📊 إحصائيات متقدمة</h2>
                                <p className="text-slate-500 text-xs mt-0.5">تحليل المبيعات وأداء المنفذين</p>
                            </div>
                        </div>
                        <svg
                            className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Body Content */}
                {isExpanded && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/30">
                        {/* Date Picker Form */}
                        <div className="bg-white border border-slate-200/80 rounded-xl p-5 mb-5 text-right">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                📅 تحديد الفترة الزمنية للتقارير
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1.5 font-bold">من تاريخ</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => { setStartDate(e.target.value); setShowYearly(false); }}
                                        className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 text-xs focus:border-indigo-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1.5 font-bold">إلى تاريخ</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => { setEndDate(e.target.value); setShowYearly(false); }}
                                        className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 text-xs focus:border-indigo-500 outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleYearlyStats}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-750 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold py-2.5 px-4 rounded-lg text-xs shadow-md transition-all duration-200 cursor-pointer"
                                    >
                                        📅 إحصائيات السنة الحالية
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <span className="inline-block bg-slate-150 text-slate-700 px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200/50">
                                    الفترة النشطة: {calculateStats.period}
                                </span>
                            </div>
                        </div>

                        {/* Calculations statistics cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            {/* Lot statistics */}
                            <div className="bg-white border border-slate-200/80 rounded-xl p-5">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800">منفذين الأعمال والجهات</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                                        <p className="text-xs text-slate-500 mb-1 font-bold">إجمالي قيمة اللوطات المسحوبة</p>
                                        <p className="text-2xl font-black text-indigo-600 font-mono" dir="ltr">
                                            {formatCurrency(calculateStats.totalLotsValue)}
                                        </p>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-600 font-bold bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                                        <span>عدد الجهات النشطة:</span>
                                        <span className="text-slate-800">{calculateStats.entitiesCount} جهة</span>
                                    </div>
                                </div>
                            </div>

                            {/* Client sales */}
                            <div className="bg-white border border-slate-200/80 rounded-xl p-5">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800">مبيعات عملاء الشغل</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                                        <p className="text-xs text-slate-500 mb-1 font-bold">إجمالي المبيعات المحققة</p>
                                        <p className="text-2xl font-black text-emerald-600 font-mono" dir="ltr">
                                            {formatCurrency(calculateStats.totalWorkSales)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Contractors Rankings */}
                        {calculateStats.topContractors.length > 0 && (
                            <div className="bg-white border border-slate-200/80 rounded-xl p-5">
                                <h3 className="text-xs font-bold text-slate-700 mb-3.5 flex items-center gap-2">
                                    👑 أفضل 5 منفذين شراء للوطات
                                </h3>
                                <div className="space-y-2">
                                    {calculateStats.topContractors.map(([name, value], index) => (
                                        <div key={name} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-150 rounded-xl hover:bg-slate-100/50 transition-colors duration-150">
                                            <div className="flex items-center gap-3">
                                                <span className={`flex items-center justify-center w-6.5 h-6.5 rounded-lg text-xs font-black ${
                                                    index === 0 ? 'bg-amber-400 text-slate-950' :
                                                    index === 1 ? 'bg-slate-300 text-slate-950' :
                                                    index === 2 ? 'bg-amber-600 text-white' :
                                                    'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {index + 1}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">{name}</span>
                                            </div>
                                            <span className="text-sm font-black text-indigo-600 font-mono" dir="ltr">
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
};

interface DashboardViewProps {
    onNavigate: (view: ViewMode) => void;
    entities: Entity[];
    clients: Client[];
    workClients: Client[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
    onNavigate, 
    entities, 
    clients, 
    workClients 
}) => {

    const stats = useMemo(() => {
        const entitiesCount = entities.filter(e => e.lots?.some(l => !l.isArchived)).length;
        const activeLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => !l.isArchived).length || 0), 0);

        const advancesBalance = clients.reduce((sum, c) =>
            sum + (c.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0), 0
        );

        const workBalance = workClients.reduce((sum, c) =>
            sum + (c.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0), 0
        );

        const archivedLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => l.isArchived).length || 0), 0);
        const archivedAdvances = clients.filter(c => c.isArchived && c.archiveType === 'advances').length;
        const archivedWork = workClients.filter(c => c.isArchived && c.archiveType === 'work').length;
        const totalArchivedClients = archivedAdvances + archivedWork;

        return { 
            entitiesCount, 
            activeLots, 
            advancesBalance, 
            workBalance, 
            archivedLots, 
            totalArchivedClients 
        };
    }, [entities, clients, workClients]);

    const cards = [
        {
            id: 'entities' as ViewMode,
            title: 'حساب الجهات (المزادات)',
            icon: '🏢',
            gradient: 'from-sky-500 via-sky-600 to-cyan-600 shadow-sky-500/10',
            stat: `${stats.entitiesCount} جهة`,
            subStat: `${stats.activeLots} لوط نشط بمواعيد توريد`
        },
        {
            id: 'work' as ViewMode,
            title: 'حساب الشغل (العملاء)',
            icon: '💼',
            gradient: 'from-indigo-500 via-indigo-600 to-blue-600 shadow-indigo-500/10',
            stat: formatCurrency(stats.workBalance) + ' ج.م',
            subStat: `${workClients.length} عميل بيع وتوريد`
        },
        {
            id: 'advances' as ViewMode,
            title: 'حساب السلف والعهد',
            icon: '💰',
            gradient: 'from-amber-500 via-amber-600 to-orange-600 shadow-amber-500/10',
            stat: formatCurrency(stats.advancesBalance) + ' ج.م',
            subStat: `${clients.length} عملاء عهد نقدية`
        },
        {
            id: 'archiveMenu' as ViewMode,
            title: 'الأرشيف العام',
            icon: '📦',
            gradient: 'from-slate-600 via-slate-700 to-slate-800 shadow-slate-700/10',
            stat: `${stats.totalArchivedClients + stats.archivedLots} عنصر`,
            subStat: `${stats.totalArchivedClients} عملاء + ${stats.archivedLots} لوطات مؤرشفة`
        }
    ];

    return (
        <div className="py-6 text-right" dir="rtl">
            {/* Header Title */}
            <div className="mb-10">
                <h1 className="text-2xl md:text-3xl font-black text-slate-800">
                    لوحة التحكم الرئيسية
                </h1>
                <p className="text-slate-500 text-sm mt-1 font-semibold">
                    مرحباً بك، اختر القسم المالي الذي تود إدارته ومراجعته اليوم.
                </p>
            </div>

            {/* Navigational Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cards.map(card => (
                    <button
                        key={card.id}
                        onClick={() => onNavigate(card.id)}
                        className={`relative overflow-hidden rounded-3xl border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 p-7 text-white bg-gradient-to-br ${card.gradient} group cursor-pointer text-right outline-none`}
                    >
                        {/* Overlay shimmer */}
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-white/15 rounded-2xl border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-4xl" role="img" aria-label={card.title}>
                                        {card.icon}
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5 group-hover:translate-x-[-4px] transition-transform duration-200">
                                    <svg className="w-4 h-4 text-white transform rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>

                            <div>
                                <h2 className="text-lg font-extrabold mb-1">{card.title}</h2>
                                <p className="text-slate-100/70 text-xs font-semibold mb-4">{card.subStat}</p>
                                
                                <div className="pt-3 border-t border-white/10 flex items-baseline justify-between">
                                    <span className="text-white/60 text-[10px] uppercase font-bold">الرصيد / الحالة الإجمالية</span>
                                    <span className="text-2xl font-black font-mono tracking-tight" dir="ltr">
                                        {card.stat}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Advanced reports widget */}
            <AdvancedStatistics entities={entities} workClients={workClients} />
        </div>
    );
};
