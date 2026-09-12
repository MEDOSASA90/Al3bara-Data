import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Payer, PartnershipBuyer, PartnershipSale, PartyRef, SaleLine, SaleLineMode } from '../../domain/types';
import { SALE_STATUS_LABELS, buyerBalance, salePaid, saleRemaining, saleStatus } from '../../domain/finance';
import { dateInputFromTimestamp, formatCurrency, formatDate, todayDateInput } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { normalizeArabic } from '../../components/ui/SearchableDropdown';
import { AuditBadge } from './AuditBadge';

export interface SaleLineFormRow {
  key: string;
  name: string;
  mode: SaleLineMode;
  quantity: number | '';
  unit: string;
  unitPrice: number | '';
}

export interface PartnershipSaleFormData {
  buyerName: string;
  buyerId?: string;
  lines: { name: string; mode: SaleLineMode; quantity: number; unit?: string; unitPrice: number }[];
  dateInput: string;
  isAdvance: boolean;
  /** Deposit (عربون) checked → depositAmount collected as a cash payment. */
  hasDeposit: boolean;
  depositAmount: number;
  /** Deduct the remaining (total − deposit) from the buyer's prepaid balance. */
  deductFromBalance: boolean;
  notes: string;
}

export interface SalePaymentFormData {
  amount: number;
  dateInput: string;
  by: Payer;
  notes: string;
}

interface SalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: PartnershipSale[];
  parties: PartyRef[];
  buyers: PartnershipBuyer[];
  onSaveSale: (data: PartnershipSaleFormData, existingId: string | null) => void;
  onDeleteSale: (saleId: string) => void;
  onSavePayment: (saleId: string, data: SalePaymentFormData, existingId: string | null) => void;
  onDeletePayment: (saleId: string, paymentId: string) => void;
  onOpenBuyerProfile: (buyerName: string) => void;
}

function partyDisplayName(parties: PartyRef[], id: Payer): string {
  if (id === 'me') return '🙋 وليد';
  return parties.find((party) => party.id === id)?.name ?? 'طرف';
}

