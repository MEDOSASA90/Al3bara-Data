import { useEffect, useState, type ReactNode } from 'react';
import type { Payer, PartnershipTx, PartnershipTxKind, PartyRef } from '../../domain/types';
import { dateInputFromTimestamp, todayDateInput } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';

export interface PartnershipTxFormData {
  kind: PartnershipTxKind;
  amount: number;
  paidBy: Payer;
  deliveredBy?: Payer;
  reimburseTo: Payer;
  notes: string;
  dateInput: string;
}

interface TxModalProps {
  isOpen: boolean;
  tx: PartnershipTx | null;
  parties: PartyRef[];
  onClose: () => void;
  onSave: (data: PartnershipTxFormData) => void;
}

const KIND_LABELS: Record<PartnershipTxKind, string> = {
  expense: '💸 مصروف',
  sale: '💰 بيع (تحصيل)',
  reimbursement: '🔄 سداد بين الشريكين',
  refund: '↩️ مرتجع',
};

export function TxModal(props: TxModalProps): ReactNode {
  const { isOpen, tx, parties, onClose, onSave } = props;
  const otherParties = parties.filter((party) => party.id !== 'me');
  const defaultReceiver = otherParties[0]?.id ?? 'me';
  const [kind, setKind] = useState<PartnershipTxKind>('expense');
  const [amount, setAmount] = useState<number | ''>('');
  const [paidBy, setPaidBy] = useState<Payer>('me');
  const [deliveredBy, setDeliveredBy] = useState<Payer>('me');
  const [reimburseTo, setReimburseTo] = useState<Payer>('partner');
  const [notes, setNotes] = useState('');
  const [dateInput, setDateInput] = useState(todayDateInput());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setKind(tx?.kind ?? 'expense');
    setAmount(tx?.amount ?? '');
    setPaidBy(tx?.paidBy ?? 'me');
    setDeliveredBy(tx?.deliveredBy ?? tx?.paidBy ?? 'me');
    setReimburseTo(tx?.reimburseTo ?? defaultReceiver);
    setNotes(tx?.notes ?? '');
    try {
      setDateInput(tx ? dateInputFromTimestamp(tx.date) : todayDateInput());
    } catch {
      setDateInput(todayDateInput());
    }
    setError('');
  }, [isOpen, tx, defaultReceiver]);

  useEffect(() => {
    // Keep reimbursement direction consistent: receiver differs from sender.
    if (kind === 'reimbursement' && reimburseTo === paidBy) {
      const fallback = parties.find((party) => party.id !== paidBy)?.id ?? 'me';
      setReimburseTo(fallback);
    }
  }, [kind, paidBy, reimburseTo, parties]);

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (amount === '' || Number(amount) <= 0) {
      setError('يرجى إدخال مبلغ أكبر من الصفر.');
      return;
    }
    if (dateInput.trim() === '') {
      setError('يرجى اختيار التاريخ.');
      return;
    }
    const data: PartnershipTxFormData = {
      kind,
      amount: Number(amount),
      paidBy,
      reimburseTo,
      notes: notes.trim(),
      dateInput,
    };
    if (kind !== 'reimbursement') data.deliveredBy = deliveredBy;
    onSave(data);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tx ? 'تعديل الحركة' : 'حركة جديدة في الدفتر'}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">نوع الحركة</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as PartnershipTxKind)} className="input">
            <option value="expense">{KIND_LABELS.expense}</option>
            {/* بيع/مرتجع للدفتر اتلغوا — المبيعات من قسم المباع. تظهر هنا فقط عند تعديل حركة قديمة. */}
            {tx?.kind === 'sale' ? <option value="sale">{KIND_LABELS.sale}</option> : null}
            {tx?.kind === 'refund' ? <option value="refund">{KIND_LABELS.refund}</option> : null}
            <option value="reimbursement">{KIND_LABELS.reimbursement}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">المبلغ</label>
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">التاريخ</label>
            <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="input" />
          </div>
        </div>
        {kind === 'reimbursement' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">من (الدافع)</label>
              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value as Payer)} className="input">
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>{party.id === 'me' ? '🙋 وليد' : `🤝 ${party.name}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">إلى (المستلم)</label>
              <select value={reimburseTo} onChange={(e) => setReimburseTo(e.target.value as Payer)} className="input">
                {parties.filter((party) => party.id !== paidBy).map((party) => (
                  <option key={party.id} value={party.id}>{party.id === 'me' ? '🙋 وليد' : `🤝 ${party.name}`}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                {kind === 'sale' ? 'من استلم مبلغ البيع؟' : kind === 'refund' ? 'من رد مبلغ المرتجع؟' : 'من دفع المصروف؟'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {parties.map((party) => (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => setPaidBy(party.id)}
                    className={paidBy === party.id ? 'btn-primary' : 'btn-ghost'}
                  >
                    {party.id === 'me' ? '🙋 وليد' : `🤝 ${party.name}`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">من سلّم المبلغ؟ (للتوضيح فقط)</label>
              <select value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value as Payer)} className="input">
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>{party.id === 'me' ? '🙋 وليد' : `🤝 ${party.name}`}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">بيان</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" className="input" />
        </div>
        {error !== '' && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">
            حفظ
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
