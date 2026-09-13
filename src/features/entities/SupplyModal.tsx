import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ImageRef } from '../../domain/types';
import { Modal } from '../../components/ui/Modal';

export interface SupplyFormData {
  payerName: string;
  date: Date;
  receiptImage?: ImageRef;
  /** Omitted/undefined = pay the full remaining 70%. A number = partial payment. */
  amount?: number;
}

export interface SupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SupplyFormData) => void;
  title: string;
  onFileUpload: (file: File, prefix: string) => Promise<ImageRef | undefined>;
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

export function SupplyModal({ isOpen, onClose, onSave, title, onFileUpload }: SupplyModalProps) {
  const [payerName, setPayerName] = useState('');
  const [date, setDate] = useState(todayInput());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [partialMode, setPartialMode] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPayerName('');
    setDate(todayInput());
    setReceiptFile(null);
    setPartialMode(false);
    setAmount('');
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const partialAmount = partialMode && amount.trim() !== '' ? Number(amount) : undefined;
    const done = (receiptImage: ImageRef | undefined) => {
      onSave({
        payerName: payerName.trim(),
        date: parseDateInput(date),
        receiptImage,
        amount: partialAmount,
      });
      onClose();
    };
    if (receiptFile) {
      setIsUploading(true);
      onFileUpload(receiptFile, 'receipt')
        .then((uploaded) => {
          setIsUploading(false);
          done(uploaded);
        })
        .catch(() => {
          setIsUploading(false);
        });
      return;
    }
    done(undefined);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} dir="rtl" className="space-y-4 text-right">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم القائم بالدفع
          </label>
          <input
            type="text"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="أدخل اسم الشخص الذي قام بالسداد"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">تاريخ الدفع</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
            required
          />
        </div>

        {/* Partial payment option: record part of the 70% now, rest later. */}
        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={partialMode}
              onChange={(e) => setPartialMode(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            💰 دفعة جزئية (سداد جزء من الـ 70% والباقي بعدين)
          </label>
          {partialMode ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مبلغ الدفعة الجزئية"
              className={`${inputClasses} mt-2`}
              required
            />
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">
            إرفاق إيصال الدفع / الإيداع
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="receipt-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] ?? null : null)}
            />
            <label
              htmlFor="receipt-upload"
              className="cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 transition-all duration-150 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              {receiptFile ? 'تغيير الملف' : 'اختيار ملف الصورة'}
            </label>
            <span className="min-w-0 flex-1 truncate text-xs break-words sm:max-w-[240px] text-slate-500 dark:text-slate-400">
              {receiptFile ? receiptFile.name : 'لا يوجد ملف مرفق'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            disabled={isUploading}
            className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 min-h-[44px]"
          >
            {isUploading ? 'جاري الرفع...' : 'تأكيد وحفظ التوريد'}
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
