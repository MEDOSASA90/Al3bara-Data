import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Payer, Partnership, PartyRef } from '../../domain/types';
import { itemBuyCost, itemQuantity, partnershipSettlement, supplierBalance, supplierTotals } from '../../domain/finance';
import { formatCurrency, formatDate, todayDateInput } from '../../utils/format';
import { ItemModal, type PartnershipItemFormData } from './ItemModal';
import { TxModal, type PartnershipTxFormData } from './TxModal';

export interface SupplierPaymentFormData {
  amount: number;
  paidBy: Payer;
  deliveredBy?: Payer;
  dateInput: string;
  notes: string;
}

interface PartnershipDetailsProps {
  partnership: Partnership;
  onBack: () => void;
  onEditMeta: () => void;
  onDeletePartnership: () => void;
  onPrint: () => void;
  onSaveItem: (data: PartnershipItemFormData, existingId: string | null) => void;
  onDeleteItem: (itemId: string) => void;
  onSaveTx: (data: PartnershipTxFormData, existingId: string | null) => void;
  onDeleteTx: (txId: string) => void;
  onSettle: () => void;
  onSaveSupplierPayment: (data: SupplierPaymentFormData, existingId: string | null) => void;
  onDeleteSupplierPayment: (paymentId: string) => void;
  onSaveSupplierName: (name: string) => void;
}

const KIND_LABELS: Record<string, string> = {
  expense: '💸 مصروف',
  sale: '💰 بيع',
  reimbursement: '🔄 سداد',
  refund: '↩️ مرتجع',
};

function partyDisplayName(parties: PartyRef[], id: Payer): string {
  if (id === 'me') return '🙋 أنا';
  return parties.find((party) => party.id === id)?.name ?? 'طرف';
}

