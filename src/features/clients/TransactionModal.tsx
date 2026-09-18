import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Client, ImageRef, PredefinedItem, Transaction, TransactionItem } from '../../domain/types';
import { transactionItemsTotal } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';

export interface TransactionFormData {
  amount: number;
  notes: string;
  date: Date;
  items: TransactionItem[];
  isSettled: boolean;
  image?: ImageRef;
}

export interface TransactionModalProps {
  isOpen: boolean;
  client: Client;
  transaction: Transaction | null;
  predefinedItems: PredefinedItem[];
  onClose: () => void;
  onSave: (data: TransactionFormData) => void;
  onUpload: (file: File, prefix: string) => Promise<ImageRef | undefined>;
  onOpenPredefinedItemModal: () => void;
}

function toInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromInputValue(value: string): Date | null {
  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function newItemId(): string {
  return `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function TransactionModal(props: TransactionModalProps): ReactNode {
  const { isOpen, client, transaction, predefinedItems, onClose, onSave, onUpload, onOpenPredefinedItemModal } =
    props;
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [isSettled, setIsSettled] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [transactionImage, setTransactionImage] = useState<ImageRef | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  const itemsTotal = useMemo(
    () => (showItems && items.length > 0 ? transactionItemsTotal(items) : 0),
    [showItems, items],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (transaction) {
      setDate(transaction.date.toDate());
      setNotes(transaction.notes);
      setIsSettled(transaction.isSettled);
      const existing = transaction.items ?? [];
      setItems(existing);
      setShowItems(existing.length > 0);
      setTotalAmount(transaction.amount);
      setTransactionImage(transaction.image ?? null);
    } else {
      setDate(new Date());
      setNotes('');
      setIsSettled(false);
      setItems([]);
      setShowItems(false);
      setTotalAmount('');
      setTransactionImage(null);
    }
    setError('');
    setIsUploadingImage(false);
    setUploadingItemIndex(null);
  }, [isOpen, transaction]);

  function handleItemField(index: number, field: 'name' | 'quantity' | 'pricePerKilo', value: string | number): void {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleItemImage(index: number, file: File | null): Promise<void> {
    if (!file) return;
    setUploadingItemIndex(index);
    setError('');
    try {
      const ref = await onUpload(file, `item_${client.name}`);
      if (ref) {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, image: ref } : item)));
      } else {
        setError('فشل رفع صورة الصنف.');
      }
    } catch {
      setError('فشل رفع صورة الصنف.');
    } finally {
      setUploadingItemIndex(null);
    }
  }

  async function handleTransactionImage(file: File | null): Promise<void> {
    if (!file) return;
    setIsUploadingImage(true);
    setError('');
    try {
      const ref = await onUpload(file, `tx_${client.name}`);
      if (ref) {
        setTransactionImage(ref);
      } else {
        setError('فشل رفع صورة الحركة.');
      }
    } catch {
      setError('فشل رفع صورة الحركة.');
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const auto = showItems && items.length > 0;
    const finalAmount = auto ? itemsTotal : typeof totalAmount === 'number' ? totalAmount : 0;
    if (!auto && totalAmount === '') {
      setError('الرجاء إدخال المبلغ الإجمالي.');
      return;
    }
    onSave({
      amount: finalAmount,
      notes,
      date,
      items: auto ? items : [],
      isSettled,
      image: transactionImage ?? undefined,
    });
  }

  const autoTotal = showItems && items.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction ? `تعديل حركة لـ ${client.name}` : `إضافة حركة لـ ${client.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">تاريخ الحركة</label>
          <input
            type="date"
            value={toInputValue(date)}
            onChange={(e) => {
              const parsed = fromInputValue(e.target.value);
              if (parsed) setDate(parsed);
            }}
            required
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">أصناف ووزن البضاعة</span>
          <button
            type="button"
            onClick={() => setShowItems((prev) => !prev)}
            className="cursor-pointer text-xs font-extrabold text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-300"
          >
            {showItems ? '❌ إخفاء بنود الأصناف' : '➕ إضافة أصناف وأوزان مخصصة'}
          </button>
        </div>

        {showItems && (
          <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            {items.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                لا توجد أصناف مضافة. اضغط لإضافة صنف جديد.
              </p>
            ) : (
              <div className="space-y-3 divide-y divide-slate-200/60 dark:divide-slate-700">
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-1 items-center gap-2.5 pt-3 first:pt-0 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <select
                        value={item.name}
                        onChange={(e) => {
                          if (e.target.value === 'add_new') {
                            onOpenPredefinedItemModal();
                          } else {
                            handleItemField(index, 'name', e.target.value);
                          }
                        }}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">-- اختر صنف --</option>
                        {predefinedItems.map((pItem) => (
                          <option key={pItem.id} value={pItem.name}>
                            {pItem.name}
                          </option>
                        ))}
                        <option value="add_new" className="font-extrabold text-indigo-600">
                          ➕ إضافة صنف جديد...
                        </option>
                      </select>
                    </div>

                    <input
                      type="number"
                      placeholder="الوزن (كجم)"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemField(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="any"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />

                    <input
                      type="number"
                      placeholder="سعر الكيلو"
                      value={item.pricePerKilo || ''}
                      onChange={(e) => handleItemField(index, 'pricePerKilo', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="any"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />

                    <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-center font-mono text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                      {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                    </div>

                    <div className="flex items-center justify-between gap-1 md:justify-center">
                      <input
                        type="file"
                        id={`item-image-${index}`}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleItemImage(index, e.target.files?.[0] ?? null)}
                        disabled={uploadingItemIndex === index}
                      />
                      <label
                        htmlFor={`item-image-${index}`}
                        className={`cursor-pointer rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 ${
                          uploadingItemIndex === index ? 'cursor-wait opacity-50' : ''
                        }`}
                      >
                        {uploadingItemIndex === index ? 'جاري...' : item.image ? '📸 تم' : '📎 صورة'}
                      </label>

                      {item.image && (
                        <a
                          href={item.image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-1 text-[10px] font-semibold text-indigo-600 hover:underline"
                        >
                          عرض
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        title="حذف هذا الصنف"
                        className="cursor-pointer p-1.5 text-lg font-black text-rose-500 hover:text-rose-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { id: newItemId(), name: '', quantity: 0, pricePerKilo: 0 }])}
              className="mt-2 block cursor-pointer text-xs font-extrabold text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-300"
            >
              ➕ إضافة بند صنف جديد
            </button>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            المبلغ الإجمالي (جنيه مصري)
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={autoTotal ? itemsTotal : totalAmount}
              onChange={(e) => setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              required
              readOnly={autoTotal}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-xl font-black text-slate-900 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {autoTotal && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-300/60 bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                حساب تلقائي
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            ملاحظات وبيان الحركة
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="اكتب ملاحظات الحركة هنا..."
            className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">
            صورة أو مستند الحركة (اختياري)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              id="transaction-image"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleTransactionImage(e.target.files?.[0] ?? null)}
              disabled={isUploadingImage}
            />
            <label
              htmlFor="transaction-image"
              className={`cursor-pointer rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${
                isUploadingImage ? 'cursor-wait opacity-50' : ''
              }`}
            >
              {isUploadingImage ? '🔄 جاري الرفع...' : '📎 اختيار ملف الصورة'}
            </label>
            {transactionImage && (
              <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 dark:border-indigo-800 dark:bg-indigo-950">
                <a
                  href={transactionImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-extrabold text-indigo-600 hover:underline"
                >
                  عرض الملف المرفق
                </a>
                <button
                  type="button"
                  onClick={() => setTransactionImage(null)}
                  title="حذف المرفق"
                  className="cursor-pointer text-sm font-black text-rose-500 hover:text-rose-700"
                >
                  حذف
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-2 select-none dark:border-indigo-900 dark:bg-indigo-950/40">
          <input
            type="checkbox"
            id="isSettled"
            checked={isSettled}
            onChange={(e) => setIsSettled(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-lg border-slate-300 text-indigo-600"
          />
          <label
            htmlFor="isSettled"
            className="mr-2.5 block cursor-pointer text-xs font-extrabold text-slate-700 dark:text-slate-200"
          >
            هل هذه العملية دفعة سداد؟ (تخصم من حساب العميل)
          </label>
        </div>

        {error !== '' && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02]"
          >
            {transaction ? '💾 حفظ التعديلات' : '➕ تسجيل الحركة'}
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