function blankLineRow(): SaleLineFormRow {
  return { key: `sl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name: '', mode: 'weight', quantity: '', unit: '', unitPrice: '' };
}

function rowTotal(row: SaleLineFormRow): number {
  const price = typeof row.unitPrice === 'number' ? row.unitPrice : 0;
  if (row.mode === 'lot') return price;
  const qty = typeof row.quantity === 'number' ? row.quantity : 0;
  return qty * price;
}

export function SalesModal(props: SalesModalProps): ReactNode {
  const { isOpen, onClose, sales, parties, buyers, onSaveSale, onDeleteSale, onSavePayment, onDeletePayment, onOpenBuyerProfile } = props;

  const sortedSales = useMemo(() => {
    const list = [...(sales ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [sales]);

  // ---- sale form (new / edit) ----
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [rows, setRows] = useState<SaleLineFormRow[]>([blankLineRow()]);
  const [saleDate, setSaleDate] = useState(todayDateInput());
  const [isAdvance, setIsAdvance] = useState(false);
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [deductFromBalance, setDeductFromBalance] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [buyerSuggestOpen, setBuyerSuggestOpen] = useState(false);

  /** Smart buyer suggestions: normalized match from first letter, with live balance. */
  const buyerSuggestions = useMemo(() => {
    const q = normalizeArabic(buyerName.trim());
    const list = buyers ?? [];
    const ranked = (q === '' ? list : list.filter((b) => normalizeArabic(b.name).includes(q))).slice(0, 8);
    return ranked.map((b) => ({ id: b.id, name: b.name, balance: buyerBalance(b, sales ?? []) }));
  }, [buyerName, buyers, sales]);

  // ---- payment form (per sale) ----
  const [paySaleId, setPaySaleId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payDate, setPayDate] = useState(todayDateInput());
  const [payBy, setPayBy] = useState<Payer>('me');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFormOpen(false);
      setEditingId(null);
      setPaySaleId(null);
    }
  }, [isOpen]);

  function openNewForm(): void {
    setEditingId(null);
    setBuyerName('');
    setRows([blankLineRow()]);
    setSaleDate(todayDateInput());
    setIsAdvance(false);
    setHasDeposit(false);
    setDepositAmount('');
    setDeductFromBalance(false);
    setNotes('');
    setFormError('');
    setFormOpen(true);
  }

  function openEditForm(sale: PartnershipSale): void {
    setEditingId(sale.id);
    setBuyerName(sale.buyerName);
    setRows(
      (sale.lines ?? []).map((line: SaleLine, i: number) => ({
        key: `sl-${sale.id}-${i}`,
        name: line.name,
        mode: line.mode === 'lot' ? 'lot' : 'weight',
        quantity: line.quantity,
        unit: line.unit ?? '',
        unitPrice: line.unitPrice,
      })),
    );
    try {
      setSaleDate(dateInputFromTimestamp(sale.date));
    } catch {
      setSaleDate(todayDateInput());
    }
    setIsAdvance(sale.isAdvance === true);
    setHasDeposit(false);
    setDepositAmount('');
    setDeductFromBalance(false);
    setNotes(sale.notes ?? '');
    setFormError('');
    setFormOpen(true);
  }

  const formTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

  function handleSubmitSale(event: React.FormEvent): void {
    event.preventDefault();
    if (buyerName.trim() === '') {
      setFormError('يرجى إدخال اسم المشتري.');
      return;
    }
    if (rows.length === 0) {
      setFormError('يرجى إضافة صنف واحد على الأقل.');
      return;
    }
    for (const [i, r] of rows.entries()) {
      if (r.name.trim() === '') {
        setFormError(`يرجى إدخال اسم الصنف رقم ${i + 1}.`);
        return;
      }
      if (r.mode !== 'lot' && (typeof r.quantity !== 'number' || r.quantity <= 0)) {
        setFormError(`يرجى إدخال كمية صحيحة للصنف رقم ${i + 1}.`);
        return;
      }
      if (typeof r.unitPrice !== 'number' || r.unitPrice < 0) {
        setFormError(`يرجى إدخال سعر صحيح للصنف رقم ${i + 1}.`);
        return;
      }
    }
    if (formTotal <= 0) {
      setFormError('إجمالي البيع يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (saleDate.trim() === '') {
      setFormError('يرجى اختيار التاريخ.');
      return;
    }
    const deposit = hasDeposit && editingId === null ? (typeof depositAmount === 'number' ? depositAmount : 0) : 0;
    if (hasDeposit && editingId === null) {
      if (deposit <= 0) {
        setFormError('يرجى إدخال مبلغ العربون.');
        return;
      }
      if (deposit > formTotal) {
        setFormError('مبلغ العربون لا يمكن أن يتجاوز إجمالي البيع.');
        return;
      }
    }
    const matchedBuyer = (buyers ?? []).find((b) => b.name.trim() !== '' && b.name.trim() === buyerName.trim());
    onSaveSale(
      {
        buyerName: buyerName.trim(),
        buyerId: matchedBuyer?.id,
        lines: rows.map((r) => ({
          name: r.name.trim(),
          mode: r.mode,
          quantity: r.mode === 'lot' ? 1 : Number(r.quantity),
          unit: r.mode === 'lot' ? undefined : (r.unit.trim() === '' ? undefined : r.unit.trim()),
          unitPrice: Number(r.unitPrice),
        })),
        dateInput: saleDate,
        isAdvance,
        hasDeposit: hasDeposit && editingId === null,
        depositAmount: deposit,
        deductFromBalance: deductFromBalance && editingId === null,
        notes: notes.trim(),
      },
      editingId,
    );
    setFormOpen(false);
    setEditingId(null);
  }

  function openPayForm(saleId: string): void {
    setPaySaleId(saleId);
    setPayAmount('');
    setPayDate(todayDateInput());
    setPayBy('me');
    setPayNotes('');
    setPayError('');
  }

  function handleSubmitPayment(event: React.FormEvent, saleId: string): void {
    event.preventDefault();
    if (payAmount === '' || Number(payAmount) <= 0) {
      setPayError('يرجى إدخال مبلغ أكبر من الصفر.');
      return;
    }
    if (payDate.trim() === '') {
      setPayError('يرجى اختيار التاريخ.');
      return;
    }
    onSavePayment(saleId, { amount: Number(payAmount), dateInput: payDate, by: payBy, notes: payNotes.trim() }, null);
    setPaySaleId(null);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛒 المباع (مبيعات الشراكة)">
      <div className="space-y-4 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {sortedSales.length} بيعة
          </span>
          <button type="button" onClick={openNewForm} className="btn-primary">
            + بيعة جديدة
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleSubmitSale} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">اسم المشتري <span className="text-rose-500">*</span></label>
                <input
                  value={buyerName}
                  onChange={(e) => { setBuyerName(e.target.value); setBuyerSuggestOpen(true); }}
                  onFocus={() => setBuyerSuggestOpen(true)}
                  onBlur={() => window.setTimeout(() => setBuyerSuggestOpen(false), 150)}
                  placeholder="اكتب أول حرف للاقتراح من المسجلين"
                  className="input"
                  autoComplete="off"
                />
                {buyerSuggestOpen && buyerSuggestions.length > 0 ? (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {buyerSuggestions.map((buyer) => (
                      <button
                        key={buyer.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setBuyerName(buyer.name); setBuyerSuggestOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-100">{buyer.name}</span>
                        {buyer.balance !== null ? (
                          <span className={`font-mono text-xs ${buyer.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                            رصيد {buyer.balance.toFixed(2)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
                <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="input" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500">الأصناف <span className="text-rose-500">*</span></label>
                <button type="button" onClick={() => setRows((prev) => [...prev, blankLineRow()])} className="btn-ghost px-3 py-1 text-xs">
                  + صنف
                </button>
              </div>
              {rows.map((row, i) => (
                <div key={row.key} className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-500">صنف {i + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== row.key)))}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={row.name} onChange={(e) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))} placeholder="اسم الصنف" className="input" />
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, mode: 'weight' } : r)))}
                        className={row.mode === 'weight' ? 'btn-primary px-2 py-1 text-xs' : 'btn-ghost px-2 py-1 text-xs'}
                      >
                        ⚖️ وزن
                      </button>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, mode: 'lot' } : r)))}
                        className={row.mode === 'lot' ? 'btn-primary px-2 py-1 text-xs' : 'btn-ghost px-2 py-1 text-xs'}
                      >
                        📦 لوط
                      </button>
                    </div>
                    {row.mode === 'lot' ? (
                      <input type="number" min={0} step="any" value={row.unitPrice} onChange={(e) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, unitPrice: e.target.value === '' ? '' : Number(e.target.value) } : r)))} placeholder="إجمالي سعر اللوط" className="input" />
                    ) : (
                      <>
                        <input value={row.unit} onChange={(e) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, unit: e.target.value } : r)))} placeholder="الوحدة (اختياري)" className="input" />
                        <input type="number" min={0} step="any" value={row.quantity} onChange={(e) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, quantity: e.target.value === '' ? '' : Number(e.target.value) } : r)))} placeholder="الكمية (طن)" className="input" />
                        <input type="number" min={0} step="any" value={row.unitPrice} onChange={(e) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, unitPrice: e.target.value === '' ? '' : Number(e.target.value) } : r)))} placeholder="سعر الطن" className="input" />
                      </>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-slate-500">
                    الإجمالي: <span className="font-mono" dir="ltr">{rowTotal(row).toFixed(2)}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                الإجمالي: <span className="font-mono" dir="ltr">{formTotal.toFixed(2)}</span>
              </span>
            </div>
            {editingId === null ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={hasDeposit} onChange={(e) => setHasDeposit(e.target.checked)} className="h-4 w-4" />
                    💵 عربون (مبلغ مقدم كاش)
                  </span>
                  {hasDeposit ? (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="مبلغ العربون"
                      className="input max-w-[160px]"
                    />
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">بدون عربون = بيعة كاش خالصة بكامل المبلغ</span>
                  )}
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={deductFromBalance} onChange={(e) => setDeductFromBalance(e.target.checked)} className="h-4 w-4" />
                  💳 خصم من رصيد المشتري (الباقي = الإجمالي − العربون، حتى لو بالسالب)
                </label>
              </div>
            ) : null}
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="input" />
            {formError !== '' && <p className="text-xs font-bold text-rose-600">{formError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary flex-1">{editingId ? '💾 حفظ التعديل' : '+ حفظ البيعة'}</button>
              <button type="button" onClick={() => { setFormOpen(false); setEditingId(null); }} className="btn-ghost flex-1">إلغاء</button>
            </div>
          </form>
        ) : null}

        {sortedSales.length > 0 ? (
          <div className="space-y-3">
            {sortedSales.map((sale) => {
              const paid = salePaid(sale);
              const remaining = saleRemaining(sale);
              const status = saleStatus(sale);
              return (
                <div key={sale.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenBuyerProfile(sale.buyerName)}
                          className="text-base font-black text-brand-700 underline decoration-dotted underline-offset-4 hover:text-brand-600 dark:text-brand-300"
                          title="فتح بروفايل المشتري"
                        >
                          {sale.buyerName}
                        </button>
                        <span className="chip-brand">{SALE_STATUS_LABELS[status]}</span>
                        {sale.isAdvance === true && <span className="chip">📝 عربون</span>}
                        <AuditBadge createdBy={sale.createdBy} createdAt={sale.createdAt} updatedBy={sale.updatedBy} updatedAt={sale.updatedAt} />
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(sale.date)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditForm(sale)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSale(sale.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {(sale.lines ?? []).map((line, i) => (
                      <p key={i} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        • {line.name} {(line.mode ?? 'weight') === 'lot' ? '📦' : '⚖️'} — <span className="font-mono" dir="ltr">{line.quantity}{line.unit ? ` ${line.unit}` : ''} × {formatCurrency(line.unitPrice)}</span> = <span className="font-mono font-bold" dir="ltr">{formatCurrency(line.total)}</span>
                      </p>
                    ))}
                  </div>
                  {sale.notes ? <p className="mt-1 text-xs font-medium text-slate-500">📝 {sale.notes}</p> : null}

                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                      <div className="text-slate-500">الإجمالي</div>
                      <div className="font-mono" dir="ltr">{formatCurrency(sale.totalAmount)}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950">
                      <div className="text-emerald-600">المحصّل</div>
                      <div className="font-mono" dir="ltr">{formatCurrency(paid)}</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
                      <div className="text-amber-600">المتبقي</div>
                      <div className="font-mono" dir="ltr">{formatCurrency(remaining)}</div>
                    </div>
                  </div>

                  {(sale.payments ?? []).length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {(sale.payments ?? []).map((pay) => (
                        <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black" dir="ltr">{formatCurrency(pay.amount)}</span>
                            <span className="chip">{(pay.source ?? 'cash') === 'balance' ? '💳 من الرصيد' : '💵 كاش'}</span>
                            <span className="chip">{partyDisplayName(parties, pay.by)}</span>
                            <span className="text-slate-400">{formatDate(pay.date)}</span>
                            {pay.notes !== '' ? <span className="text-slate-500">{pay.notes}</span> : null}
                            <AuditBadge createdBy={pay.createdBy} createdAt={pay.createdAt} updatedBy={pay.updatedBy} updatedAt={pay.updatedAt} />
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeletePayment(sale.id, pay.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {paySaleId === sale.id ? (
                    <form onSubmit={(e) => handleSubmitPayment(e, sale.id)} className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
                      <div className="min-w-[90px] flex-1">
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">المبلغ</label>
                        <input type="number" min={0} step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="input" />
                      </div>
                      <div className="min-w-[110px] flex-1">
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">المستلم</label>
                        <select value={payBy} onChange={(e) => setPayBy(e.target.value as Payer)} className="input">
                          {parties.map((party) => (
                            <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-[110px] flex-1">
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
                        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input" />
                      </div>
                      <div className="min-w-[120px] flex-[2]">
                        <label className="mb-1 block text-[11px] font-bold text-slate-500">بيان</label>
                        <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="اختياري" className="input" />
                      </div>
                      <button type="submit" className="btn-primary">+ تحصيل</button>
                      <button type="button" onClick={() => setPaySaleId(null)} className="btn-ghost">إلغاء</button>
                      {payError !== '' && <p className="w-full text-xs font-bold text-rose-600">{payError}</p>}
                    </form>
                  ) : (
                    <button type="button" onClick={() => openPayForm(sale.id)} className="btn-ghost mt-2 w-full">
                      + تحصيل دفعة
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-400">لا مبيعات بعد — سجّل أول بيعة.</p>
        )}
      </div>
    </Modal>
  );
}
