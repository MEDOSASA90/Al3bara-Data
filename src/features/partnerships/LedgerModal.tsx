import { useMemo, useState, type ReactNode } from 'react';
import type { Payer, PartnershipTx, PartyRef } from '../../domain/types';
import { formatCurrency, formatDate } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { TxModal, type PartnershipTxFormData } from './TxModal';

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Render inline in the page instead of a popup. */
  inline?: boolean;
  txs: PartnershipTx[];
  parties: PartyRef[];
  onSaveTx: (data: PartnershipTxFormData, existingId: string | null) => void;
  onDeleteTx: (txId: string) => void;
}

const KIND_LABELS: Record<string, string> = {
  expense: '💸 مصروف',
  sale: '💰 بيع',
  reimbursement: '🔄 سداد',
  refund: '↩️ مرتجع',
};

function partyDisplayName(parties: PartyRef[], id: Payer): string {
  if (id === 'me') return '🙋 وليد';
  return parties.find((party) => party.id === id)?.name ?? 'طرف';
}

export function LedgerModal(props: LedgerModalProps): ReactNode {
  const { isOpen, onClose, inline, txs, parties, onSaveTx, onDeleteTx } = props;
  const [txModal, setTxModal] = useState<{ open: boolean; txId: string | null }>({ open: false, txId: null });
  const [reimbAmount, setReimbAmount] = useState<number | ''>('');
  const firstPartnerId = parties.find((party) => party.id !== 'me')?.id ?? 'me';
  const [reimbFrom, setReimbFrom] = useState<Payer>(firstPartnerId);
  const [reimbTo, setReimbTo] = useState<Payer>('me');

  const sortedTxs = useMemo(() => {
    const list = [...(txs ?? [])];
    list.sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return list;
  }, [txs]);

  const editingTx = txModal.txId ? (txs ?? []).find((t) => t.id === txModal.txId) ?? null : null;

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

  const body = (
    <>
      <div className="space-y-4 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {sortedTxs.length} حركة
          </span>
          <button type="button" onClick={() => setTxModal({ open: true, txId: null })} className="btn-primary">
            + حركة
          </button>
        </div>

        <form onSubmit={handleQuickReimburse} className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
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
    </>
  );
  if (inline) {
    return (
      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black text-slate-900 dark:text-white">📒 الدفتر</h2>
        {body}
      </div>
    );
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📒 الدفتر (مصاريف / مبيعات / مرتجع / سداد)">
      {body}
    </Modal>
  );
}
