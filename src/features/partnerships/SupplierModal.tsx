import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Payer, Partnership, PartyRef, SupplierPayment } from '../../domain/types';
import { itemBuyCost, supplierBalance, supplierTotals } from '../../domain/finance';
import { formatCurrency, formatDate, todayDateInput } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { AuditBadge } from './AuditBadge';
import type { SupplierPaymentFormData } from './PartnershipDetails';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Render inline in the page instead of a popup. */
  inline?: boolean;
  partnership: Partnership;
  parties: PartyRef[];
  onSaveSupplierPayment: (data: SupplierPaymentFormData, existingId: string | null) => void;
  onDeleteSupplierPayment: (paymentId: string) => void;
  onSaveSupplierName: (name: string) => void;
}

function partyDisplayName(parties: PartyRef[], id: Payer): string {
  if (id === 'me') return '🙋 وليد';
  return parties.find((party) => party.id === id)?.name ?? 'طرف';
}

export function SupplierModal(props: SupplierModalProps): ReactNode {
  const { isOpen, onClose, inline, partnership: p, parties, onSaveSupplierPayment, onDeleteSupplierPayment, onSaveSupplierName } = props;

  const [supplierName, setSupplierName] = useState(p.supplierName ?? '');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payPaidBy, setPayPaidBy] = useState<Payer>('me');
  const [payDeliveredBy, setPayDeliveredBy] = useState<Payer>('me');
  const [payDate, setPayDate] = useState(todayDateInput());
  const [payNotes, setPayNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setSupplierName(p.supplierName ?? '');
  }, [isOpen, p.supplierName]);

  const sortedSupplierPayments = useMemo(() => {
    const list = [...(p.supplierPayments ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [p.supplierPayments]);

  const supplierCost = useMemo(() => (p.items ?? []).reduce((sum, item) => sum + itemBuyCost(item), 0), [p.items]);
  const supplierPaid = useMemo(() => supplierTotals(p.supplierPayments ?? []).paid, [p.supplierPayments]);
  const supplierRemaining = supplierBalance(supplierCost, supplierPaid);

  function resetPayForm(): void {
    setPayAmount('');
    setPayNotes('');
    setPayDate(todayDateInput());
    setPayPaidBy('me');
    setPayDeliveredBy('me');
    setEditingId(null);
  }

  function startEdit(pay: SupplierPayment): void {
    setEditingId(pay.id);
    setPayAmount(pay.amount);
    setPayPaidBy(pay.paidBy);
    setPayDeliveredBy(pay.deliveredBy ?? pay.paidBy);
    try {
      const d = pay.date.toDate();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setPayDate(`${y}-${m}-${day}`);
    } catch {
      setPayDate(todayDateInput());
    }
    setPayNotes(pay.notes ?? '');
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
    onSaveSupplierPayment(data, editingId);
    resetPayForm();
  }

  const body = (
    <>
      <div className="space-y-4 text-right" dir="rtl">
        <div className="flex flex-wrap items-end gap-2">
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
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
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
          <div className="space-y-2">
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
                      <AuditBadge createdBy={pay.createdBy} createdAt={pay.createdAt} updatedBy={pay.updatedBy} updatedAt={pay.updatedAt} />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(pay.date)}</p>
                    {pay.notes !== '' && <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">بيان: {pay.notes}</p>}
                  </div>
                  {!isLegacy && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(pay)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSupplierPayment(pay.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      >
                        حذف
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-2 text-center text-xs font-medium text-slate-400">لا مدفوعات للمورد بعد.</p>
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
            {editingId ? '💾 حفظ التعديل' : '+ دفعة للمورد'}
          </button>
          {editingId ? (
            <button type="button" onClick={resetPayForm} className="btn-ghost">
              إلغاء
            </button>
          ) : null}
        </form>
      </div>
    </>
  );
  if (inline) {
    return (
      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black text-slate-900 dark:text-white">🏭 المورّد</h2>
        {body}
      </div>
    );
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🏭 المورّد">
      {body}
    </Modal>
  );
}