function SettlementRow(props: { label: string; value: number; strong?: boolean }): ReactNode {
  const { label, value, strong } = props;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-mono ${strong ? 'text-base font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`} dir="ltr">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function PartnershipDetails(props: PartnershipDetailsProps): ReactNode {
  const {
    partnership: p,
    onBack,
    onEditMeta,
    onDeletePartnership,
    onPrint,
    onSaveItem,
    onDeleteItem,
    onSaveTx,
    onDeleteTx,
    onSettle,
    onSaveSupplierPayment,
    onDeleteSupplierPayment,
    onSaveSupplierName,
  } = props;

  const [itemModal, setItemModal] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null });
  const [txModal, setTxModal] = useState<{ open: boolean; txId: string | null }>({ open: false, txId: null });
  const [reimbAmount, setReimbAmount] = useState<number | ''>('');
  const parties: PartyRef[] = useMemo(
    () => [{ id: 'me', name: 'أنا' }, ...p.partners.map((partner) => ({ id: partner.id, name: partner.name }))],
    [p.partners],
  );
  const partnerIds = useMemo(() => parties.map((party) => party.id), [parties]);
  const firstPartnerId = p.partners[0]?.id ?? 'me';

  const [reimbFrom, setReimbFrom] = useState<Payer>(firstPartnerId);
  const [reimbTo, setReimbTo] = useState<Payer>('me');

  const settlement = useMemo(
    () => partnershipSettlement(p.items ?? [], p.txs ?? [], p.shares, partnerIds, p.supplierPayments ?? []),
    [p.items, p.txs, p.shares, partnerIds, p.supplierPayments],
  );

  const sortedTxs = useMemo(() => {
    const list = [...(p.txs ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [p.txs]);

  const sortedSupplierPayments = useMemo(() => {
    const list = [...(p.supplierPayments ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [p.supplierPayments]);

  const editingItem = itemModal.itemId ? (p.items ?? []).find((i) => i.id === itemModal.itemId) ?? null : null;
  const editingTx = txModal.txId ? (p.txs ?? []).find((t) => t.id === txModal.txId) ?? null : null;

  const myDue = settlement.dues['me'] ?? 0;
  const myShare = p.shares['me'] ?? 0;
  const dueText =
    Math.abs(myDue) < 0.01
      ? '✅ الحساب متعادل — لا مستحقات'
      : myDue > 0
        ? `💰 الشركاء مدينون لك بمبلغ ${formatCurrency(myDue)}`
        : `💸 أنت مدين للشركاء بمبلغ ${formatCurrency(Math.abs(myDue))}`;

  // Supplier card state
  const [supplierName, setSupplierName] = useState(p.supplierName ?? '');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payPaidBy, setPayPaidBy] = useState<Payer>('me');
  const [payDeliveredBy, setPayDeliveredBy] = useState<Payer>('me');
  const [payDate, setPayDate] = useState(todayDateInput());
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => {
    setSupplierName(p.supplierName ?? '');
  }, [p.supplierName]);

  const supplierCost = useMemo(() => (p.items ?? []).reduce((sum, item) => sum + itemBuyCost(item), 0), [p.items]);
  const supplierPaid = useMemo(() => supplierTotals(p.supplierPayments ?? []).paid, [p.supplierPayments]);
  const supplierRemaining = supplierBalance(supplierCost, supplierPaid);

  function handleQuickReimburse(event: React.FormEvent): void {
    event.preventDefault();
    if (reimbAmount === '' || Number(reimbAmount) <= 0) return;
    if (reimbFrom === reimbTo) return;
    onSaveTx(
      {
        kind: 'reimbursement',
        amount: Number(reimbAmount),
        paidBy: reimbFrom,
        deliveredBy: reimbFrom,
        reimburseTo: reimbTo,
        notes: 'سداد بين الشركاء',
        dateInput: new Date().toISOString().slice(0, 10),
      },
      null,
    );
    setReimbAmount('');
  }

  function handleAddSupplierPayment(event: React.FormEvent): void {
    event.preventDefault();
    if (payAmount === '' || Number(payAmount) <= 0) return;
    if (payDate.trim() === '') return;
    const data: SupplierPaymentFormData = {
      amount: Number(payAmount),
      paidBy: payPaidBy,
      dateInput: payDate,
      notes: payNotes.trim(),
    };
    if (payDeliveredBy !== payPaidBy) data.deliveredBy = payDeliveredBy;
    onSaveSupplierPayment(data, null);
    setPayAmount('');
    setPayNotes('');
    setPayDate(todayDateInput());
  }

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="btn-ghost">
          → رجوع
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-slate-900 md:text-2xl dark:text-white">{p.name}</h1>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            🤝 {p.partners.map((partner) => partner.name).join('، ') || 'بدون شركاء'}
            {p.partners[0]?.phone ? ` • 📞 ${p.partners[0].phone}` : ''} • نسبتي {myShare}% •{' '}
            <span className={p.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}>
              {p.status === 'active' ? 'نشطة' : 'مسواة'}
            </span>
          </p>
        </div>
        <button type="button" onClick={onPrint} className="btn-ghost">
          🖨️ كشف حساب
        </button>
        <button type="button" onClick={onEditMeta} className="btn-ghost">
          تعديل
        </button>
        <button type="button" onClick={onDeletePartnership} className="btn-danger">
          حذف
        </button>
      </div>

      {/* Settlement card */}
      <div className="card card-pad">
        <h2 className="mb-2 text-base font-black text-slate-900 dark:text-white">⚖️ كارت التسوية</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettlementRow label="تكلفة شراء البضاعة" value={settlement.buyCost} />
          <SettlementRow label="المصاريف" value={settlement.expenses} />
          <SettlementRow label="إجمالي المبيعات" value={settlement.sales} />
          {settlement.refunds > 0 && <SettlementRow label="المرتجعات" value={settlement.refunds} />}
          <SettlementRow label="المدفوع للمورد" value={settlement.supplierPaid} />
          <SettlementRow label="المتبقي للمورد" value={settlement.supplierBalance} />
          <SettlementRow label="صافي الربح" value={settlement.profit} strong />
          <SettlementRow label={`نصيبي من الربح (${myShare}%)`} value={settlement.myProfit} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={partner.id}
              label={`نصيب ${partner.name} من الربح (${p.shares[partner.id] ?? 0}%)`}
              value={settlement.profits[partner.id] ?? 0}
            />
          ))}
          <SettlementRow label="مساهمتي (مدفوعاتي)" value={settlement.contributedMe} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={`c-${partner.id}`}
              label={`مساهمة ${partner.name} (مدفوعاته)`}
              value={settlement.contributed[partner.id] ?? 0}
            />
          ))}
          <SettlementRow label="ما حصّلته أنا" value={settlement.collectedMe} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={`r-${partner.id}`}
              label={`ما حصّله ${partner.name}`}
              value={settlement.collected[partner.id] ?? 0}
            />
          ))}
          {p.partners.map((partner) => {
            const due = settlement.dues[partner.id] ?? 0;
            if (Math.abs(due) < 0.01) return null;
            return (
              <SettlementRow
                key={`d-${partner.id}`}
                label={due > 0 ? `مستحق لـ ${partner.name}` : `مستحق على ${partner.name}`}
                value={due}
                strong
              />
            );
          })}
        </div>
        <div
          className={`mt-3 rounded-xl px-4 py-3 text-sm font-black ${
            Math.abs(myDue) < 0.01
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : myDue > 0
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200'
                : 'bg-debit-50 text-debit-700 dark:bg-debit-600/15 dark:text-rose-300'
          }`}
        >
          {dueText}
        </div>
        {p.status === 'active' && Math.abs(myDue) >= 0.01 && (
          <button type="button" onClick={onSettle} className="btn-primary mt-3 w-full">
            ✅ تسجيل التسوية وإغلاق الشراكة
          </button>
        )}
      </div>

      {/* Supplier card */}
      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black text-slate-900 dark:text-white">🏭 المورد</h2>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">اسم المورد</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="اسم المورد"
              className="input"
            />
          </div>
          <button type="button" onClick={() => onSaveSupplierName(supplierName.trim())} className="btn-ghost">
            💾 حفظ الاسم
          </button>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="mb-1 text-slate-500">إجمالي التكلفة</div>
            <div className="font-mono text-sm text-slate-800 dark:text-slate-100" dir="ltr">{formatCurrency(supplierCost)}</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
            <div className="mb-1 text-emerald-600">المدفوع</div>
            <div className="font-mono text-sm text-emerald-700 dark:text-emerald-300" dir="ltr">{formatCurrency(supplierPaid)}</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
            <div className="mb-1 text-amber-600">المتبقي</div>
            <div className="font-mono text-sm text-amber-700 dark:text-amber-300" dir="ltr">{formatCurrency(supplierRemaining)}</div>
          </div>
        </div>

        {sortedSupplierPayments.length > 0 ? (
          <div className="mb-4 space-y-2">
            {sortedSupplierPayments.map((pay) => {
              const isLegacy = pay.id.startsWith('legacy-');
              return (
                <div
                  key={pay.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-black text-slate-900 dark:text-white" dir="ltr">
                        {formatCurrency(pay.amount)}
                      </span>
                      <span className="chip-brand">{partyDisplayName(parties, pay.paidBy)}</span>
                      {pay.deliveredBy ? (
                        <span className="text-[11px] font-bold text-slate-500">سلّمها {partyDisplayName(parties, pay.deliveredBy)}</span>
                      ) : null}
                      {isLegacy && <span className="chip">تحويل تلقائي</span>}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(pay.date)}</p>
                    {pay.notes !== '' && <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">بيان: {pay.notes}</p>}
                  </div>
                  {!isLegacy && (
                    <button
                      type="button"
                      onClick={() => onDeleteSupplierPayment(pay.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                    >
                      حذف
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mb-4 py-2 text-center text-xs font-medium text-slate-400">لا مدفوعات للمورد بعد.</p>
        )}

        <form onSubmit={handleAddSupplierPayment} className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="min-w-[100px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">المبلغ</label>
            <input
              type="number"
              min={0}
              step="any"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="input"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">من دفع؟</label>
            <select value={payPaidBy} onChange={(e) => setPayPaidBy(e.target.value as Payer)} className="input">
              {parties.map((party) => (
                <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">من سلّم؟</label>
            <select value={payDeliveredBy} onChange={(e) => setPayDeliveredBy(e.target.value as Payer)} className="input">
              {parties.map((party) => (
                <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input" />
          </div>
          <div className="min-w-[140px] flex-[2]">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">بيان</label>
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="اختياري" className="input" />
          </div>
          <button type="submit" className="btn-primary">
            + دفعة للمورد
          </button>
        </form>
      </div>

      {/* Items table */}
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900 dark:text-white">📦 البضاعة المشتركة</h2>
          <button type="button" onClick={() => setItemModal({ open: true, itemId: null })} className="btn-primary">
            + صنف
          </button>
        </div>
        {(p.items ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <th className="p-3 text-xs font-bold">الصنف</th>
                  <th className="p-3 text-xs font-bold">النوع</th>
                  <th className="p-3 text-xs font-bold">الكمية</th>
                  <th className="p-3 text-xs font-bold">تكلفة الشراء</th>
                  <th className="p-3 text-xs font-bold">التوريدات</th>
                  <th className="p-3 text-xs font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(p.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                      {item.name}
                      {item.notes ? <span className="block text-[11px] font-medium text-slate-400">{item.notes}</span> : null}
                    </td>
                    <td className="p-3">
                      <span className="chip">{(item.mode ?? 'lot') === 'weight' ? '⚖️ وزن' : '📦 لوط'}</span>
                    </td>
                    <td className="p-3 font-mono" dir="ltr">{itemQuantity(item)}</td>
                    <td className="p-3 font-mono font-bold" dir="ltr">{formatCurrency(itemBuyCost(item))}</td>
                    <td className="p-3">
                      <span className="chip-brand">{(item.deliveries ?? []).length} توريدات</span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setItemModal({ open: true, itemId: item.id })}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-400">لا أصناف بعد — أضف البضاعة المشتركة.</p>
        )}
      </div>

      {/* Ledger */}
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900 dark:text-white">📒 الدفتر (مصاريف / مبيعات / مرتجع / سداد)</h2>
          <button type="button" onClick={() => setTxModal({ open: true, txId: null })} className="btn-primary">
            + حركة
          </button>
        </div>

        <form onSubmit={handleQuickReimburse} className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">سداد سريع من</label>
            <select value={reimbFrom} onChange={(e) => setReimbFrom(e.target.value as Payer)} className="input">
              {parties.map((party) => (
                <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">إلى</label>
            <select value={reimbTo} onChange={(e) => setReimbTo(e.target.value as Payer)} className="input">
              {parties.filter((party) => party.id !== reimbFrom).map((party) => (
                <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="mb-1 block text-[11px] font-bold text-slate-500">المبلغ</label>
            <input
              type="number"
              min={0}
              step="any"
              value={reimbAmount}
              onChange={(e) => setReimbAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="input"
            />
          </div>
          <button type="submit" className="btn-ghost">
            🔄 تسجيل السداد
          </button>
        </form>

        {sortedTxs.length > 0 ? (
          <div className="space-y-2">
            {sortedTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200/70 p-3 dark:border-slate-700"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white" dir="ltr">
                      {formatCurrency(tx.amount)}
                    </span>
                    <span className="chip-brand">{KIND_LABELS[tx.kind] ?? tx.kind}</span>
                    <span className="chip">{partyDisplayName(parties, tx.paidBy)}</span>
                    {tx.deliveredBy ? (
                      <span className="text-[11px] font-bold text-slate-500">سلّمها {partyDisplayName(parties, tx.deliveredBy)}</span>
                    ) : null}
                    {tx.kind === 'reimbursement' && tx.reimburseTo ? (
                      <span className="text-[11px] font-bold text-slate-500">→ {partyDisplayName(parties, tx.reimburseTo)}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(tx.date)}</p>
                  {tx.notes !== '' && <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">بيان: {tx.notes}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTxModal({ open: true, txId: tx.id })}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTx(tx.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-400">لا حركات في الدفتر بعد.</p>
        )}
      </div>

      <ItemModal
        isOpen={itemModal.open}
        item={editingItem}
        onClose={() => setItemModal({ open: false, itemId: null })}
        onSave={(data) => {
          onSaveItem(data, itemModal.itemId);
          setItemModal({ open: false, itemId: null });
        }}
      />
      <TxModal
        isOpen={txModal.open}
        tx={editingTx}
        parties={parties}
        onClose={() => setTxModal({ open: false, txId: null })}
        onSave={(data) => {
          onSaveTx(data, txModal.txId);
          setTxModal({ open: false, txId: null });
        }}
      />
    </div>
  );
}
