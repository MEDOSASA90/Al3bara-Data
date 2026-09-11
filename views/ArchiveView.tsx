import React, { useState, useMemo } from 'react';
import { Entity, Client, Lot, Transaction, ViewMode } from '../types';
import { formatDate, formatCurrency } from '../utils/helpers';
import { BalanceDisplay } from '../components/BalanceDisplay';

// --- Sub-View: Archived Client Transactions ---
const ArchivedClientCard: React.FC<{
    client: Client;
    type: 'advance' | 'work';
    onRestoreClient: (client: Client) => void;
    onExportSummary: (client: Client) => void;
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
}> = ({ client, type, onRestoreClient, onExportSummary, onOpenTransactionModal, onExportTransaction }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);

    const groupedTransactions = useMemo(() => {
        const grouped: { [key: string]: Transaction[] } = {};
        (client.transactions || []).forEach(t => {
            if (!t.date || typeof t.date.toDate !== 'function') return;

            const date = t.date.toDate();
            const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });

        return Object.entries(grouped).sort((a, b) => {
            const dateA = a[1][0].date ? a[1][0].date.toMillis() : 0;
            const dateB = b[1][0].date ? b[1][0].date.toMillis() : 0;
            return dateB - dateA;
        });
    }, [client.transactions]);

    return (
        <div className="p-4 rounded-2xl border border-slate-350/80 bg-slate-50 shadow-sm text-right" dir="rtl">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <div
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className={`w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 bg-slate-300' : ''
                    }`}>
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-sm group-hover:text-slate-950 transition-colors">
                        {client.name}
                    </h3>
                    <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-2.5 py-0.5 rounded-full border border-slate-300">
                        مؤرشف
                    </span>
                </div>
                <div className="flex items-center gap-2 select-none">
                    <button
                        onClick={() => onRestoreClient(client)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 px-3 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                        🔄 استرجاع للنشط
                    </button>
                    <button 
                        onClick={() => onExportSummary(client)} 
                        className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg border border-slate-250 cursor-pointer"
                    >
                        🖨️ كشف حساب
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-3.5 border-t border-slate-200 space-y-3.5">
                    {/* Rendered transactions list */}
                    {groupedTransactions.length > 0 ? (
                        groupedTransactions.map(([dateKey, transactions]) => (
                            <div key={dateKey} className="space-y-2 border-b border-slate-200/40 pb-3 last:pb-0 last:border-b-0">
                                <p className="text-[10px] text-slate-400 font-black">{formatDate(transactions[0].date)}</p>
                                {transactions.map(t => {
                                    const isPayment = t.amount < 0;
                                    return (
                                        <div key={t.id} className="flex justify-between items-center bg-white/70 p-3 rounded-xl border border-slate-200/50 shadow-inner">
                                            <div>
                                                <p className={`font-black text-sm font-mono ${isPayment ? 'text-emerald-700' : 'text-slate-700'}`} dir="ltr">
                                                    {formatCurrency(t.amount)}
                                                </p>
                                                {t.notes && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">بيان: {t.notes}</p>}
                                            </div>
                                            {t.image && (
                                                <a href={t.image.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 font-semibold hover:underline">
                                                    🖼️ عرض المستند
                                                </a>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-center text-slate-400 py-3 font-medium">لا توجد حركات مسجلة لهذا العميل.</p>
                    )}

                    <div className="flex justify-between items-center bg-slate-100 p-3.5 rounded-xl border border-slate-200 mt-4">
                        <span className="text-xs font-bold text-slate-500">الرصيد الكلي المؤرشف:</span>
                        <span className={`text-sm font-black font-mono ${total >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                            {formatCurrency(Math.abs(total))} {total >= 0 ? '(مدين)' : '(دائن)'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-View: Archived Clients Tab View ---
interface ArchiveClientsViewProps {
    type: 'advance' | 'work';
    clients: Client[];
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onExportSummary: (client: Client) => void;
    onRestoreClient: (client: Client) => void;
    onExportAll: (clients: Client[], type: string) => void;
}

export const ArchiveClientsView: React.FC<ArchiveClientsViewProps> = ({ 
    type, 
    clients, 
    onOpenTransactionModal, 
    onExportTransaction, 
    onExportSummary, 
    onRestoreClient, 
    onExportAll 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit'>('all');

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
            const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
            const matchesFilter =
                filterType === 'all' ||
                (filterType === 'debit' && total >= 0) ||
                (filterType === 'credit' && total < 0);

            return matchesSearch && matchesFilter;
        });
    }, [clients, searchTerm, filterType]);

    if (!clients || clients.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 font-semibold text-right" dir="rtl">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-sm">لا يوجد أي عملاء مؤرشفين في هذا القسم.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 text-right" dir="rtl">
            {/* Header statistics panel */}
            <div className="bg-slate-800 text-white p-5 rounded-3xl border border-slate-750 shadow-md flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h2 className="text-md font-extrabold mb-1">العملاء المؤرشفين</h2>
                    <p className="text-slate-300 text-xs font-semibold">إجمالي مؤرشف: {clients.length} | معروض للتصفية: {filteredClients.length}</p>
                </div>
                <button
                    onClick={() => onExportAll(clients, type === 'advance' ? 'حساب السلف' : 'حساب الشغل')}
                    className="bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                    🖨️ تصدير قائمة الكل ({clients.length})
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <input
                    type="text"
                    placeholder="🔍 ابحث عن عميل مؤرشف باسمه..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                />
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'all' | 'debit' | 'credit')}
                    className="px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-cyan-500 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                >
                    <option value="all">كل الأرصدة</option>
                    <option value="debit">رصيد مدين</option>
                    <option value="credit">رصيد دائن</option>
                </select>
            </div>

            {/* List */}
            {filteredClients.length > 0 ? (
                <div className="space-y-4">
                    {filteredClients.map(client => (
                        <ArchivedClientCard
                            key={client.id}
                            client={client}
                            type={type}
                            onRestoreClient={onRestoreClient}
                            onExportSummary={onExportSummary}
                            onOpenTransactionModal={onOpenTransactionModal}
                            onExportTransaction={onExportTransaction}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-center text-xs text-slate-400 py-6 font-semibold">لا توجد نتائج تطابق شروط التصفية.</p>
            )}
        </div>
    );
};

// --- Sub-View: Archived Lots Tab View ---
interface ArchiveLotsViewProps {
    entities: Entity[];
    onToggleArchive: (lot: Lot, entityId: string) => void;
}

export const ArchiveLotsView: React.FC<ArchiveLotsViewProps> = ({ entities, onToggleArchive }) => {
    const archivedLotsEntities = useMemo(() => {
        return entities.map(e => ({
            ...e,
            lots: (e.lots || []).filter(l => l.isArchived)
        })).filter(e => e.lots.length > 0);
    }, [entities]);

    if (archivedLotsEntities.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 font-semibold text-right" dir="rtl">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-sm">لا يوجد لوطات مؤرشفة بالمستودع حالياً.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-right" dir="rtl">
            {archivedLotsEntities.map(entity => (
                <div key={entity.id} className="bg-slate-50/50 border border-slate-200 p-5 rounded-3xl space-y-4">
                    <h3 className="font-extrabold text-sm text-slate-500 mb-2">الجهة: {entity.name}</h3>
                    <div className="space-y-3">
                        {entity.lots.map(lot => (
                            <div key={lot.id} className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:shadow-md transition-shadow">
                                <div className="text-right">
                                    <p className="font-extrabold text-slate-800 text-sm">
                                        لوط رقم: <span className="font-mono text-indigo-600" style={{ unicodeBidi: 'plaintext', direction: 'ltr' }}>{lot.lotNumber}</span> - {lot.name}
                                    </p>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-semibold">
                                        <span>القيمة الإجمالية: <span className="font-mono text-slate-700" dir="ltr">{formatCurrency(lot.totalValue)} جنيه</span></span>
                                        <span className="text-slate-300">|</span>
                                        <span>تاريخ الجلسة: <span className="text-slate-700">{formatDate(entity.auctionDate)}</span></span>
                                    </div>
                                    {lot.loadingDetails && (
                                        <p className="text-xs text-emerald-600 mt-2 font-bold bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-150/40 w-fit">
                                            🚛 تم شحنه وتحميله بواسطة: {lot.loadingDetails.loaderName} في {formatDate(lot.loadingDetails.date)}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => onToggleArchive(lot, entity.id)}
                                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold py-2 px-4 rounded-xl border border-indigo-200/50 transition-colors cursor-pointer select-none"
                                >
                                    🔄 استرجاع من الأرشيف
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- Sub-View: General Archive Menu View ---
interface ArchiveMenuViewProps {
    onNavigate: (view: ViewMode) => void;
    entities: Entity[];
    clients: Client[];
    workClients: Client[];
}

export const ArchiveMenuView: React.FC<ArchiveMenuViewProps> = ({ 
    onNavigate, 
    entities, 
    clients, 
    workClients 
}) => {
    
    const stats = useMemo(() => {
        const archivedLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => l.isArchived).length || 0), 0);
        const archivedAdvances = clients.filter(c => c.isArchived && c.archiveType === 'advances').length;
        const archivedWork = workClients.filter(c => c.isArchived && c.archiveType === 'work').length;

        return { archivedLots, archivedAdvances, archivedWork };
    }, [entities, clients, workClients]);

    const menuItems = [
        {
            id: 'archiveEntities' as ViewMode,
            title: 'أرشيف اللوطات والمزادات',
            icon: '🏢',
            gradient: 'from-slate-700 to-slate-800',
            stat: `${stats.archivedLots} لوط مؤرشف`
        },
        {
            id: 'archiveWork' as ViewMode,
            title: 'أرشيف عملاء الشغل',
            icon: '💼',
            gradient: 'from-slate-700 to-slate-800',
            stat: `${stats.archivedWork} عميل مؤرشف`
        },
        {
            id: 'archiveAdvances' as ViewMode,
            title: 'أرشيف عملاء السلف',
            icon: '💰',
            gradient: 'from-slate-700 to-slate-800',
            stat: `${stats.archivedAdvances} عميل مؤرشف`
        }
    ];

    return (
        <div className="py-6 text-right" dir="rtl">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-black text-slate-800">الأرشيف العام</h1>
                <p className="text-slate-500 text-sm mt-1 font-semibold">استعرض البيانات واللوطات والعملاء المؤرشفين، أو قم باسترجاعهم مجدداً للنظام النشط.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`relative overflow-hidden rounded-2xl border border-slate-750 shadow-md p-6 text-white bg-gradient-to-br ${item.gradient} hover:-translate-y-1 hover:shadow-xl transition-all duration-200 group cursor-pointer text-right outline-none`}
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-4xl" role="img" aria-label={item.title}>{item.icon}</span>
                                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-white transform rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold mb-1">{item.title}</h3>
                                <p className="text-indigo-300 font-bold text-base font-mono">{item.stat}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
