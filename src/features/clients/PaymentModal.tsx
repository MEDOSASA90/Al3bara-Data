import { useEffect, useState, type ReactNode } from 'react';
import type { Client, ImageRef } from '../../domain/types';
import { formatCurrency, formatDate } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';

export interface PaymentFormData {
  amount: number;
  date: Date;
  notes: string;
  linkedTransactionId?: string;
  receiptImage?: ImageRef;
}

export interface PaymentModalProps {
  isOpen: boolean;
  client: Client;
  onClose: () => void;
  onSave: (data: PaymentFormData) => void;
  onUpload: (file: File, prefix: string) => Promise<ImageRef | undefined>;
}

function todayInputValue(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function PaymentModal(props: PaymentModalProps): ReactNode {
  const { isOpen, client, onClose, onSave, onUpload } = props;
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState('');
  const [linkedTransactionId, setLinkedTransactionId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const unsettledTransactions = (client.transactions ?? []).filter((t) => !t.isSettled);

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setDate(todayInputValue());
    setNotes('');
    setLinkedTransactionId('');
    setReceiptFile(null);
    setIsUploading(false);
    setError('');
  }, [isOpen]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (typeof amount !== 'number' || amount <= 0) {
      setError('الرجاء إدخال مبلغ سداد صحيح أكبر من صفر.');
      return;
    }

    const parts = date.split('-').map(Number);
    const [year, month, day] = parts;
    if (year === undefined || month === undefined || day === undefined || !year || !month || !day) {
      setError('الرجاء إدخال تاريخ سداد صحيح.');
      return;
    }

    let receiptImage: ImageRef | undefined;
    if (receiptFile) {
      setIsUploading(true);
      setError('');
      try {
        receiptImage = await onUpload(receiptFile, 'payment_receipt');
        if (!receiptImage) {
          setError('فشل رفع صورة الإيصال.');
          setIsUploading(false);
          return;
        }
      } catch {
        setError('فشل رفع صورة الإيصال.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSave({
      amount,
      date: new Date(year, month - 1, day),
      notes,
      linkedTransactionId: linkedTransactionId === '' ? undefined : linkedTransactionId,
      receiptImage,
    });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`تسجيل سداد نقدي لـ ${client.name}`}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            مبلغ السداد (جنيه مصري)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
            placeholder="0.00"
            required
            min="0"
            step="any"
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">تاريخ السداد</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            ربط هذا السداد بفاتورة/حركة معينة (اختياري)
          </label>
          <select
            value={linkedTransactionId}
            onChange={(e) => setLinkedTransactionId(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">-- لا يوجد ربط (دفعة عامة لحساب العميل) --</option>
            {unsettledTransactions.map((t) => (
              <option key={t.id} value={t.id}>
                {`حركة بتاريخ ${formatDate(t.date)} - بمبلغ ${formatCurrency(t.amount)}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            ملاحظات وبيان السداد
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="مثال: تحويل بنكي، إيصال استلام نقدية..."
            className="w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">
            إرفاق صورة إيصال الاستلام (اختياري)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              id="receipt-upload"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <label
              htmlFor="receipt-upload"
              className="cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {receiptFile ? '🔄 تغيير الملف' : '📎 اختيار ملف الصورة'}
            </label>
            <span className="min-w-0 flex-1 truncate text-xs break-words text-slate-500 sm:max-w-[240px] dark:text-slate-400">
              {receiptFile ? receiptFile.name : 'لا يوجد ملف مرفق'}
            </span>
          </div>
        </div>

        {error !== '' && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            disabled={isUploading}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
          >
            {isUploading ? '🔄 جاري الرفع...' : '💾 تسجيل السداد'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
