import { useMemo, useState, type ReactNode } from 'react';
import type { BuyerTopUp, Payer, PartnershipBuyer, PartnershipSale, PartyRef } from '../../domain/types';
import { salePaid, saleRemaining, saleStatus, SALE_STATUS_LABELS } from '../../domain/finance';
import { formatCurrency, formatDate, todayDateInput } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { AuditBadge } from './AuditBadge';

export interface BuyerTopUpFormData {
  amount: number;
  dateInput: string;
  by: Payer;
  notes: string;
}

function partyDisplayName(parties: PartyRef[], id: Payer): string {
  if (id === 'me') return '🙋 وليد';
  return parties.find((party) => party.id === id)?.name ?? 'طرف';
}

function SaleDetailsModal(props: { sale: PartnershipSale; parties: PartyRef[]; onClose: () => void }): ReactNode {
  const { sale, parties, onClose } = props;
  const paid = salePaid(sale);
  const remaining = saleRemaining(sale);
  return (
    <Modal isOpen onClose={onClose} title={`🧾 بيعة ${sale.buyerName}`}>
      <div className="space-y-3 text-right" dir="rtl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-brand">{SALE_STATUS_LABELS[saleStatus(sale)]}</span>
          {sale.isAdvance === true && <span className="chip">📝 عربون</span>}
          <span className="text-[11px] font-semibold text-slate-400">{formatDate(sale.date)}</span>
          <AuditBadge createdBy={sale.createdBy} createdAt={sale.createdAt} updatedBy={sale.updatedBy} updatedAt={sale.updatedAt} />
        </div>
        <div className="space-y-1">
          {(sale.lines ?? []).map((line, i) => (
            <p key={i} className="text-xs font-medium text-slate-600 dark:text-slate-300">
              • {line.name} {(line.mode ?? 'weight') === 'lot' ? '📦' : '⚖️'} —{' '}
              <span className="font-mono" dir="ltr">{line.quantity}{line.unit ? ` ${line.unit}` : ''} × {formatCurrency(line.unitPrice)}</span> ={' '}
              <span className="font-mono font-bold" dir="ltr">{formatCurrency(line.total)}</span>
            </p>
          ))}
        </div>
        {sale.notes ? <p className="text-xs font-medium text-slate-500">📝 {sale.notes}</p> : null}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
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
          <div className="space-y-1.5">
            {(sale.payments ?? []).map((pay) => (
              <div key={pay.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
                <span className="font-mono font-black" dir="ltr">{formatCurrency(pay.amount)}</span>
                <span className="chip">{(pay.source ?? 'cash') === 'balance' ? '💳 من الرصيد' : '💵 كاش'}</span>
                <span className="chip">{partyDisplayName(parties, pay.by)}</span>
                <span className="text-slate-400">{formatDate(pay.date)}</span>
                {pay.notes !== '' ? <span className="text-slate-500">{pay.notes}</span> : null}
                <AuditBadge createdBy={pay.createdBy} createdAt={pay.createdAt} updatedBy={pay.updatedBy} updatedAt={pay.updatedAt} />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs font-medium text-slate-400">لا تحصيلات على هذه البيعة.</p>
        )}
      </div>
    </Modal>
  );
}

function TopUpRow(props: { topUp: BuyerTopUp; parties: PartyRef[] }): ReactNode {
  const { topUp, parties } = props;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs dark:bg-emerald-950/40">
      <span className="font-mono font-black" dir="ltr">{formatCurrency(topUp.amount)}</span>
      <span className="chip">{partyDisplayName(parties, topUp.by)}</span>
      <span className="text-slate-400">{formatDate(topUp.date)}</span>
      {topUp.notes !== '' ? <span className="text-slate-500">{topUp.notes}</span> : null}
      <AuditBadge createdBy={topUp.createdBy} createdAt={topUp.createdAt} updatedBy={topUp.updatedBy} updatedAt={topUp.updatedAt} />
    </div>
  );
}

interface BuyerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyer: PartnershipBuyer;
  sales: PartnershipSale[];
  balance: number;
  parties: PartyRef[];
  onTopUp: (buyerId: string, data: BuyerTopUpFormData) => void;
}

