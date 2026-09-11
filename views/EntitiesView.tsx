import React, { useState, useMemo, useEffect } from 'react';
import { Entity, Lot } from '../types';
import { Timestamp } from 'firebase/firestore';
import { formatDate, formatCurrency, formatSpecificDateTime, sortLotsByNumber } from '../utils/helpers';
import { DashboardMetrics } from '../components/DashboardMetrics';
import { BalanceDisplay } from '../components/BalanceDisplay';

// --- Local Helper Component: Session Print Layout (Replacing string-based popups) ---
interface SessionPrintLayoutProps {
    auctionDate: string;
    sessionEntities: Entity[];
    exportDate: string;
    stats: {
        totalValue: number;
        total30: number;
        remaining70: number;
        closestDeadline: Timestamp | null;
    };
}

export const SessionPrintLayout: React.FC<SessionPrintLayoutProps> = ({ auctionDate, sessionEntities, exportDate, stats }) => {
    return (
        <div className="bg-white font-sans text-slate-900 p-8 max-w-[297mm] mx-auto text-right" dir="rtl">
            <header className="mb-8 flex justify-between items-start border-b-2 border-slate-200 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-2xl">
                            ع
                        </div>
                        <h1 className="text-2xl font-black">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-xs mr-14 font-semibold">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-900 text-white text-xs font-bold px-4 py-1.5 rounded-lg mb-2 shadow-sm">
                        تقرير جلسة مزادات
                    </span>
                    <p className="text-slate-400 text-xs font-mono">{exportDate}</p>
                </div>
            </header>

            <section className="mb-6 bg-slate-900 text-white p-5 rounded-2xl shadow-md">
                <h2 className="text-lg font-black flex items-center gap-2">
                    جلسة: <span dir="ltr">{auctionDate}</span>
                </h2>
                <p className="text-slate-350 text-xs mt-1">عدد الجهات المشتركة: {sessionEntities.length} جهة</p>
            </section>

            {/* Session Stats */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                    <h3 className="text-sm font-bold text-slate-800">إحصائيات الجلسة الإجمالية</h3>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي قيمة الترسيات</p>
                        <p className="text-base font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(stats.totalValue)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي الدفعة الأولى (30%)</p>
                        <p className="text-base font-black text-indigo-700 font-mono" dir="ltr">{formatCurrency(stats.total30)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي المتبقي (70%)</p>
                        <p className="text-base font-black text-amber-700 font-mono" dir="ltr">{formatCurrency(stats.remaining70)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-500 font-bold mb-1">أقرب ميعاد دفع (مهلة الـ 70%)</p>
                        <p className="text-xs font-black text-rose-700 font-mono">
                            {stats.closestDeadline ? formatDate(stats.closestDeadline) : 'لا يوجد'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Entities & Lots details */}
            <section className="space-y-8">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                    <h3 className="text-sm font-bold text-slate-800 font-black">تفاصيل الجهات واللوطات المترسية</h3>
                </div>
                
                {sessionEntities.map(entity => {
                    const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                    if (activeLots.length === 0) return null;

                    const entityTotal = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
                    const entity30 = activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
                    const entity70 = activeLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);

                    return (
                        <div key={entity.id} className="border border-slate-200 rounded-2xl p-5 break-inside-avoid shadow-sm bg-white">
                            <div className="bg-slate-100 p-4 rounded-xl mb-4">
                                <h4 className="text-md font-black text-slate-800">{entity.name}</h4>
                                {entity.buyerName && <p className="text-xs text-slate-500 mt-1 font-bold">المشتري: {entity.buyerName}</p>}
                            </div>

                            <table className="w-full text-right text-xs mb-4">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        <th className="p-2.5 font-bold">رقم اللوط</th>
                                        <th className="p-2.5 font-bold">اسم وصنف اللوط</th>
                                        <th className="p-2.5 font-bold">الكمية المقدرة</th>
                                        <th className="p-2.5 font-bold">القيمة الكلية</th>
                                        <th className="p-2.5 font-bold">دفعة التعاقد (30%)</th>
                                        <th className="p-2.5 font-bold">متبقي التوريد (70%)</th>
                                        <th className="p-2.5 font-bold text-center">حالة السداد</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortLotsByNumber(activeLots).map(lot => (
                                        <tr key={lot.id} className="hover:bg-slate-50/20">
                                            <td className="p-2.5 text-slate-800 font-bold">{lot.lotNumber}</td>
                                            <td className="p-2.5 text-slate-650 font-medium">{lot.name}</td>
                                            <td className="p-2.5 text-slate-650 font-mono" dir="ltr">{lot.quantity || '-'}</td>
                                            <td className="p-2.5 text-slate-900 font-black font-mono" dir="ltr">{formatCurrency(lot.totalValue)}</td>
                                            <td className="p-2.5 text-indigo-700 font-black font-mono" dir="ltr">{formatCurrency(lot.value30)}</td>
                                            <td className="p-2.5 text-amber-700 font-black font-mono" dir="ltr">{formatCurrency(lot.value70)}</td>
                                            <td className="p-2.5 text-center">
                                                {lot.is70Paid ? (
                                                    <div>
                                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">مسدد</span>
                                                        {lot.paymentDetails?.payerName && <div className="text-[9px] text-slate-400 mt-0.5">بواسطة: {lot.paymentDetails.payerName}</div>}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">غير مسدد</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                                <div className="text-right">
                                    <span className="text-slate-500 font-bold">إجمالي الجهة:</span>
                                    <span className="font-black text-slate-850 font-mono block mt-1" dir="ltr">{formatCurrency(entityTotal)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 font-bold">دفعة 30%:</span>
                                    <span className="font-black text-indigo-850 font-mono block mt-1" dir="ltr">{formatCurrency(entity30)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-500 font-bold">متبقي 70%:</span>
                                    <span className="font-black text-amber-850 font-mono block mt-1" dir="ltr">{formatCurrency(entity70)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs">
                <p className="font-medium">العبارة للتجارة والتوريدات © {new Date().getFullYear()}</p>
                <p className="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p>
            </footer>
        </div>
    );
};

// --- Main Component ---
interface EntitiesViewProps {
    entities: Entity[];
    onOpenLotModal: (entity: Entity, lot?: Lot) => void;
    onOpenEntityModal: (entity: Entity) => void;
    onToggleArchive: (lot: Lot, entityId: string) => void;
    onDeleteEntity: (entityId: string) => void;
    onDeleteLot: (entityId: string, lotId: string) => void;
    onOpenSupplyModal: (type: 'lot' | 'entity', entityId: string, lotId?: string) => void;
    onOpenLoadingModal: (entityId: string, lotId?: string) => void;
    onExportEntity: (entity: Entity) => void;
    lotStatusFilterFromDashboard?: 'unpaid70' | 'all';
    onClearDashboardFilter?: () => void;
}

export const EntitiesView: React.FC<EntitiesViewProps> = ({ 
    entities, 
    onOpenLotModal, 
    onOpenEntityModal, 
    onToggleArchive, 
    onDeleteEntity, 
    onDeleteLot, 
    onOpenSupplyModal, 
    onOpenLoadingModal, 
    onExportEntity,
    lotStatusFilterFromDashboard = 'all',
    onClearDashboardFilter
}) => {

    const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [lotStatusFilter, setLotStatusFilter] = useState<'all' | 'unpaid70' | 'paid75'>('all');
    
    // Print layout active session data state (for popup-free printing)
    const [printSessionData, setPrintSessionData] = useState<{
        auctionDate: string;
        entities: Entity[];
        stats: any;
        exportDate: string;
    } | null>(null);

    // Sync filter state if passed from dashboard interactive click
    useEffect(() => {
        if (lotStatusFilterFromDashboard === 'unpaid70') {
            setLotStatusFilter('unpaid70');
            if (onClearDashboardFilter) onClearDashboardFilter();
        }
    }, [lotStatusFilterFromDashboard, onClearDashboardFilter]);

    // Handle print triggers offline-friendly
    const triggerSessionPrint = (auctionDate: string, sessionEntities: Entity[], stats: any) => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        setPrintSessionData({
            auctionDate,
            entities: sessionEntities,
            stats,
            exportDate
        });
    };

    // Print effect trigger
    useEffect(() => {
        if (printSessionData) {
            const timer = setTimeout(() => {
                window.print();
                setPrintSessionData(null);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [printSessionData]);

    const activeLotsEntities = useMemo(() => {
        if (!entities || entities.length === 0) return [];

        return entities
            .filter(e => {
                const hasActiveLots = (e.lots || []).some(l => !l.isArchived);
                const hasNoLots = (e.lots || []).length === 0;
                return hasActiveLots || hasNoLots;
            })
            .map(e => ({
                ...e,
                lots: (e.lots || []).filter(l => !l.isArchived)
            }));
    }, [entities]);

    const filteredEntities = useMemo(() => {
        let result = activeLotsEntities;

        // Apply status filter
        if (lotStatusFilter === 'unpaid70') {
            result = result.filter(entity => 
                entity.lots.some(lot => !lot.is70Paid) || entity.lots.length === 0
            ).map(entity => ({
                ...entity,
                lots: entity.lots.filter(lot => !lot.is70Paid)
            }));
        } else if (lotStatusFilter === 'paid75') {
            result = result.filter(entity => 
                entity.lots.some(lot => lot.is70Paid)
            ).map(entity => ({
                ...entity,
                lots: entity.lots.filter(lot => lot.is70Paid)
            }));
        }

        // Apply search query
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(entity => {
                if (entity.name.toLowerCase().includes(lowerSearch)) return true;
                if (entity.buyerName?.toLowerCase().includes(lowerSearch)) return true;
                return entity.lots.some(lot =>
                    lot.lotNumber.toLowerCase().includes(lowerSearch) ||
                    lot.name.toLowerCase().includes(lowerSearch)
                );
            });
        }

        return result;
    }, [activeLotsEntities, searchTerm, lotStatusFilter]);

    const groupedByAuctionDate = useMemo(() => {
        const groups: {
            [key: string]: {
                entities: Entity[];
                originalTimestamp: Timestamp;
                stats: {
                    totalValue: number;
                    total30: number;
                    remaining70: number;
                    closestDeadline: Timestamp | null;
                };
            };
        } = {};

        filteredEntities.forEach(entity => {
            if (entity.auctionDate) {
                const dateKey = formatDate(entity.auctionDate);
                if (!groups[dateKey]) {
                    groups[dateKey] = {
                        entities: [],
                        originalTimestamp: entity.auctionDate,
                        stats: {
                            totalValue: 0,
                            total30: 0,
                            remaining70: 0,
                            closestDeadline: null
                        }
                    };
                }

                groups[dateKey].entities.push(entity);

                const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                groups[dateKey].stats.totalValue += activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
                groups[dateKey].stats.total30 += activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
                groups[dateKey].stats.remaining70 += activeLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

                if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                    const deadlineDate = new Date(entity.auctionDate.toMillis());
                    deadlineDate.setDate(deadlineDate.getDate() + 15);
                    const deadline = Timestamp.fromDate(deadlineDate);

                    if (!groups[dateKey].stats.closestDeadline ||
                        deadline.toMillis() < groups[dateKey].stats.closestDeadline.toMillis()) {
                        groups[dateKey].stats.closestDeadline = deadline;
                    }
                }
            }
        });

        return groups;
    }, [filteredEntities]);

    if (!entities || entities.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center text-right" dir="rtl">
                <p className="text-slate-500 text-sm font-semibold">
                    لا توجد أي جهات أو مزادات مسجلة حالياً. ابدأ بإضافة جهة جديدة.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-right" dir="rtl">
            {/* Hidden Print Session Container */}
            {printSessionData && (
                <div className="hidden print:block">
                    <SessionPrintLayout 
                        auctionDate={printSessionData.auctionDate}
                        sessionEntities={printSessionData.entities}
                        exportDate={printSessionData.exportDate}
                        stats={printSessionData.stats}
                    />
                </div>
            )}

            {/* Filter and search controllers */}
            <div className="bg-white rounded-3xl shadow-sm p-5 border border-slate-200/80 mb-6 space-y-4 print:hidden">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Search Field */}
                    <div className="w-full md:flex-1 relative">
                        <input
                            type="text"
                            placeholder="🔍 ابحث بالجهة، المشتري، أو بمسمى اللوط..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        />
                    </div>

                    {/* Status Filter Buttons */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shrink-0 w-full md:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setLotStatusFilter('all')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                lotStatusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            كل اللوطات
                        </button>
                        <button 
                            onClick={() => setLotStatusFilter('unpaid70')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                lotStatusFilter === 'unpaid70' ? 'bg-white text-rose-600 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-rose-500'
                            }`}
                        >
                            غير مسدد الـ 70% ⏳
                        </button>
                        <button 
                            onClick={() => setLotStatusFilter('paid75')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                lotStatusFilter === 'paid75' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-emerald-500'
                            }`}
                        >
                            تم سدادها بالكامل
                        </button>
                    </div>
                </div>
            </div>

            {/* Sessions Groups */}
            <div className="space-y-6 print:hidden">
                {(Object.entries(groupedByAuctionDate) as [string, { entities: Entity[]; originalTimestamp: Timestamp; stats: any }][])
                    .sort(([, a], [, b]) => b.originalTimestamp.toMillis() - a.originalTimestamp.toMillis())
                    .map(([auctionDate, sessionData]) => {
                        const isSessionExpanded = expandedSessionId === auctionDate;

                        return (
                            <div key={auctionDate} className="border border-slate-200/80 rounded-3xl p-5 bg-slate-50/50 shadow-sm space-y-4">
                                {/* Header */}
                                <div
                                    className="flex justify-between items-center flex-wrap gap-3 pb-3.5 border-b border-slate-200 cursor-pointer select-none"
                                    onClick={() => setExpandedSessionId(isSessionExpanded ? null : auctionDate)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-indigo-600 transition-transform duration-200 bg-indigo-50 ${
                                            isSessionExpanded ? 'rotate-180' : ''
                                        }`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        <h2 className="text-md font-extrabold text-slate-800 flex items-center gap-2">
                                            📅 جلسة مزاد بتاريخ: <span dir="ltr">{auctionDate}</span>
                                        </h2>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            triggerSessionPrint(auctionDate, sessionData.entities, sessionData.stats);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-600/10 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] cursor-pointer"
                                    >
                                        🖨️ تصدير PDF للجلسة
                                    </button>
                                </div>

                                {/* Summary details cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200/50 shadow-inner">
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي الترسية</p>
                                        <p className="text-sm font-black text-slate-800 font-mono" dir="ltr">
                                            {formatCurrency(sessionData.stats.totalValue)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-bold mb-1">المحقق 30%</p>
                                        <p className="text-sm font-black text-indigo-700 font-mono" dir="ltr">
                                            {formatCurrency(sessionData.stats.total30)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-bold mb-1">متبقي 70%</p>
                                        <p className="text-sm font-black text-amber-700 font-mono" dir="ltr">
                                            {formatCurrency(sessionData.stats.remaining70)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-bold mb-1">أقرب ميعاد دفع</p>
                                        <p className="text-xs font-black text-rose-600 font-mono">
                                            {sessionData.stats.closestDeadline ? formatDate(sessionData.stats.closestDeadline) : 'لا يوجد'}
                                        </p>
                                    </div>
                                </div>

                                {/* Entities list */}
                                {isSessionExpanded && (
                                    <div className="space-y-4 pt-2 animate-fadeIn">
                                        {sessionData.entities.map(entity => {
                                            const isExpanded = expandedEntityId === entity.id;

                                            const entityMetrics = {
                                                totalLotsValue: entity.lots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0),
                                                total30: entity.lots.reduce((sum, lot) => sum + (lot.value30 || 0), 0),
                                                total70: entity.lots.reduce((sum, lot) => sum + (lot.value70 || 0), 0),
                                            };

                                            const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                                            const areAllLotsPaid = activeLots.length > 0 && activeLots.every(l => l.is70Paid);

                                            let closestDeadlineTimestamp: Timestamp | null = null;
                                            if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                                                const deadlineDate = new Date(entity.auctionDate.toMillis());
                                                deadlineDate.setDate(deadlineDate.getDate() + 15);
                                                closestDeadlineTimestamp = Timestamp.fromDate(deadlineDate);
                                            }

                                            return (
                                                <div key={entity.id} className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                                                    {/* Entity Header */}
                                                    <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100" onClick={(e) => e.stopPropagation()}>
                                                        <div
                                                            className="flex-grow cursor-pointer w-full md:w-auto"
                                                            onClick={() => setExpandedEntityId(isExpanded ? null : entity.id)}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                                                                        isExpanded ? 'rotate-180 bg-indigo-50 text-indigo-600' : ''
                                                                    }`}>
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <h3 className="text-base font-extrabold text-indigo-700">{entity.name}</h3>
                                                                        {entity.buyerName && <p className="text-[10px] text-slate-500 mt-0.5 font-bold">المشتري: {entity.buyerName}</p>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end select-none" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => onOpenLoadingModal(entity.id)}
                                                                className="text-[10px] font-extrabold bg-teal-50 border border-teal-200/50 hover:bg-teal-100 text-teal-700 py-1.5 px-3 rounded-lg cursor-pointer"
                                                            >
                                                                🚛 تم التحميل والشحن
                                                            </button>
                                                            <button
                                                                onClick={() => onOpenEntityModal(entity)}
                                                                className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded-lg border border-slate-300/40 cursor-pointer"
                                                            >
                                                                تعديل
                                                            </button>
                                                            <button
                                                                onClick={() => onExportEntity(entity)}
                                                                className="text-[10px] font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 px-3 rounded-lg border border-indigo-200/60 flex items-center justify-center gap-1 cursor-pointer"
                                                            >
                                                                🖨️ طباعة
                                                            </button>
                                                            <button
                                                                onClick={() => onDeleteEntity(entity.id)}
                                                                className="text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 py-1.5 px-3 rounded-lg border border-rose-250/20 cursor-pointer"
                                                            >
                                                                حذف الجهة
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Entity Financial stats */}
                                                    <div className="bg-slate-50/70 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-slate-100">
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 font-bold mb-0.5">إجمالي اللوطات</p>
                                                            <p className="text-sm font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(entityMetrics.totalLotsValue)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 font-bold mb-0.5">المدفوع تعاقد (30%)</p>
                                                            <p className="text-sm font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(entityMetrics.total30)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 font-bold mb-0.5">المتبقي توريد (70%)</p>
                                                            <p className="text-sm font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(entityMetrics.total70)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 font-bold mb-0.5">أقرب ميعاد دفع</p>
                                                            {areAllLotsPaid ? (
                                                                 <div className="flex flex-col">
                                                                     <span className="text-xs font-black text-emerald-600">✅ تم السداد</span>
                                                                     {entity.lots[0]?.paymentDetails?.payerName && (
                                                                         <span className="text-[10px] text-slate-500">بواسطة: {entity.lots[0].paymentDetails.payerName}</span>
                                                                     )}
                                                                 </div>
                                                             ) : (
                                                                <p className="text-xs font-black text-rose-600 font-mono">
                                                                    ⏳ {formatDate(closestDeadlineTimestamp)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Lots list */}
                                                    {isExpanded && (
                                                        <div className="p-4 space-y-4 bg-slate-50/10">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <button
                                                                    onClick={() => onOpenSupplyModal('entity', entity.id)}
                                                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 font-extrabold py-1.5 px-4 rounded-xl text-xs cursor-pointer transition-colors"
                                                                >
                                                                    💵 توريد الـ 70% لكامل الجهة
                                                                </button>
                                                                <button 
                                                                    onClick={() => onOpenLotModal(entity)} 
                                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 px-4 rounded-xl text-xs cursor-pointer shadow-md transition-colors"
                                                                >
                                                                    ➕ إضافة لوط جديد
                                                                </button>
                                                            </div>
                                                            
                                                            <h4 className="text-xs font-bold text-slate-500 pt-2 border-t border-slate-100 mt-4">بنود اللوطات النشطة:</h4>
                                                            
                                                            <div className="space-y-3.5">
                                                                {sortLotsByNumber(entity.lots).map(lot => {
                                                                    let lotDeadline: Timestamp | null = null;
                                                                    if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                                                                        const deadlineDate = new Date(entity.auctionDate.toMillis());
                                                                        deadlineDate.setDate(deadlineDate.getDate() + 15);
                                                                        lotDeadline = Timestamp.fromDate(deadlineDate);
                                                                    }
                                                                    return (
                                                                        <div key={lot.id} className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
                                                                            <p className="font-extrabold text-slate-800 text-sm">
                                                                                لوط رقم: <span className="font-mono text-indigo-600" style={{ unicodeBidi: 'plaintext', direction: 'ltr' }}>{lot.lotNumber}</span> - {lot.name}
                                                                            </p>
                                                                            
                                                                            <div className="text-xs text-slate-600 mt-2 space-y-2 bg-slate-50/40 p-3 rounded-xl border border-slate-100">
                                                                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                                                                    <p className="font-semibold">الكمية: <span className="font-mono text-slate-900 font-bold" dir="ltr">{lot.quantity}</span></p>
                                                                                    <p className="font-semibold">الإجمالي: <span className="font-mono text-slate-900 font-bold" dir="ltr">{formatCurrency(lot.totalValue)}</span></p>
                                                                                    <p className="font-semibold">دفعة 30%: <span className="font-mono text-slate-900 font-bold" dir="ltr">{formatCurrency(lot.value30)}</span></p>
                                                                                    <p className="font-semibold">متبقي 70%: <span className="font-mono text-slate-900 font-bold" dir="ltr">{formatCurrency(lot.value70)}</span></p>
                                                                                </div>

                                                                                <div className="pt-2 border-t border-slate-150 flex items-center justify-between flex-wrap gap-2">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        {lot.is70Paid ? (
                                                                                            <span className="font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-250/30 py-0.5 px-2 rounded-lg">✅ تم السداد</span>
                                                                                        ) : (
                                                                                            <span className="font-extrabold text-rose-600 bg-rose-50 border border-rose-250/30 py-0.5 px-2 rounded-lg">⏳ آخر موعد دفع: {formatDate(lotDeadline)}</span>
                                                                                        )}
                                                                                        {lot.paymentDetails?.payerName && (
                                                                                            <span className="text-slate-500 text-[10px]">بواسطة: {lot.paymentDetails.payerName}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex gap-2">
                                                                                        {lot.paymentDetails?.receiptImage && (
                                                                                            <a
                                                                                                href={lot.paymentDetails.receiptImage.url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 px-2 py-1 rounded-lg"
                                                                                            >
                                                                                                🖼️ إيصال الدفع
                                                                                            </a>
                                                                                        )}
                                                                                        {lot.contractImage ? (
                                                                                            <a
                                                                                                href={lot.contractImage.url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 px-2 py-1 rounded-lg font-bold"
                                                                                            >
                                                                                                📄 صورة العقد
                                                                                            </a>
                                                                                        ) : (
                                                                                            <span className="text-[10px] text-slate-400 border border-transparent py-1">لا يوجد صورة عقد</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center flex-wrap gap-2 select-none">
                                                                                <button onClick={() => onOpenLotModal(entity, lot)} className="bg-slate-100 hover:bg-slate-200 border border-slate-250/50 text-slate-700 text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer">تعديل</button>
                                                                                {lot.is70Paid ? (
                                                                                    <span className="bg-emerald-50 border border-emerald-250/40 text-emerald-700 text-[10px] font-bold py-1.5 px-3 rounded-lg">✅ تم التوريد</span>
                                                                                ) : (
                                                                                    <button onClick={() => onOpenSupplyModal('lot', entity.id, lot.id)} className="bg-rose-50 hover:bg-rose-100 border border-rose-250/40 text-rose-600 text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer">💵 توريد 70%</button>
                                                                                )}
                                                                                <button
                                                                                    onClick={() => onOpenLoadingModal(entity.id, lot.id)}
                                                                                    className="bg-teal-50 hover:bg-teal-100 border border-teal-250/45 text-teal-700 text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer"
                                                                                >
                                                                                    🚛 تم الشحن
                                                                                </button>
                                                                                <button onClick={() => onDeleteLot(entity.id, lot.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-rose-250/20 cursor-pointer">حذف</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};
