import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ImageRef, Lot } from '../../domain/types';
import {
  EMPTY_LOT_CALC,
  applyQuantityChange,
  applyStampChange,
  applyTotalChange,
  applyUnitPriceChange,
  applyValue30Change,
  applyValue70Change,
  isNumberInput,
  type LotCalcState,
  type NumericInput,
} from '../../domain/finance';
import { STAMP_FEE_DEFAULT } from '../../domain/constants';
import { formatCurrency } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';

export interface LotFormData {
  lotNumber: string;
  name: string;
  quantity: string;
  totalValue: number;
  value30: number;
  value70: number;
  contractImage?: ImageRef | null;
}

export interface LotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LotFormData) => void;
  lot: Lot | null;
  onFileUpload: (file: File, prefix: string) => Promise<ImageRef | undefined>;
}

type QuantityKind = 'count' | 'weight';

function parseQuantity(raw: string): { qty: NumericInput; kind: QuantityKind } {
  const match = raw.match(/([\d.]+)\s*(.*)/);
  if (!match?.[1]) return { qty: '', kind: 'count' };
  const qty = parseFloat(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  const isWeight =
    unit.includes('طن') || unit.includes('kg') || unit.includes('kilo') || unit.includes('وزن');
  return { qty: Number.isNaN(qty) ? '' : qty, kind: isWeight ? 'weight' : 'count' };
}

function calcFromLot(lot: Lot): { calc: LotCalcState; kind: QuantityKind } {
  const { qty, kind } = parseQuantity(lot.quantity);
  const calc: LotCalcState = {
    ...EMPTY_LOT_CALC,
    quantity: qty,
    totalValue: lot.totalValue,
    value30: lot.value30,
    value70: lot.value70,
    stampFee: STAMP_FEE_DEFAULT,
  };
  if (typeof qty === 'number' && qty > 0 && lot.totalValue > 0) {
    calc.unitPrice = parseFloat((lot.totalValue / qty).toFixed(2));
  }
  return { calc, kind };
}

function toNumericInput(raw: string): NumericInput {
  if (raw === '') return '';
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? '' : parsed;
}

const lightInputClasses =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export function LotModal({ isOpen, onClose, onSave, lot, onFileUpload }: LotModalProps) {
  const [lotNumber, setLotNumber] = useState('');
  const [name, setName] = useState('');
  const [quantityKind, setQuantityKind] = useState<QuantityKind>('count');
  const [calc, setCalc] = useState<LotCalcState>(EMPTY_LOT_CALC);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState<ImageRef | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (lot) {
      const { calc: next, kind } = calcFromLot(lot);
      setCalc(next);
      setQuantityKind(kind);
      setLotNumber(lot.lotNumber);
      setName(lot.name);
      setExistingImage(lot.contractImage);
    } else {
      setCalc(EMPTY_LOT_CALC);
      setQuantityKind('count');
      setLotNumber('');
      setName('');
      setExistingImage(undefined);
    }
    setContractFile(null);
  }, [lot, isOpen]);

  const handleSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!isNumberInput(calc.totalValue) || !isNumberInput(calc.value30)) return;
    const total = calc.totalValue;
    const v30 = calc.value30;
    const v70 = isNumberInput(calc.value70) ? calc.value70 : total - (v30 - calc.stampFee);
    const unitLabel = quantityKind === 'weight' ? 'طن' : 'عدد/قطعة';
    const quantityString =
      typeof calc.quantity === 'number' ? `${calc.quantity} ${unitLabel}` : '';

    const submit = (contractImage: ImageRef | undefined | null) => {
      onSave({
        lotNumber: lotNumber.trim(),
        name: name.trim(),
        quantity: quantityString,
        totalValue: Number(total),
        value30: Number(v30),
        value70: Number(v70),
        contractImage: contractImage ?? existingImage ?? null,
      });
    };

    if (contractFile) {
      setIsUploading(true);
      onFileUpload(contractFile, 'lot_contract')
        .then((uploaded) => {
          setIsUploading(false);
          submit(uploaded);
        })
        .catch(() => {
          setIsUploading(false);
        });
      return;
    }
    submit(existingImage);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lot ? 'تعديل بيانات اللوط' : 'إضافة لوط جديد للمزاد'}>
      <form onSubmit={handleSubmit} dir="rtl" className="space-y-4 text-right">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">رقم اللوط</label>
            <input
              type="text"
              placeholder="أدخل رقم اللوط (مثال: لوط 4)"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              className={lightInputClasses}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">مسمى وصنف اللوط</label>
            <input
              type="text"
              placeholder="مثال: خشب كسر / حديد خردة / جراكن"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={lightInputClasses}
              required
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              الكمية وسعر الوحدة (لحساب الإجمالي تلقائياً)
            </label>
            <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-bold dark:bg-slate-700">
              <button
                type="button"
                onClick={() => setQuantityKind('count')}
                className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                  quantityKind === 'count' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                عدد / كراتين / جراكن
              </button>
              <button
                type="button"
                onClick={() => setQuantityKind('weight')}
                className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                  quantityKind === 'weight' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                طن / كجم
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">الكمية المقدرة:</span>
              <input
                type="number"
                placeholder="مثال: 5000 أو 10.5"
                value={calc.quantity}
                onChange={(e) => setCalc((prev) => applyQuantityChange(prev, toNumericInput(e.target.value)))}
                className={lightInputClasses}
                step="0.01"
              />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                سعر الوحدة الواحدة (ج.م):
              </span>
              <input
                type="number"
                placeholder="مثال: 6.10 للجركن أو 24200 للطن"
                value={calc.unitPrice}
                onChange={(e) => setCalc((prev) => applyUnitPriceChange(prev, toNumericInput(e.target.value)))}
                className={lightInputClasses}
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-black text-slate-800 dark:text-slate-100">
            إجمالي قيمة ترسية اللوط (100%) (ج.م)
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={calc.totalValue}
            onChange={(e) => setCalc((prev) => applyTotalChange(prev, toNumericInput(e.target.value)))}
            className="w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-center font-mono text-lg font-black text-slate-900 shadow-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            required
            step="0.01"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5 dark:border-indigo-900 dark:bg-indigo-900/20">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="lot-value-30" className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                دفعة 30% + الدمغة (مسدد بالجلسة)
              </label>
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                + {calc.stampFee} ج دمغة لوط
              </span>
            </div>
            <input
              id="lot-value-30"
              type="number"
              value={calc.value30}
              onChange={(e) => setCalc((prev) => applyValue30Change(prev, toNumericInput(e.target.value)))}
              className="w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-center font-mono text-sm font-black text-indigo-700 shadow-xs focus:outline-none focus:ring-indigo-500 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
              required
              step="0.01"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-black text-amber-900 dark:text-amber-200">
                متبقي التوريد 70% (خلال 15 يوم)
              </label>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">قابل للتعديل</span>
            </div>
            <input
              type="number"
              value={calc.value70}
              onChange={(e) => setCalc((prev) => applyValue70Change(prev, toNumericInput(e.target.value)))}
              className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-center font-mono text-sm font-black text-amber-800 shadow-xs focus:outline-none focus:ring-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
              required
              step="0.01"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>قيمة دمغة اللوط المقررة:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={calc.stampFee}
              onChange={(e) =>
                setCalc((prev) => applyStampChange(prev, e.target.value === '' ? 0 : parseFloat(e.target.value)))
              }
              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-center font-mono text-xs font-bold dark:border-slate-600 dark:bg-slate-900"
            />
            <span className="font-bold">ج.م (تضاف على الـ 30% تلقائياً)</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span>صافي ثمن اللوط بدون دمغة:</span>
          <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100" dir="ltr">
            {typeof calc.totalValue === 'number' ? formatCurrency(calc.totalValue) : '0.00'} ج.م
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">
            إرفاق صورة العقد / كراسة الشروط
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              readOnly
              value={contractFile ? contractFile.name : (existingImage ? existingImage.name : '')}
              placeholder="لم يتم اختيار صورة..."
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-right text-xs break-words text-slate-600 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            />
            <label
              htmlFor="contract-image-upload"
              className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center rounded-lg border border-indigo-200/50 bg-indigo-50 py-2 px-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
            >
              تصفح الملف
            </label>
            <input
              id="contract-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setContractFile(e.target.files ? e.target.files[0] ?? null : null)}
            />
          </div>
          {existingImage && !contractFile && (
            <a
              href={existingImage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
            >
              عرض العقد الحالي المرفوع
            </a>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            type="submit"
            disabled={isUploading}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {isUploading ? 'جاري الرفع...' : lot ? 'حفظ التعديلات' : 'إضافة اللوط للمزاد'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
