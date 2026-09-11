import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../../components/ui/Modal';

export interface LoadingFormData {
  loaderName: string;
  date: Date;
}

export interface LoadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LoadingFormData) => void;
}

function todayInput(): string {
  return new Date().toLocaleDateString('en-CA');
}

function parseDateInput(raw: string): Date {
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day);
}

const inputClasses =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export function LoadingModal({ isOpen, onClose, onSave }: LoadingModalProps) {
  const [loaderName, setLoaderName] = useState('');
  const [date, setDate] = useState(todayInput());

  useEffect(() => {
    if (!isOpen) return;
    setLoaderName('');
    setDate(todayInput());
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ loaderName: loaderName.trim(), date: parseDateInput(date) });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل بيانات شحن وتحميل اللوط">
      <form onSubmit={handleSubmit} dir="rtl" className="space-y-4 text-right">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم القائم بالتحميل / الشحن
          </label>
          <input
            type="text"
            value={loaderName}
            onChange={(e) => setLoaderName(e.target.value)}
            placeholder="أدخل اسم السائق أو شركة الشحن"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            تاريخ التحميل والشحن
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
            required
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] min-h-[44px]"
          >
            حفظ ونقل للأرشيف
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
