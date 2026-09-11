import React, { useState, useMemo } from 'react';
import { Client, Transaction, TransactionItem, FinancialSummary } from '../types';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { formatDate, formatCurrency, getDirectImageUrl } from '../utils/helpers';

// --- Helper component: Financial summary cards ---
const SummaryPanel: React.FC<{ clients: Client[]; type: 'work' | 'advance' }> = ({ clients, type }) => {
    const summary = useMemo<FinancialSummary>(() => {
        let totalDebit = 0;
        let totalCredit = 0;

        clients.forEach(client => {
            if (client.isArchived) return; // Exclude archived clients from active summary
            (client.transactions || []).forEach(transaction => {
                const amount = transaction.amount || 0;
                if (amount > 0) {
                    totalDebit += amount;
                } else {
                    totalCredit += Math.abs(amount);
                }
            });
        });

        const netBalance = totalDebit - totalCredit;
        return { totalDebit, totalCredit, netBalance };
    }, [clients]);

    return (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 mb-8 shadow-sm text-right" dir="rtl">
            <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                </div>
                <h3 className="text-base font-extrabold text-slate-800">الملخص المالي العام</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Total Debit */}
                <div className="group relative bg-rose-50/70 border border-rose-200/60 rounded-2xl p-5 overflow-hidden transition-all duration-300">
                    <div className="flex justify-between items-center mb-2.5">
                        <span className="text-xs text-rose-700 font-bold uppercase tracking-wider">إجمالي المدين (مشتريات)</span>
                        <span className="text-lg" role="img" aria-label="debit">📈</span>
                    </div>
                    <p className="text-xl font-black text-rose-650 font-mono" dir="ltr">{formatCurrency(summary.totalDebit)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">إجمالي الديون والمسحوبات المستحقة للشركة</p>
                </div>

                {/* Total Credit */}
                <div className="group relative bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-5 overflow-hidden transition-all duration-300">
                    <div className="flex justify-between items-center mb-2.5">
                        <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">إجمالي الدائن (سداد)</span>
                        <span className="text-lg" role="img" aria-label="credit">📉</span>
                    </div>
                    <p className="text-xl font-black text-emerald-650 font-mono" dir="ltr">{formatCurrency(summary.totalCredit)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">إجمالي المبالغ والعهد المحصلة والمسددة</p>
                </div>

                {/* Net Balance */}
                <div className={`group relative border rounded-2xl p-5 overflow-hidden transition-all duration-300 ${
                    summary.netBalance >= 0 
                        ? 'bg-indigo-50/70 border-indigo-200/60 text-indigo-700' 
                        : 'bg-amber-50/70 border-amber-200/60 text-amber-700'
                }`}>
                    <div className="flex justify-between items-center mb-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider">صافي رصيد الديون</span>
                        <span className="text-lg" role="img" aria-label="balance">⚖️</span>
                    </div>
                    <p className="text-xl font-black font-mono" dir="ltr">
                        {formatCurrency(Math.abs(summary.netBalance))}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                        {summary.netBalance >= 0 ? '✍️ مستحق للشركة بطرف العملاء' : '🤝 أرصدة دفع مقدمة لصالح العملاء'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Helper component: Individual transaction group item ---
const TransactionGroupItem: React.FC<{
    transactions: Transaction[];
    client: Client;
    clientType: 'advance' | 'work';
    onOpenTransactionModal: (c: Client, t: Transaction) => void;
    onDeleteTransaction: (cid: string, type: 'advance' | 'work', tid: string) => void;
    onExportTransaction: (c: Client, t: Transaction) => void;
}> = ({ transactions, client, clientType, onOpenTransactionModal, onDeleteTransaction, onExportTransaction }) => {
    const [expanded, setExpanded] = useState(false);

    if (transactions.length === 0) return null;

    // Single transaction case
    if (transactions.length === 1) {
        const t = transactions[0];
        const isPayment = t.amount < 0;
        const transactionBgColor = isPayment ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-200/60';
        const amountColor = isPayment ? 'text-emerald-700' : 'text-slate-800';

        return (
            <div key={t.id} className={`${transactionBgColor} p-4 rounded-2xl border transition-all duration-200 hover:shadow-sm`}>
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className={`font-black text-lg font-mono ${amountColor}`} dir="ltr">
                                {formatCurrency(t.amount)}
                            </p>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                isPayment ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                                {isPayment ? 'سداد' : 'شراء'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold mt-1">{formatDate(t.date)}</p>
                        {t.notes && <p className="text-xs text-slate-650 mt-2 font-medium bg-white/80 p-2 rounded-xl border border-slate-150">بيان: {t.notes}</p>}
                        
                        {t.image && (
                            <a
                                href={t.image.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline mt-2 font-bold cursor-pointer"
                            >
                                📸 عرض مستند الحركة المرفق
                            </a>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap md:justify-end">
                        <button onClick={() => onOpenTransactionModal(client, t)} className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition-colors cursor-pointer">تعديل</button>
                        <button onClick={() => onDeleteTransaction(client.id, clientType, t.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold py-1.5 px-3 rounded-lg border border-rose-200/50 transition-colors cursor-pointer">حذف</button>
                        <button onClick={() => onExportTransaction(client, t)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-indigo-200/60 transition-colors cursor-pointer">🖨️ طباعة PDF</button>
                    </div>
                </div>

                {/* Items detail list */}
                {t.items && t.items.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200/60">
                        <h5 className="text-xs font-bold text-slate-500 mb-2">أصناف البضائع المستلمة:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {t.items.map(item => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                                            {item.quantity} kg &times; {formatCurrency(item.pricePerKilo)}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-black text-slate-900 font-mono" dir="ltr">
                                            {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                        </p>
                                        {item.image && (
                                            <a
                                                href={item.image.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[9px] text-indigo-600 hover:underline block mt-0.5"
                                            >
                                                🖼️ عرض الصورة
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Multiple transactions case (grouped advances)
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const isTotalPayment = totalAmount < 0;
    const groupBgColor = isTotalPayment ? 'bg-emerald-50/60 border-emerald-100' : 'bg-indigo-50/60 border-indigo-100';
    const headerAmountColor = isTotalPayment ? 'text-emerald-700' : 'text-indigo-800';
    const dateStr = formatDate(transactions[0].date);
    const allNotes = Array.from(new Set(transactions.map(t => t.notes).filter(Boolean)));

    return (
        <div className={`${groupBgColor} rounded-2xl border overflow-hidden shadow-sm transition-all duration-200`}>
            <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/40 transition-colors select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`font-black text-lg font-mono ${headerAmountColor}`} dir="ltr">
                            {formatCurrency(totalAmount)}
                        </span>
                        <span className="text-[9px] bg-white border border-slate-200/50 px-2 py-0.5 rounded-full text-slate-700 font-extrabold">
                            مجمّع ({transactions.length} حركات)
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">{dateStr}</p>
                    {allNotes.length > 0 && (
                        <p className="text-[10px] text-slate-600 mt-1 truncate max-w-xs md:max-w-md font-medium">
                            البيان: {allNotes.join(' ، ')}
                        </p>
                    )}
                </div>
                <div className="text-slate-500">
                    <svg 
                        className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-185' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth={2.5} 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {expanded && (
                <div className="bg-white/50 border-t border-slate-200/40 p-3 space-y-2.5">
                    {transactions.map(t => {
                        const isPayment = t.amount < 0;
                        const innerBg = isPayment ? 'bg-emerald-50/40 border-emerald-100' : 'bg-white';
                        const amtColor = isPayment ? 'text-emerald-700' : 'text-slate-800';
                        return (
                            <div key={t.id} className={`${innerBg} p-3.5 rounded-xl border border-slate-150 shadow-sm flex justify-between items-start gap-2`}>
                                <div>
                                    <p className={`font-black text-sm font-mono ${amtColor}`} dir="ltr">
                                        {formatCurrency(t.amount)}
                                    </p>
                                    {t.notes && <p className="text-[10px] text-slate-650 mt-1 font-medium bg-white/80 px-2 py-1 rounded-lg border border-slate-150">بيان: {t.notes}</p>}
                                    {t.image && (
                                        <a
                                            href={t.image.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline mt-1.5 font-bold cursor-pointer"
                                        >
                                            🖼️ عرض المستند
                                        </a>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => onOpenTransactionModal(client, t)} className="text-indigo-600 hover:text-indigo-850 text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer">تعديل</button>
                                    <button onClick={() => onDeleteTransaction(client.id, clientType, t.id)} className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-2 py-1 bg-rose-50 border border-rose-200/50 rounded-lg cursor-pointer">حذف</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- Helper component: Individual Client Card ---
const ClientCard: React.FC<{
    client: Client;
    type: 'advance' | 'work';
    onDeleteClient: (clientId: string, type: 'advance' | 'work') => void;
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onOpenPaymentModal: (client: Client) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onDeleteTransaction: (clientId: string, clientType: 'advance' | 'work', transactionId: string) => void;
    onExportSummary: (client: Client) => void;
    onSettleClient: (client: Client, total: number) => void;
}> = ({ client, type, onDeleteClient, onOpenTransactionModal, onOpenPaymentModal, onExportTransaction, onDeleteTransaction, onExportSummary, onSettleClient }) => {

    const [isExpanded, setIsExpanded] = useState(true);
    const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
    const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);

    const phoneNumbers = useMemo(() => {
        if (!client.phone) return [];
        return Array.isArray(client.phone) ? client.phone : [client.phone];
    }, [client.phone]);

    const copyPhoneNumber = async (phone: string) => {
        try {
            await navigator.clipboard.writeText(phone);
            setCopiedPhone(phone);
            setTimeout(() => setCopiedPhone(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const groupedTransactions = useMemo(() => {
        if (type === 'work') {
            return (client.transactions || [])
                .filter(t => t.date && typeof t.date.toDate === 'function')
                .sort((a, b) => {
                    const dateA = a.date ? a.date.toMillis() : 0;
                    const dateB = b.date ? b.date.toMillis() : 0;
                    return dateB - dateA;
                })
                .map(t => [t.id || '', [t]] as [string, Transaction[]]);
        }

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
    }, [client.transactions, type]);

    return (
        <div className={`p-4 md:p-5 rounded-3xl border transition-all duration-300 shadow-md ${
            client.isBuyer 
                ? 'bg-gradient-to-br from-indigo-50/40 via-white to-white border-indigo-200/70 hover:shadow-lg' 
                : 'bg-white border-slate-200/80 hover:shadow-lg hover:border-slate-300'
        }`}>
            {/* Card Header */}
            <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <div
                    className="flex items-center gap-3.5 cursor-pointer group select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className={`w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 bg-cyan-50 text-cyan-600' : ''
                    }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    
                    <h3 className="text-lg font-extrabold text-slate-800 group-hover:text-slate-950 transition-colors">
                        {client.name}
                    </h3>
                    
                    {client.isBuyer && (
                        <span className="bg-indigo-50 border border-indigo-200/75 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            مشتري
                        </span>
                    )}

                    {phoneNumbers.length > 0 && (
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setShowPhoneDropdown(!showPhoneDropdown)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-500"
                                title="أرقام الهاتف"
                            >
                                📞
                            </button>
                            {showPhoneDropdown && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10 cursor-default"
                                        onClick={() => setShowPhoneDropdown(false)}
                                    />
                                    <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 min-w-[200px] p-2 text-right">
                                        <p className="text-[10px] text-slate-400 font-bold mb-2 px-2 border-b border-slate-50 pb-1">أرقام الهواتف المسجلة</p>
                                        {phoneNumbers.map((phone, index) => (
                                            <button
                                                key={index}
                                                onClick={() => copyPhoneNumber(phone)}
                                                className="w-full text-right px-2.5 py-1.5 hover:bg-cyan-50 rounded-lg flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer"
                                            >
                                                <span className="font-mono text-xs text-slate-700">{phone}</span>
                                                {copiedPhone === phone ? (
                                                    <span className="text-emerald-600 text-xs">✓ تم النسخ</span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">📋 نسخ</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Client level actions */}
                <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onExportSummary(client)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3.5 rounded-xl border border-slate-200/60 transition-colors cursor-pointer">🖨️ كشف حساب</button>
                    <button onClick={() => onOpenPaymentModal(client)} className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-3.5 border border-emerald-200/50 rounded-xl transition-colors cursor-pointer">💵 سداد نقدية</button>
                    <button onClick={() => onOpenTransactionModal(client)} className="text-xs bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold py-2 px-3.5 rounded-xl shadow-md transition-colors cursor-pointer">➕ إضافة حركة</button>
                    <button onClick={() => onDeleteClient(client.id, type)} className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 px-3 rounded-xl border border-rose-250/20 transition-colors cursor-pointer">حذف</button>
                </div>
            </div>

            {/* Transactions lists */}
            {isExpanded ? (
                <>
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                        {groupedTransactions.length > 0 ? (
                            groupedTransactions.map(([dateKey, transactions]) => (
                                <TransactionGroupItem
                                    key={dateKey}
                                    transactions={transactions}
                                    client={client}
                                    clientType={type}
                                    onOpenTransactionModal={onOpenTransactionModal}
                                    onDeleteTransaction={onDeleteTransaction}
                                    onExportTransaction={onExportTransaction}
                                />
                            ))
                        ) : (
                            <p className="text-xs text-center text-slate-400 py-6 font-medium">لا توجد أي حركات مسجلة لهذا العميل حالياً.</p>
                        )}
                    </div>

                    {/* Settle & Balance Displays */}
                    <div className="mt-5 pt-4 border-t border-slate-150 flex justify-between items-center gap-4 flex-wrap">
                        {Math.abs(total) > 0 ? (
                            <button
                                onClick={() => onSettleClient(client, total)}
                                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                تسوية الرصيد بالكامل
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-250/50 py-1.5 px-3.5 rounded-xl text-emerald-700 text-xs font-bold">
                                <span>✅ الحساب مُصفّر ومسدد بالكامل</span>
                            </div>
                        )}
                        <BalanceDisplay total={total} />
                    </div>
                </>
            ) : (
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>حركات العميل مخفية حالياً</span>
                    <span className={`${total >= 0 ? 'text-rose-600' : 'text-emerald-600'} font-black font-mono`} dir="ltr">
                        {formatCurrency(Math.abs(total))} {total >= 0 ? '(مدين)' : '(دائن)'}
                    </span>
                </div>
            )}
        </div>
    );
};

// --- Main View Component ---
interface ClientsViewProps {
    type: 'advance' | 'work';
    clients: Client[];
    onOpenClientModal: () => void;
    onDeleteClient: (clientId: string, type: 'advance' | 'work') => void;
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onOpenPaymentModal: (client: Client) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onDeleteTransaction: (clientId: string, clientType: 'advance' | 'work', transactionId: string) => void;
    onExportSummary: (client: Client) => void;
    onSettleClient: (client: Client, total: number) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ 
    type, 
    clients, 
    onOpenClientModal, 
    onDeleteClient, 
    onOpenTransactionModal, 
    onOpenPaymentModal, 
    onExportTransaction, 
    onDeleteTransaction, 
    onExportSummary, 
    onSettleClient 
}) => {

    const [searchTerm, setSearchTerm] = useState('');
    const [balanceFilter, setBalanceFilter] = useState<'all' | 'debit' | 'credit' | 'zero'>('all');

    // Filter and search logic combined
    const filteredClients = useMemo(() => {
        let result = clients;

        // Apply Search query
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(client =>
                client.name.toLowerCase().includes(lowerSearch) ||
                (client.phone && (
                    typeof client.phone === 'string' 
                        ? client.phone.toLowerCase().includes(lowerSearch) 
                        : client.phone.some(p => p.toLowerCase().includes(lowerSearch))
                ))
            );
        }

        // Apply Balance Status Filter
        if (balanceFilter !== 'all') {
            result = result.filter(client => {
                const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
                if (balanceFilter === 'debit') return total > 0.05; // safe margin
                if (balanceFilter === 'credit') return total < -0.05;
                return Math.abs(total) <= 0.05; // zero balance
            });
        }

        return result;
    }, [clients, searchTerm, balanceFilter]);

    const activeClientsCount = clients.filter(c => !c.isArchived).length;

    return (
        <div className="text-right" dir="rtl">
            {/* Header info */}
            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800">
                        {type === 'work' ? 'إدارة حسابات الشغل والعملاء' : 'إدارة السلف والعهد النقدية'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-semibold">
                        متابعة حركة المبيعات، المدفوعات، والأرصدة المتبقية بطرف العملاء.
                    </p>
                </div>
                <button
                    onClick={onOpenClientModal}
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold py-2.5 px-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] cursor-pointer text-sm"
                >
                    ➕ إضافة عميل جديد
                </button>
            </div>

            {/* Summary calculation widgets */}
            <SummaryPanel clients={clients} type={type} />

            {/* Advanced Search & Filtering Bar */}
            <div className="bg-white rounded-3xl shadow-sm p-5 border border-slate-200/80 mb-8 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Search Field */}
                    <div className="w-full md:flex-1 relative">
                        <input
                            type="text"
                            placeholder="🔍 ابحث عن العميل بالاسم أو برقم الهاتف المرفق..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm"
                            >
                                مسح
                            </button>
                        )}
                    </div>

                    {/* Filter buttons */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shrink-0 w-full md:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setBalanceFilter('all')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                balanceFilter === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            الكل ({activeClientsCount})
                        </button>
                        <button 
                            onClick={() => setBalanceFilter('debit')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                balanceFilter === 'debit' ? 'bg-white text-rose-600 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-rose-500'
                            }`}
                        >
                            المدينين فقط
                        </button>
                        <button 
                            onClick={() => setBalanceFilter('credit')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                balanceFilter === 'credit' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-emerald-500'
                            }`}
                        >
                            الدائنين فقط
                        </button>
                        <button 
                            onClick={() => setBalanceFilter('zero')} 
                            className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                balanceFilter === 'zero' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            مسددين بالكامل
                        </button>
                    </div>
                </div>

                {(searchTerm || balanceFilter !== 'all') && (
                    <p className="text-xs text-slate-500 font-bold">
                        عرض {filteredClients.length} من أصل {clients.length} عملاء نشطين يطابقون خيارات التصفية الحالية.
                    </p>
                )}
            </div>

            {/* Clients List grid */}
            {filteredClients.length > 0 ? (
                <div className="space-y-6">
                    {filteredClients.map(client => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            type={type}
                            onDeleteClient={onDeleteClient}
                            onOpenTransactionModal={onOpenTransactionModal}
                            onOpenPaymentModal={onOpenPaymentModal}
                            onExportTransaction={onExportTransaction}
                            onDeleteTransaction={onDeleteTransaction}
                            onExportSummary={onExportSummary}
                            onSettleClient={onSettleClient}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center">
                    <p className="text-slate-500 text-sm font-semibold">
                        {clients.length === 0 
                            ? 'لا يوجد أي عملاء مسجلين حالياً. اضغط على "إضافة عميل جديد" للبدء.' 
                            : 'لا توجد نتائج تطابق شروط الفلترة والبحث المحددة.'
                        }
                    </p>
                </div>
            )}
        </div>
    );
};
