import { useEffect, useState, type ReactNode } from 'react';
import type { Partnership } from '../../domain/types';
import {
  itemBuyCost,
  itemQuantity,
  partnershipSettlement,
  supplierBalance,
  supplierTotals,
} from '../../domain/finance';
import { formatCurrency, formatDate } from '../../utils/format';
import { getPartnershipDoc, getShareLink } from '../../data/repositories';
import { partnershipHtml } from '../../components/print/reports';
import { printHtmlDocument } from '../../utils/print';

interface ShareViewProps {
  token: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; partnership: Partnership };

const KIND_LABELS: Record<string, string> = {
  expense: '💸 مصروف',
  sale: '💰 بيع',
  reimbursement: '🔄 سداد',
  refund: '↩️ مرتجع',
};

export function ShareView({ token }: ShareViewProps): ReactNode {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const link = await getShareLink(token);
        if (!link || link.revoked === true || link.partnershipId === '') {
          if (!cancelled) setState({ status: 'error', message: 'رابط المشاركة غير صالح أو تم إيقافه.' });
          return;
        }
        const partnership = await getPartnershipDoc(link.partnershipId);
        if (!partnership) {
          if (!cancelled) setState({ status: 'error', message: 'تعذر العثور على بيانات الشراكة.' });
          return;
        }
        if (!cancelled) setState({ status: 'ready', partnership });
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'تعذر تحميل البيانات. تحقق من الإنترنت وحاول مجدداً.' });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100" dir="rtl">
        <p className="text-sm font-bold text-slate-500">جاري تحميل بيانات الشراكة...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4" dir="rtl">
        <div className="card card-pad max-w-md text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-2 font-bold text-slate-700 dark:text-slate-200">{state.message}</p>
        </div>
      </div>
    );
  }

  const p = state.partnership;
  const partyIds = ['me', ...p.partners.map((partner) => partner.id)];
  const partyName = (id: string): string =>
    id === 'me' ? 'وليد' : (p.partners.find((partner) => partner.id === id)?.name ?? 'طرف');
  const settlement = partnershipSettlement(p.items ?? [], p.txs ?? [], p.shares, partyIds);
  const buyCostTotal = (p.items ?? []).reduce((sum, item) => sum + itemBuyCost(item), 0);
  const supplierPaid = supplierTotals(p.supplierPayments ?? []).paid;
  const supplierDue = supplierBalance(buyCostTotal, supplierPaid);
  const exportDate = new Date().toLocaleDateString('ar-EG');

  const handlePrint = (): void => {
    void printHtmlDocument(partnershipHtml(p, exportDate)).catch((error: unknown) => {
      alert(error instanceof Error ? error.message : 'تعذر الطباعة');
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100" dir="rtl">
      <header className="border-b border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-xl text-white">ع</span>
            <div>
              <p className="font-bold">العبارة للتجارة والتوريدات</p>
              <p className="text-xs text-slate-500">👁️ عرض مشاركة — اطلاع فقط</p>
            </div>
          </div>
          <button type="button" onClick={handlePrint} className="btn-ghost">
            🖨️ طباعة الكشف
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="card card-pad">
          <h1 className="text-xl font-black">{p.name}</h1>
          <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            🤝 {p.partners.map((partner) => `${partner.name} (${p.shares[partner.id] ?? 0}%)`).join('، ') || 'بدون شركاء'} • نسبتي {p.shares['me'] ?? 0}% •{' '}
            {p.status === 'active' ? 'نشطة' : 'مسواة'}
          </p>
          {p.supplierName ? <p className="mt-1 text-xs font-bold text-slate-500">🏭 المورّد: {p.supplierName}</p> : null}
        </div>

        <div className="card card-pad">
          <h2 className="mb-3 text-base font-black">📦 البضاعة المشتركة</h2>
          {(p.items ?? []).length > 0 ? (
            <div className="space-y-3">
              {(p.items ?? []).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">
                      {item.name} <span className="chip mr-2">{item.mode === 'weight' ? '⚖️ وزن' : '📦 لوط'}</span>
                    </p>
                    <p className="font-mono text-sm font-black" dir="ltr">{formatCurrency(itemBuyCost(item))}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">إجمالي الكمية: <span className="font-mono" dir="ltr">{itemQuantity(item)}</span></p>
                  {(item.deliveries ?? []).length > 0 ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-right text-xs">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="p-1.5">التاريخ</th>
                            <th className="p-1.5">الكمية</th>
                            <th className="p-1.5">السعر</th>
                            <th className="p-1.5">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(item.deliveries ?? []).map((delivery) => (
                            <tr key={delivery.id} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="p-1.5">{formatDate(delivery.date)}</td>
                              <td className="p-1.5 font-mono" dir="ltr">{delivery.quantity}</td>
                              <td className="p-1.5 font-mono" dir="ltr">{formatCurrency(delivery.unitPrice)}</td>
                              <td className="p-1.5 font-mono font-bold" dir="ltr">{formatCurrency(delivery.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-slate-400">لا أصناف مسجلة.</p>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="mb-3 text-base font-black">🏭 حساب المورّد</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">إجمالي التكلفة</p>
              <p className="font-mono font-black" dir="ltr">{formatCurrency(buyCostTotal)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">المدفوع</p>
              <p className="font-mono font-black text-emerald-600" dir="ltr">{formatCurrency(supplierPaid)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">المتبقي</p>
              <p className="font-mono font-black text-rose-600" dir="ltr">{formatCurrency(supplierDue)}</p>
            </div>
          </div>
          {(p.supplierPayments ?? []).length > 0 ? (
            <div className="mt-3 space-y-2">
              {(p.supplierPayments ?? []).map((pay) => (
                <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 p-2.5 text-xs dark:border-slate-700">
                  <span className="font-mono font-black" dir="ltr">{formatCurrency(pay.amount)}</span>
                  <span className="chip">{partyName(pay.paidBy)}</span>
                  {pay.deliveredBy ? <span className="text-slate-500">بيد {partyName(pay.deliveredBy)}</span> : null}
                  <span className="text-slate-400">{formatDate(pay.date)}</span>
                  {pay.notes !== '' ? <span className="w-full text-slate-500">{pay.notes}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card card-pad">
          <h2 className="mb-3 text-base font-black">📒 الدفتر</h2>
          {(p.txs ?? []).length > 0 ? (
            <div className="space-y-2">
              {(p.txs ?? []).map((tx) => (
                <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 p-2.5 text-xs dark:border-slate-700">
                  <span className="font-mono font-black" dir="ltr">{formatCurrency(tx.amount)}</span>
                  <span className="chip-brand">{KIND_LABELS[tx.kind] ?? tx.kind}</span>
                  <span className="chip">{partyName(tx.paidBy)}</span>
                  {tx.deliveredBy ? <span className="text-slate-500">بيد {partyName(tx.deliveredBy)}</span> : null}
                  {tx.kind === 'reimbursement' && tx.reimburseTo ? <span className="text-slate-500">→ {partyName(tx.reimburseTo)}</span> : null}
                  <span className="text-slate-400">{formatDate(tx.date)}</span>
                  {tx.notes !== '' ? <span className="w-full text-slate-500">{tx.notes}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-slate-400">لا حركات مسجلة.</p>
          )}
        </div>

        <div className="card card-pad">
          <h2 className="mb-2 text-base font-black">⚖️ ملخص التسوية</h2>
          <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">المبيعات</p>
              <p className="font-mono font-black" dir="ltr">{formatCurrency(settlement.sales)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">المصاريف</p>
              <p className="font-mono font-black" dir="ltr">{formatCurrency(settlement.expenses)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">صافي الربح</p>
              <p className="font-mono font-black" dir="ltr">{formatCurrency(settlement.profit)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-[11px] text-slate-500">المتبقي للمورّد</p>
              <p className="font-mono font-black" dir="ltr">{formatCurrency(supplierDue)}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {partyIds.map((id) => {
              const due = settlement.dues[id] ?? 0;
              if (Math.abs(due) < 0.01) return null;
              return (
                <p key={id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold dark:bg-slate-800/60">
                  {due > 0 ? `مستحق لـ ${partyName(id)}: ` : `مستحق على ${partyName(id)}: `}
                  <span className="font-mono" dir="ltr">{formatCurrency(Math.abs(due))}</span>
                </p>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
