import { useEffect, useState, type ReactNode } from 'react';
import type { PartnershipItem, PricingMode } from '../../domain/types';
import { dateInputFromTimestamp, todayDateInput } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';

export interface DeliveryFormRow {
  key: string;
  dateInput: string;
  quantity: number | '';
  unitPrice: number | '';
}

export interface PartnershipItemFormData {
  name: string;
  mode: PricingMode;
  deliveries: { dateInput: string; quantity: number; unitPrice: number }[];
  notes: string;
}

interface ItemModalProps {
  isOpen: boolean;
  item: PartnershipItem | null;
  onClose: () => void;
  onSave: (data: PartnershipItemFormData) => void;
}

function rowTotal(row: DeliveryFormRow): number {
  const qty = typeof row.quantity === 'number' ? row.quantity : 0;
  const price = typeof row.unitPrice === 'number' ? row.unitPrice : 0;
  return qty * price;
}

function blankRow(): DeliveryFormRow {
  return { key: `del-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, dateInput: todayDateInput(), quantity: '', unitPrice: '' };
}

export function ItemModal(props: ItemModalProps): ReactNode {
  const { isOpen, item, onClose, onSave } = props;
  const [name, setName] = useState('');
  const [mode, setMode] = useState<PricingMode>('lot');
  const [rows, setRows] = useState<DeliveryFormRow[]>([blankRow()]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(item?.name ?? '');
    setMode(item?.mode ?? 'lot');
    const existing = item?.deliveries ?? [];
    if (existing.length > 0) {
      setRows(
        existing.map((d, i) => {
          let dateInput = todayDateInput();
          try {
            dateInput = dateInputFromTimestamp(d.date);
          } catch {
            dateInput = todayDateInput();
          }
          return { key: `${d.id || i}-${i}`, dateInput, quantity: d.quantity, unitPrice: d.unitPrice };
        }),
      );
    } else if ((item?.quantity ?? 0) > 0 || (item?.buyCost ?? 0) > 0) {
      // Legacy item: prefill one row from quantity/buyCost.
      const qty = item?.quantity ?? '';
      const cost = item?.buyCost ?? 0;
      const unit = typeof qty === 'number' && qty > 0 ? cost / qty : cost;
      setRows([{ key: 'legacy-0', dateInput: todayDateInput(), quantity: qty, unitPrice: unit }]);
    } else {
      setRows([blankRow()]);
    }
    setNotes(item?.notes ?? '');
    setError('');
  }, [isOpen, item]);

  const qtyLabel = mode === 'weight' ? 'الكمية (طن)' : 'الكمية (لوط)';
  const totalQty = rows.reduce((sum, r) => sum + (typeof r.quantity === 'number' ? r.quantity : 0), 0);
  const totalCost = rows.reduce((sum, r) => sum + rowTotal(r), 0);

  function updateRow(key: string, patch: Partial<DeliveryFormRow>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string): void {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (name.trim() === '') {
      setError('يرجى إدخال اسم الصنف.');
      return;
    }
    if (rows.length === 0) {
      setError('يرجى إضافة توريدة واحدة على الأقل.');
      return;
    }
    for (const [i, r] of rows.entries()) {
      if (r.dateInput.trim() === '') {
        setError(`يرجى اختيار تاريخ التوريدة رقم ${i + 1}.`);
        return;
      }
      if (typeof r.quantity !== 'number' || r.quantity <= 0) {
        setError(`يرجى إدخال كمية صحيحة للتوريدة رقم ${i + 1}.`);
        return;
      }
      if (typeof r.unitPrice !== 'number' || r.unitPrice < 0) {
        setError(`يرجى إدخال سعر صحيح للتوريدة رقم ${i + 1}.`);
        return;
      }
    }
    if (totalCost <= 0) {
      setError('إجمالي التكلفة يجب أن يكون أكبر من الصفر.');
      return;
    }
    onSave({
      name: name.trim(),
      mode,
      deliveries: rows.map((r) => ({
        dateInput: r.dateInput,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unitPrice),
      })),
      notes: notes.trim(),
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'تعديل الصنف' : 'إضافة صنف مشترك'}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم الصنف <span className="text-rose-500">*</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم البضاعة" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">طريقة التسعير</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('lot')} className={mode === 'lot' ? 'btn-primary' : 'btn-ghost'}>
              📦 لوط
            </button>
            <button type="button" onClick={() => setMode('weight')} className={mode === 'weight' ? 'btn-primary' : 'btn-ghost'}>
              ⚖️ وزن
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              التوريدات <span className="text-rose-500">*</span>
            </label>
            <button type="button" onClick={() => setRows((prev) => [...prev, blankRow()])} className="btn-ghost px-3 py-1 text-xs">
              + توريدة
            </button>
          </div>
          {rows.map((row, i) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-500">توريدة {i + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  >
                    حذف
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">التاريخ</label>
                  <input type="date" value={row.dateInput} onChange={(e) => updateRow(row.key, { dateInput: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">{qtyLabel}</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">سعر الوحدة</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="0"
                    className="input"
                  />
                </div>
              </div>
              <p className="text-[11px] font-bold text-slate-500">
                الإجمالي: <span className="font-mono" dir="ltr">{rowTotal(row).toFixed(2)}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <span>
            إجمالي الكمية: <span className="font-mono" dir="ltr">{totalQty}</span>
          </span>
          <span>
            إجمالي التكلفة: <span className="font-mono" dir="ltr">{totalCost.toFixed(2)}</span>
          </span>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">ملاحظات</label>
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
