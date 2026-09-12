import { useMemo, useState, type ReactNode } from 'react';
import type { PartnershipBuyer, PartnershipSale, PartyRef } from '../../domain/types';
import { buyerBalance, buyerSales } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { BuyerAccountModal, type BuyerTopUpFormData } from './BuyerAccountModal';

export interface NewBuyerFormData {
  name: string;
  phone: string;
  notes: string;
}

interface BuyersModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyers: PartnershipBuyer[];
  sales: PartnershipSale[];
  parties: PartyRef[];
  onAddBuyer: (data: NewBuyerFormData) => void;
  onTopUp: (buyerId: string, data: BuyerTopUpFormData) => void;
}

export function BuyersModal(props: BuyersModalProps): ReactNode {
  const { isOpen, onClose, buyers, sales, parties, onAddBuyer, onTopUp } = props;
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [openBuyerId, setOpenBuyerId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = [...(buyers ?? [])];
    list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return list.map((buyer) => ({
      buyer,
      balance: buyerBalance(buyer, sales ?? []),
      salesCount: buyerSales(buyer, sales ?? []).length,
    }));
  }, [buyers, sales]);

  const openBuyer = openBuyerId ? (buyers ?? []).find((b) => b.id === openBuyerId) ?? null : null;

  function submitBuyer(event: React.FormEvent): void {
    event.preventDefault();
    if (name.trim() === '') {
      setError('يرجى إدخال اسم المشتري.');
      return;
    }
    if ((buyers ?? []).some((b) => b.name.trim() === name.trim())) {
      setError('هذا المشتري مسجل بالفعل.');
      return;
    }
    onAddBuyer({ name: name.trim(), phone: phone.trim(), notes: notes.trim() });
    setFormOpen(false);
    setName('');
    setPhone('');
    setNotes('');
    setError('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧑‍🤝‍🧑 المشتريين">
      <div className="space-y-4 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{rows.length} مشتري</span>
          <button type="button" onClick={() => { setFormOpen((v) => !v); setError(''); }} className="btn-primary">
            + مشتري جديد
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={submitBuyer} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">الاسم <span className="text-rose-500">*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المشتري" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">الهاتف</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="اختياري" className="input" dir="ltr" />
              </div>
            </div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="input" />
            {error !== '' && <p className="text-xs font-bold text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">+ حفظ المشتري</button>
              <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost flex-1">إلغاء</button>
            </div>
          </form>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map(({ buyer, balance, salesCount }) => (
              <button
                key={buyer.id}
                type="button"
                onClick={() => setOpenBuyerId(buyer.id)}
                className="w-full rounded-xl border border-slate-200/70 p-3 text-right transition hover:shadow-pop dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-black text-brand-700 dark:text-brand-300">{buyer.name}</span>
                  <span className={`font-mono text-sm font-black ${balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                    {formatCurrency(balance)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  {buyer.phone ? `📞 ${buyer.phone} • ` : ''}{salesCount} بيعة • اضغط لفتح الحساب
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-400">لا مشتريين بعد — سجّل أول مشتري.</p>
        )}
      </div>
      {openBuyer !== null ? (
        <BuyerAccountModal
          isOpen
          onClose={() => setOpenBuyerId(null)}
          buyer={openBuyer}
          sales={buyerSales(openBuyer, sales ?? [])}
          balance={buyerBalance(openBuyer, sales ?? [])}
          parties={parties}
          onTopUp={onTopUp}
        />
      ) : null}
    </Modal>
  );
}
