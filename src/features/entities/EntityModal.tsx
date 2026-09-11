import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Entity } from '../../domain/types';
import { Modal } from '../../components/ui/Modal';

export interface EntityFormData {
  name: string;
  buyerName: string;
  auctionDate: string;
}

export interface EntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EntityFormData) => void;
  entity: Entity | null;
  buyerNames: string[];
  onAddBuyer?: () => void;
}

function toDateInput(entity: Entity | null): string {
  if (entity) {
    try {
      return entity.auctionDate.toDate().toISOString().split('T')[0] ?? '';
    } catch {
      return '';
    }
  }
  return new Date().toISOString().split('T')[0] ?? '';
}

const inputClasses =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export function EntityModal({ isOpen, onClose, onSave, entity, buyerNames, onAddBuyer }: EntityModalProps) {
  const [name, setName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [auctionDate, setAuctionDate] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(entity?.name ?? '');
    setBuyerName(entity?.buyerName ?? '');
    setAuctionDate(toDateInput(entity));
  }, [entity, isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ name: name.trim(), buyerName, auctionDate });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entity ? 'تعديل بيانات الجهة' : 'إضافة جهة/جلسة جديدة'}>
      <form onSubmit={handleSubmit} dir="rtl" className="space-y-4 text-right">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم الجهة / الهيئة
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: شركة المياه، السكة الحديد..."
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم المشتري / المندوب
          </label>
          <select
            value={buyerName}
            onChange={(e) => {
              if (e.target.value === '__add_new__') {
                onAddBuyer?.();
              } else {
                setBuyerName(e.target.value);
              }
            }}
            className={inputClasses}
            required
          >
            <option value="">-- اختر مشتري --</option>
            {buyerNames.map((buyer) => (
              <option key={buyer} value={buyer}>
                {buyer}
              </option>
            ))}
            {onAddBuyer && (
              <option value="__add_new__" className="font-extrabold text-indigo-600">
                إضافة مشتري جديد...
              </option>
            )}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            تاريخ الجلسة
          </label>
          <input
            type="date"
            value={auctionDate}
            onChange={(e) => setAuctionDate(e.target.value)}
            className={inputClasses}
            required
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] min-h-[44px]"
          >
            {entity ? 'حفظ التعديلات' : 'إضافة الجلسة'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700 transition-all duration-200 hover:bg-slate-200 min-h-[44px] dark:bg-slate-800 dark:text-slate-200"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
