import React, { useMemo } from 'react';
import { Client, Transaction, Entity } from '../types';
import { Timestamp } from 'firebase/firestore';
import { formatDate, formatCurrency, getDirectImageUrl } from '../utils/helpers';

interface TransactionPrintProps {
    client: Client;
    transaction: Transaction;
    exportDate: string;
}

export const TransactionPrintLayout: React.FC<TransactionPrintProps> = ({ client, transaction, exportDate }) => {
    return (
        <div className="bg-white font-sans text-slate-900 p-8 max-w-[210mm] mx-auto text-right" dir="rtl">
            {/* Header */}
            <header className="mb-8 flex justify-between items-start border-b-2 border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                            ع
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-xs mr-12 font-medium">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-full mb-1">
                        كشف حساب حركة
                    </span>
                    <p className="text-slate-400 text-[10px] font-mono">{exportDate}</p>
                </div>
            </header>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100/80">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">العميل</h3>
                    <p className="text-lg font-black text-slate-800">{client.name}</p>
                    {client.phone && (
                        <p className="text-slate-500 text-xs mt-1 font-mono" dir="ltr">
                            {Array.isArray(client.phone) ? client.phone.join(' - ') : client.phone}
                        </p>
                    )}
                </div>
                <div className="bg-sky-50 p-5 rounded-2xl border border-sky-100/80">
                    <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1">تفاصيل الحركة</h3>
                    <div className="flex flex-col gap-1.5 text-xs text-sky-850">
                        <div className="flex justify-between items-center">
                            <span className="text-sky-700">التاريخ:</span>
                            <span className="font-bold">{formatDate(transaction.date)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-sky-200/50">
                            <span className="text-sky-700 font-semibold">القيمة الإجمالية:</span>
                            <span className="text-lg font-black text-sky-950 font-mono" dir="ltr">
                                {formatCurrency(transaction.amount)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            {transaction.items && transaction.items.length > 0 && (
                <section className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-sky-600 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-800">تفاصيل الأصناف</h3>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-right text-xs">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <th className="p-3 font-bold">الصنف</th>
                                    <th className="p-3 font-bold">الكمية (كجم)</th>
                                    <th className="p-3 font-bold">سعر الكيلو</th>
                                    <th className="p-3 font-bold text-center">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transaction.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/20">
                                        <td className="p-3 text-slate-700 font-bold">{item.name}</td>
                                        <td className="p-3 text-slate-650 font-mono" dir="ltr">{item.quantity}</td>
                                        <td className="p-3 text-slate-650 font-mono" dir="ltr">{formatCurrency(item.pricePerKilo)}</td>
                                        <td className="p-3 text-slate-900 font-black text-center font-mono bg-slate-50/20">
                                            {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Notes */}
            {transaction.notes && (
                <section className="mb-8 bg-amber-50/80 p-4 rounded-xl border border-amber-100/60 flex gap-3 items-start text-xs text-amber-900">
                    <span className="text-base">📝</span>
                    <div>
                        <h3 className="font-bold mb-0.5">ملاحظات</h3>
                        <p className="leading-relaxed">{transaction.notes}</p>
                    </div>
                </section>
            )}

            {/* Images */}
            {transaction.items?.some(item => item.image && item.image.url) && (
                <section className="mb-8 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-sky-600 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-800">الصور المرفقة</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {transaction.items
                            .filter(item => item.image && item.image.url)
                            .map(item => (
                                <div key={item.id} className="border border-slate-200 rounded-xl p-2 bg-white shadow-sm break-inside-avoid">
                                    <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-150">
                                        <img
                                            src={getDirectImageUrl(item.image!.url)}
                                            alt={item.name}
                                            className="w-full h-28 object-cover rounded-md"
                                        />
                                    </div>
                                    <p className="text-center text-[10px] text-slate-500 mt-2 font-bold">{item.name}</p>
                                </div>
                            ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-slate-100 flex flex-col items-center gap-2 text-slate-400 text-[10px] font-medium">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                </div>
                <p>تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
            </footer>
        </div>
    );
};

interface ClientSummaryPrintProps {
    client: Client;
    exportDate: string;
}

export const ClientSummaryPrintLayout: React.FC<ClientSummaryPrintProps> = ({ client, exportDate }) => {
    const total = client.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const sortedTransactions = [...client.transactions].sort((a, b) => {
        const dateA = a.date ? a.date.toMillis() : 0;
        const dateB = b.date ? b.date.toMillis() : 0;
        return dateA - dateB;
    });

    return (
        <div className="bg-white font-sans text-slate-900 p-8 max-w-[210mm] mx-auto text-right" dir="rtl">
            {/* Header */}
            <header className="mb-8 flex justify-between items-start border-b-2 border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                            ع
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-xs mr-12 font-medium">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-full mb-1">
                        ملخص حساب عميل
                    </span>
                    <p className="text-slate-400 text-[10px] font-mono">{exportDate}</p>
                </div>
            </header>

            {/* Client Info */}
            <section className="mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100/80">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-xl shadow-inner">
                        👤
                    </div>
                    <div>
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">بيانات العميل</h2>
                        <p className="text-xl font-black text-slate-800">{client.name}</p>
                        {client.phone && (
                            <p className="text-slate-500 text-xs mt-0.5 font-mono" dir="ltr">
                                {Array.isArray(client.phone) ? client.phone.join(' - ') : client.phone}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Transactions Table */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-sky-600 rounded-full"></div>
                    <h3 className="text-sm font-bold text-slate-800">كشف الحركات المالية</h3>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <th className="p-3 font-bold">التاريخ</th>
                                <th className="p-3 font-bold">البيان والتفاصيل</th>
                                <th className="p-3 font-bold text-center">مدين (+)</th>
                                <th className="p-3 font-bold text-center">دائن (-)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50/20">
                                    <td className="p-3 text-slate-700 font-semibold whitespace-nowrap">{formatDate(t.date)}</td>
                                    <td className="p-3 text-slate-600">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${t.amount > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'} mb-1`}>
                                            {t.amount > 0 ? 'مشتريات' : 'دفعة سداد'}
                                        </span>
                                        <div className="text-xs font-medium">{t.notes || (t.amount > 0 ? "حركة توريد مشتريات" : "عملية دفع نقدية")}</div>
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-800 font-mono" dir="ltr">
                                        {t.amount > 0 ? formatCurrency(t.amount) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="p-3 text-center font-bold text-emerald-600 font-mono" dir="ltr">
                                        {t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : <span className="text-slate-300">-</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Summary Balance Footer */}
            <footer className="mt-8 border-t border-slate-100 pt-6">
                <div className="flex justify-end">
                    <div className={`p-6 rounded-2xl shadow-md border w-full max-w-sm ${total >= 0 ? 'bg-rose-50/80 border-rose-100 text-rose-900' : 'bg-emerald-50/80 border-emerald-100 text-emerald-950'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                الرصيد النهائي {total >= 0 ? '(مدين)' : '(دائن)'}
                            </span>
                            <span className="text-xl">{total >= 0 ? '📉' : '✅'}</span>
                        </div>
                        <div className="flex items-baseline justify-between border-t border-black/5 pt-3">
                            <span className="text-slate-500 text-xs">الإجمالي المستحق:</span>
                            <div className="text-2xl font-black font-mono" dir="ltr">
                                {formatCurrency(Math.abs(total))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 mt-12 text-slate-400 text-[10px] font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

interface EntitiesSummaryPrintProps {
    entities: Entity[];
    exportDate: string;
}

export const EntitiesSummaryPrintLayout: React.FC<EntitiesSummaryPrintProps> = ({ entities, exportDate }) => {
    const metrics = useMemo(() => {
        const allLots = entities.flatMap(e => (e.lots || []).filter(l => !l.isArchived));
        const totalInvoices = allLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
        const total30 = allLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
        const total70 = allLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);
        const remainingToSupply = allLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

        // Aggregate shippers data
        const shippersMap = new Map<string, { lotsCount: number; initialBalance: number }>();
        allLots.forEach(lot => {
            if (lot.loadingDetails?.loaderName) {
                const loaderName = lot.loadingDetails.loaderName;
                const existing = shippersMap.get(loaderName) || { lotsCount: 0, initialBalance: 0 };
                shippersMap.set(loaderName, {
                    lotsCount: existing.lotsCount + 1,
                    initialBalance: existing.initialBalance + (lot.value30 || 0)
                });
            }
        });

        const shippersArray = Array.from(shippersMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        return { totalInvoices, total30, total70, remainingToSupply, shippersArray };
    }, [entities]);

    return (
        <div className="bg-white font-sans text-slate-900 p-8 max-w-[297mm] mx-auto text-right" dir="rtl">
            {/* Header */}
            <header className="mb-8 flex justify-between items-start border-b-2 border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                            ع
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-xs mr-12 font-medium">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-full mb-1">
                        تقرير ملخص الجهات والمشتروات
                    </span>
                    <p className="text-slate-400 text-[10px] font-mono">{exportDate}</p>
                </div>
            </header>

            {/* Overall Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي قيمة الترسيات</p>
                    <p className="text-base font-black text-slate-800 font-mono" dir="ltr">{formatCurrency(metrics.totalInvoices)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي دفعة 30%</p>
                    <p className="text-base font-black text-indigo-750 font-mono" dir="ltr">{formatCurrency(metrics.total30)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي المتبقي 70%</p>
                    <p className="text-base font-black text-amber-700 font-mono" dir="ltr">{formatCurrency(metrics.total70)}</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                    <p className="text-[10px] text-rose-700 font-bold mb-1">المتبقي المطلوب سداده (70%)</p>
                    <p className="text-base font-black text-rose-700 font-mono" dir="ltr">{formatCurrency(metrics.remainingToSupply)}</p>
                </div>
            </div>

            {/* Shippers Table */}
            {metrics.shippersArray.length > 0 && (
                <section className="mb-10 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                        <h2 className="text-sm font-bold text-slate-800 font-black">تقرير صف الشاحنين</h2>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-right text-xs">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <th className="p-2.5 font-bold">#</th>
                                    <th className="p-2.5 font-bold">اسم الشاحن</th>
                                    <th className="p-2.5 font-bold">الرصيد المبدئي</th>
                                    <th className="p-2.5 font-bold text-center">عدد الحركات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {metrics.shippersArray.map((shipper, index) => (
                                    <tr key={shipper.name} className="hover:bg-slate-50/20">
                                        <td className="p-2.5 text-slate-800 font-bold">{index + 1}</td>
                                        <td className="p-2.5 text-slate-700 font-medium">{shipper.name}</td>
                                        <td className="p-2.5 font-black text-slate-950 font-mono" dir="ltr">{formatCurrency(shipper.initialBalance)}</td>
                                        <td className="p-2.5 text-center font-bold text-slate-700 font-mono" dir="ltr">{shipper.lotsCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Entities Details */}
            <section className="space-y-8">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                    <h2 className="text-sm font-bold text-slate-800 font-black">تفاصيل اللوطات التابعة للجهات</h2>
                </div>

                {entities.map(entity => {
                    const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                    if (activeLots.length === 0) return null;

                    const entityTotal = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
                    const entity30 = activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
                    const entity70 = activeLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);

                    let deadlineTimestamp: Timestamp | null = null;
                    if (entity.auctionDate && typeof entity.auctionDate.toMillis === 'function') {
                        const deadlineDate = new Date(entity.auctionDate.toMillis());
                        deadlineDate.setDate(deadlineDate.getDate() + 15);
                        deadlineTimestamp = Timestamp.fromDate(deadlineDate);
                    }

                    return (
                        <div key={entity.id} className="border border-slate-200 rounded-2xl p-5 break-inside-avoid shadow-sm bg-white">
                            <div className="bg-slate-50 p-4 rounded-xl mb-4 flex justify-between items-center">
                                <div>
                                    <h4 className="text-base font-black text-slate-800">{entity.name}</h4>
                                    {entity.buyerName && <p className="text-xs text-slate-500 mt-1 font-bold">المشتري: {entity.buyerName}</p>}
                                </div>
                                <div className="text-left text-xs font-semibold text-slate-650">
                                    <p>تاريخ الجلسة: {formatDate(entity.auctionDate)}</p>
                                    <p className="text-rose-650 mt-0.5">آخر موعد للدفع: {deadlineTimestamp ? formatDate(deadlineTimestamp) : 'لا يوجد'}</p>
                                </div>
                            </div>

                            <table className="w-full text-right text-xs mb-4">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                        <th className="p-2.5 font-bold">رقم اللوط</th>
                                        <th className="p-2.5 font-bold">الاسم والصنف</th>
                                        <th className="p-2.5 font-bold">الكمية</th>
                                        <th className="p-2.5 font-bold">الإجمالي</th>
                                        <th className="p-2.5 font-bold">دفعة 30%</th>
                                        <th className="p-2.5 font-bold">متبقي 70%</th>
                                        <th className="p-2.5 text-center font-bold">حالة السداد</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activeLots.map(lot => (
                                        <tr key={lot.id} className="hover:bg-slate-50/20">
                                            <td className="p-2.5 text-slate-850 font-bold">{lot.lotNumber}</td>
                                            <td className="p-2.5 text-slate-700 font-medium">{lot.name}</td>
                                            <td className="p-2.5 text-slate-600 font-mono" dir="ltr">{lot.quantity || '-'}</td>
                                            <td className="p-2.5 text-slate-900 font-black font-mono" dir="ltr">{formatCurrency(lot.totalValue)}</td>
                                            <td className="p-2.5 text-indigo-750 font-black font-mono" dir="ltr">{formatCurrency(lot.value30)}</td>
                                            <td className="p-2.5 text-amber-700 font-black font-mono" dir="ltr">{formatCurrency(lot.value70)}</td>
                                            <td className="p-2.5 text-center">
                                                {lot.is70Paid ? (
                                                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100">مسدد</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-100">غير مسدد</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                                <div>
                                    <span className="text-slate-500 font-bold">إجمالي الجهة:</span>
                                    <span className="font-black text-slate-850 font-mono block mt-1" dir="ltr">{formatCurrency(entityTotal)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold">دفعة 30%:</span>
                                    <span className="font-black text-indigo-850 font-mono block mt-1" dir="ltr">{formatCurrency(entity30)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold">دفعة 70%:</span>
                                    <span className="font-black text-amber-850 font-mono block mt-1" dir="ltr">{formatCurrency(entity70)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-slate-100 flex flex-col items-center gap-2 text-slate-400 text-[10px] font-medium">
                <p>تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
                <p className="mt-0.5">حقوق الطبع محفوظة © {new Date().getFullYear()}</p>
            </footer>
        </div>
    );
};

interface AllClientsPrintProps {
    clients: Client[];
    title: string;
    exportDate: string;
}

export const AllClientsPrintLayout: React.FC<AllClientsPrintProps> = ({ clients, title, exportDate }) => {
    const totalBalance = useMemo(() => {
        return clients.reduce((sum, client) => {
            const clientBalance = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
            return sum + clientBalance;
        }, 0);
    }, [clients]);

    return (
        <div className="bg-white font-sans text-slate-900 p-8 max-w-[210mm] mx-auto text-right" dir="rtl">
            {/* Header */}
            <header className="mb-8 flex justify-between items-start border-b-2 border-slate-100 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl">
                            ع
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-xs mr-12 font-medium">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-full mb-1">
                        {title}
                    </span>
                    <p className="text-slate-400 text-[10px] font-mono">{exportDate}</p>
                </div>
            </header>

            {/* Overall Summary Stats */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-base font-extrabold text-slate-800">ملخص حسابات العملاء</h2>
                    <p className="text-slate-505 text-xs mt-0.5">إجمالي عدد الحسابات: {clients.length}</p>
                </div>
                <div className="text-left">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">إجمالي الرصيد</p>
                    <p className={`text-xl font-black font-mono ${totalBalance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                        {formatCurrency(Math.abs(totalBalance))} {totalBalance >= 0 ? 'مدين' : 'دائن'}
                    </p>
                </div>
            </div>

            {/* Clients Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                    <thead>
                        <tr className="bg-slate-50 text-slate-505 border-b border-slate-200">
                            <th className="p-3 font-bold">العميل</th>
                            <th className="p-3 font-bold">آخر حركة</th>
                            <th className="p-3 font-bold text-center">الرصيد الكلي</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {clients.map((client) => {
                            const balance = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
                            const lastTransaction = [...(client.transactions || [])].sort((a, b) => {
                                const dateA = a.date ? a.date.toMillis() : 0;
                                const dateB = b.date ? b.date.toMillis() : 0;
                                return dateB - dateA;
                            })[0];

                            return (
                                <tr key={client.id} className="hover:bg-slate-50/20">
                                    <td className="p-3">
                                        <p className="text-slate-800 font-bold text-sm">{client.name}</p>
                                        {client.phone && (
                                            <p className="text-slate-400 text-[10px] font-mono mt-0.5" dir="ltr">
                                                {Array.isArray(client.phone) ? client.phone.join(' - ') : client.phone}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-3 text-slate-600 font-semibold whitespace-nowrap">
                                        {lastTransaction ? formatDate(lastTransaction.date) : 'لا توجد حركات'}
                                    </td>
                                    <td className={`p-3 text-center font-bold font-mono text-sm ${balance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                                        {formatCurrency(Math.abs(balance))} {balance >= 0 ? '(مدين)' : '(دائن)'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-slate-100 flex flex-col items-center gap-2 text-slate-400 text-[10px] font-medium">
                <p>تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
                <p className="mt-0.5">حقوق الطبع محفوظة © {new Date().getFullYear()}</p>
            </footer>
        </div>
    );
};