export function BuyerAccountModal(props: BuyerAccountModalProps): ReactNode {
  const { isOpen, onClose, buyer, sales, balance, parties, onTopUp } = props;
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [dateInput, setDateInput] = useState(todayDateInput());
  const [by, setBy] = useState<Payer>('me');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [detailsSale, setDetailsSale] = useState<PartnershipSale | null>(null);

  const sortedSales = useMemo(() => {
    const list = [...(sales ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [sales]);

  const sortedTopUps = useMemo(() => {
    const list = [...(buyer.topUps ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [buyer.topUps]);

  function submitTopUp(event: React.FormEvent): void {
    event.preventDefault();
    if (amount === '' || Number(amount) <= 0) {
      setError('يرجى إدخال مبلغ أكبر من الصفر.');
      return;
    }
    if (dateInput.trim() === '') {
      setError('يرجى اختيار التاريخ.');
      return;
    }
    onTopUp(buyer.id, { amount: Number(amount), dateInput, by, notes: notes.trim() });
    setTopUpOpen(false);
    setAmount('');
    setDateInput(todayDateInput());
    setBy('me');
    setNotes('');
    setError('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🧑‍🤝‍🧑 حساب ${buyer.name}`}>
      <div className="space-y-4 text-right" dir="rtl">
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
          <div className={`rounded-xl p-3 ${balance < 0 ? 'bg-rose-50 dark:bg-rose-950' : 'bg-emerald-50 dark:bg-emerald-950'}`}>
            <div className={`mb-1 ${balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>الرصيد الحالي</div>
            <div className="font-mono text-base" dir="ltr">{formatCurrency(balance)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="mb-1 text-slate-500">عدد البيعات</div>
            <div className="font-mono text-base" dir="ltr">{sortedSales.length}</div>
          </div>
        </div>
        {buyer.phone ? <p className="text-xs font-bold text-slate-500">📞 {buyer.phone}</p> : null}
        {buyer.notes ? <p className="text-xs font-medium text-slate-500">📝 {buyer.notes}</p> : null}
        <AuditBadge createdBy={buyer.createdBy} createdAt={buyer.createdAt} updatedBy={buyer.updatedBy} updatedAt={buyer.updatedAt} />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">💰 الأرصدة المضافة ({sortedTopUps.length})</h3>
            <button type="button" onClick={() => { setTopUpOpen((v) => !v); setError(''); }} className="btn-primary px-3 py-1 text-xs">
              + إضافة رصيد
            </button>
          </div>
          {topUpOpen ? (
            <form onSubmit={submitTopUp} className="flex flex-wrap items-end gap-2 rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
              <div className="min-w-[90px] flex-1">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">المبلغ</label>
                <input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className="input" />
              </div>
              <div className="min-w-[110px] flex-1">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">المستلم</label>
                <select value={by} onChange={(e) => setBy(e.target.value as Payer)} className="input">
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>{partyDisplayName(parties, party.id)}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[110px] flex-1">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
                <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="input" />
              </div>
              <div className="min-w-[120px] flex-[2]">
                <label className="mb-1 block text-[11px] font-bold text-slate-500">بيان</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" className="input" />
              </div>
              <button type="submit" className="btn-primary">+ إضافة</button>
              <button type="button" onClick={() => setTopUpOpen(false)} className="btn-ghost">إلغاء</button>
              {error !== '' && <p className="w-full text-xs font-bold text-rose-600">{error}</p>}
            </form>
          ) : null}
          {sortedTopUps.length > 0 ? (
            <div className="space-y-1.5">
              {sortedTopUps.map((t) => (
                <TopUpRow key={t.id} topUp={t} parties={parties} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs font-medium text-slate-400">لا أرصدة مضافة بعد.</p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">🛒 بيعات المشتري ({sortedSales.length}) — اضغط أي بيعة للتفاصيل</h3>
          {sortedSales.length > 0 ? (
            <div className="space-y-2">
              {sortedSales.map((sale) => {
                const paid = salePaid(sale);
                const remaining = saleRemaining(sale);
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => setDetailsSale(sale)}
                    className="w-full rounded-xl border border-slate-200/70 p-3 text-right transition hover:shadow-pop dark:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black" dir="ltr">{formatCurrency(sale.totalAmount)}</span>
                      <span className="chip-brand">{SALE_STATUS_LABELS[saleStatus(sale)]}</span>
                      {sale.isAdvance === true && <span className="chip">📝 عربون</span>}
                      <span className="text-[11px] font-semibold text-slate-400">{formatDate(sale.date)}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                      المحصّل <span className="font-mono" dir="ltr">{formatCurrency(paid)}</span> • المتبقي <span className="font-mono" dir="ltr">{formatCurrency(remaining)}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-center text-xs font-medium text-slate-400">لا بيعات لهذا المشتري بعد.</p>
          )}
        </div>
      </div>
      {detailsSale !== null ? (
        <SaleDetailsModal sale={detailsSale} parties={parties} onClose={() => setDetailsSale(null)} />
      ) : null}
    </Modal>
  );
}
