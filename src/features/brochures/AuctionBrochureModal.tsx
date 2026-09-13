import { Fragment, useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { normalizeArabic, SearchableDropdown } from '../../components/ui/SearchableDropdown';
import { PRELOADED_AUCTIONS } from '../../data/preloadedAuctions';
import type {
  AuctionBrochureData,
  ParsedLot,
} from '../../data/preloadedAuctions';
import { AUCTION_HALL_DEFAULT, AUCTION_INSURANCE_DEFAULT, STAMP_FEE_DEFAULT } from '../../domain/constants';
import { brochureTextToData } from '../../ai/parseBrochureAI';
import type { BrochureAIResult } from '../../ai/schemas';
import {
  applyQuantityChange,
  applyTotalChange,
  applyUnitPriceChange,
  applyValue30Change,
  applyValue70Change,
  EMPTY_LOT_CALC,
} from '../../domain/finance';
import type { LotCalcState, NumericInput } from '../../domain/finance';
import type { PredefinedBuyer, RejectedLot } from '../../domain/types';
import { formatCurrency } from '../../utils/format';
import { extractTextFromPDF, parseBrochureText } from '../../utils/brochureParser';

export interface AwardedLotPayload {
  lotNumber: string;
  name: string;
  quantity: string;
  totalValue: number;
  value30: number;
  value70: number;
}

export interface AwardedEntityPayload {
  entityName: string;
  buyerName: string;
  auctionDate: string;
  lots: AwardedLotPayload[];
}

export interface RejectedLotInput {
  name: string;
  quantity?: string;
  myBidPrice: number;
  sessionDate: string;
  entityName: string;
  notes?: string;
}

export interface AuctionBrochureModalProps {
  isOpen: boolean;
  onClose: () => void;
  predefinedBuyers: PredefinedBuyer[];
  onOpenPredefinedBuyerModal: () => void;
  onSaveAwardedEntity: (data: AwardedEntityPayload) => Promise<void>;
  /** Auto-saves the parsed brochure into the library (Firestores كراسات المحفوظة). */
  onSaveBrochureToLibrary?: (data: {
    auctionDate: string;
    title: string;
    hallLocation: string;
    insuranceAmount: number;
    source: 'file' | 'ai';
    fileName?: string;
    entities: AuctionBrochureData['entities'];
  }) => Promise<void>;
  rejectedLots: RejectedLot[];
  onAddRejectedLot: (input: RejectedLotInput) => Promise<void>;
  onDeleteRejectedLot: (id: string) => Promise<void>;
}

interface LotRowState {
  parsed: ParsedLot;
  calc: LotCalcState;
  unit: string;
  selected: boolean;
}

type BrochureTab = 'lots' | 'rejected';

function parseQtyString(qtyStr: string): { qty: NumericInput; unit: string } {
  if (!qtyStr) return { qty: '', unit: 'عدد' };
  const match = qtyStr.match(/([\d.,]+)\s*(.*)/);
  if (match?.[1] != null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    return {
      qty: Number.isNaN(num) ? '' : num,
      unit: match[2]?.trim() || 'عدد',
    };
  }
  return { qty: '', unit: 'عدد' };
}

function toNumericInput(value: string): NumericInput {
  if (value === '') return '';
  const num = parseFloat(value);
  return Number.isNaN(num) ? '' : num;
}

function inputValue(value: NumericInput): string {
  return value === '' ? '' : String(value);
}

export function AuctionBrochureModal({
  isOpen,
  onClose,
  predefinedBuyers,
  onOpenPredefinedBuyerModal,
  onSaveAwardedEntity,
  onSaveBrochureToLibrary,
  rejectedLots,
  onAddRejectedLot,
  onDeleteRejectedLot,
}: AuctionBrochureModalProps) {
  const [selectedBrochureId, setSelectedBrochureId] = useState<string>(
    PRELOADED_AUCTIONS[0]?.id ?? '',
  );
  const [customBrochure, setCustomBrochure] =
    useState<AuctionBrochureData | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [auctionDate, setAuctionDate] = useState<string>('');
  const [lotsState, setLotsState] = useState<Record<string, LotRowState>>({});
  const [formError, setFormError] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState<BrochureTab>('lots');
  const [rejectOpenLot, setRejectOpenLot] = useState<string | null>(null);
  const [rejectPrice, setRejectPrice] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const allBrochures = useMemo<AuctionBrochureData[]>(() => {
    if (customBrochure) return [customBrochure, ...PRELOADED_AUCTIONS];
    return PRELOADED_AUCTIONS;
  }, [customBrochure]);

  const activeBrochure = useMemo<AuctionBrochureData | undefined>(() => {
    return (
      allBrochures.find((b) => b.id === selectedBrochureId) ?? allBrochures[0]
    );
  }, [allBrochures, selectedBrochureId]);

  const totalBrochureLots = useMemo(() => {
    if (!activeBrochure) return 0;
    return activeBrochure.entities.reduce((sum, e) => sum + e.lots.length, 0);
  }, [activeBrochure]);

  useEffect(() => {
    if (!activeBrochure) return;
    setAuctionDate(activeBrochure.auctionDate);
    const exists = activeBrochure.entities.some(
      (e) => e.id === selectedEntityId,
    );
    if (!exists && activeBrochure.entities[0]) {
      setSelectedEntityId(activeBrochure.entities[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrochure, selectedBrochureId]);

  const activeEntity = useMemo(() => {
    if (!activeBrochure) return null;
    return (
      activeBrochure.entities.find((e) => e.id === selectedEntityId) ??
      activeBrochure.entities[0] ??
      null
    );
  }, [activeBrochure, selectedEntityId]);

  useEffect(() => {
    if (!activeEntity) return;
    const initial: Record<string, LotRowState> = {};
    for (const lot of activeEntity.lots) {
      const { qty, unit } = parseQtyString(lot.quantity);
      initial[lot.lotNumber] = {
        parsed: lot,
        calc: { ...EMPTY_LOT_CALC, quantity: qty, stampFee: STAMP_FEE_DEFAULT },
        unit,
        selected: false,
      };
    }
    setLotsState(initial);
  }, [activeEntity]);

  const sessionDropdownItems = useMemo(() => {
    return allBrochures.map((b) => {
      const lotsCount = b.entities.reduce((sum, e) => sum + e.lots.length, 0);
      return {
        id: b.id,
        label: `${b.title} — ${b.auctionDate}`,
        sub: `${b.entities.length} جهة • ${lotsCount} لوط`,
        keywords: b.entities.map((e) => e.entityName).join(' '),
      };
    });
  }, [allBrochures]);

  const entityDropdownItems = useMemo(() => {
    if (!activeBrochure) return [];
    return activeBrochure.entities.map((e) => ({
      id: e.id,
      label: e.entityName,
      sub: `${e.location ?? 'بدون موقع'} • ${e.lots.length} لوط`,
      keywords: e.lots.map((l) => l.name).join(' '),
    }));
  }, [activeBrochure]);

  /** Journal entries grouped by normalized lot name for smart matching. */
  const rejectedByNorm = useMemo(() => {
    const map = new Map<string, RejectedLot[]>();
    for (const entry of rejectedLots) {
      const key = normalizeArabic(entry.name);
      if (key === '') continue;
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    }
    return map;
  }, [rejectedLots]);

  const filteredJournal = useMemo(() => {
    const q = normalizeArabic(journalSearch);
    if (q === '') return rejectedLots;
    const terms = q.split(' ').filter(Boolean);
    return rejectedLots.filter((entry) => {
      const haystack = normalizeArabic(
        `${entry.name} ${entry.entityName} ${entry.notes ?? ''} ${entry.sessionDate}`,
      );
      return terms.every((t) => haystack.includes(t));
    });
  }, [rejectedLots, journalSearch]);

  function updateLot(
    lotNumber: string,
    next: LotCalcState,
    markSelected = true,
  ): void {
    setLotsState((prev) => {
      const row = prev[lotNumber];
      if (!row) return prev;
      return {
        ...prev,
        [lotNumber]: {
          ...row,
          calc: next,
          selected: markSelected ? true : row.selected,
        },
      };
    });
  }

  function handleToggleLot(lotNumber: string): void {
    setLotsState((prev) => {
      const row = prev[lotNumber];
      if (!row) return prev;
      return {
        ...prev,
        [lotNumber]: { ...row, selected: !row.selected },
      };
    });
  }

  function handleSelectBrochure(id: string): void {
    setSelectedBrochureId(id);
    const brochure = allBrochures.find((b) => b.id === id);
    if (brochure?.entities[0]) setSelectedEntityId(brochure.entities[0].id);
  }

  function openRejectForm(lotNumber: string): void {
    setRejectOpenLot(lotNumber);
    setRejectPrice('');
    setRejectNotes('');
    setRejectError('');
  }

  async function handleSaveRejected(lot: ParsedLot): Promise<void> {
    setRejectError('');
    const price = parseFloat(rejectPrice);
    if (Number.isNaN(price) || price <= 0) {
      setRejectError('أدخل سعر المزايدة اللي قدمت بيه (رقم أكبر من صفر)');
      return;
    }
    if (!activeEntity) {
      setRejectError('اختر الجهة أولاً');
      return;
    }
    setRejectSaving(true);
    try {
      const input: RejectedLotInput = {
        name: lot.name,
        myBidPrice: price,
        sessionDate: auctionDate || activeBrochure?.auctionDate || '',
        entityName: activeEntity.entityName,
      };
      if (lot.quantity) input.quantity = lot.quantity;
      const notes = rejectNotes.trim();
      if (notes !== '') input.notes = notes;
      await onAddRejectedLot(input);
      setRejectOpenLot(null);
      setRejectPrice('');
      setRejectNotes('');
    } catch (err) {
      setRejectError(
        `فشل حفظ اللوط المرفوض: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      );
    } finally {
      setRejectSaving(false);
    }
  }

  async function handleDeleteRejected(id: string): Promise<void> {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteRejectedLot(id);
      setDeleteConfirmId(null);
    } catch (err) {
      setFormError(
        `فشل حذف القيد: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  const summary = useMemo(() => {
    const items = Object.values(lotsState).filter(
      (row) =>
        row.selected &&
        typeof row.calc.totalValue === 'number' &&
        row.calc.totalValue > 0,
    );
    const total = items.reduce(
      (sum, row) => sum + Number(row.calc.totalValue),
      0,
    );
    const total30 = items.reduce(
      (sum, row) => sum + (Number(row.calc.value30) || 0),
      0,
    );
    const total70 = items.reduce(
      (sum, row) => sum + (Number(row.calc.value70) || 0),
      0,
    );
    return { count: items.length, total, total30, total70, items };
  }, [lotsState]);

  async function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsingFile(true);
    setFormError('');
    try {
      const text = file.name.toLowerCase().endsWith('.pdf')
        ? await extractTextFromPDF(file)
        : await file.text();
      setExtractedText(text);
      setAiError('');
      const parsed = parseBrochureText(text);
      setCustomBrochure(parsed);
      setSelectedBrochureId(parsed.id);
      if (parsed.entities[0]) setSelectedEntityId(parsed.entities[0].id);
      if (onSaveBrochureToLibrary) {
        await onSaveBrochureToLibrary({
          auctionDate: parsed.auctionDate,
          title: parsed.title,
          hallLocation: parsed.hallLocation,
          insuranceAmount: parsed.insuranceAmount,
          source: 'file',
          fileName: file.name,
          entities: parsed.entities,
        });
      }
    } catch (err) {
      setFormError(
        `حدث خطأ أثناء قراءة ملف الكراسة: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`,
      );
    } finally {
      setIsParsingFile(false);
      event.target.value = '';
    }
  }

function toBrochureData(result: BrochureAIResult): AuctionBrochureData {
  const stamp = Date.now();
  return {
    id: `ai-auction-${result.auctionDate}-${stamp}`,
    auctionDate: result.auctionDate,
    title: result.title,
    hallLocation: AUCTION_HALL_DEFAULT,
    insuranceAmount: AUCTION_INSURANCE_DEFAULT,
    entities: result.entities.map((entity, entityIndex) => ({
      id: `ai-entity-${entityIndex + 1}-${stamp}`,
      entityName: entity.entityName,
      location: entity.location,
      lots: entity.lots.map((lot) => ({
        lotNumber: lot.lotNumber,
        name: lot.name,
        quantity: lot.quantity,
        unit: lot.unit ?? 'عدد',
        condition: lot.condition ?? 'خردة',
      })),
    })),
  };
}

  async function handleSmartAnalysis(): Promise<void> {
    if (extractedText.trim() === '' || isAiParsing) return;
    setIsAiParsing(true);
    setAiError('');
    try {
      const result = await brochureTextToData(extractedText);
      const converted = toBrochureData(result);
      setCustomBrochure(converted);
      setSelectedBrochureId(converted.id);
      if (converted.entities[0]) setSelectedEntityId(converted.entities[0].id);
      if (onSaveBrochureToLibrary) {
        await onSaveBrochureToLibrary({
          auctionDate: converted.auctionDate,
          title: converted.title,
          hallLocation: converted.hallLocation,
          insuranceAmount: converted.insuranceAmount,
          source: 'ai',
          entities: converted.entities,
        });
      }
    } catch (err) {
      setAiError(
        `تعذر التحليل الذكي (تم الاحتفاظ بنتيجة الاستخراج العادية): ${err instanceof Error ? err.message : 'خطأ غير معروف'}`,
      );
    } finally {
      setIsAiParsing(false);
    }
  }

  async function handleSave(): Promise<void> {
    setFormError('');
    if (!activeEntity) {
      setFormError('يرجى اختيار الجهة أولاً');
      return;
    }
    if (!buyerName.trim()) {
      setFormError('يرجى اختيار اسم المشتري / المندوب');
      return;
    }
    if (summary.count === 0) {
      setFormError('يرجى تحديد لوط واحد على الأقل وإدخال سعر الترسية له');
      return;
    }
    setIsSaving(true);
    try {
      const lots: AwardedLotPayload[] = summary.items.map((row) => {
        const qtyStr =
          typeof row.calc.quantity === 'number'
            ? `${row.calc.quantity} ${row.unit}`
            : (row.parsed.quantity ?? '1 عدد');
        return {
          lotNumber: row.parsed.lotNumber,
          name: row.parsed.condition
            ? `${row.parsed.name} (${row.parsed.condition})`
            : row.parsed.name,
          quantity: qtyStr,
          totalValue: Number(row.calc.totalValue),
          value30: Number(row.calc.value30),
          value70: Number(row.calc.value70),
        };
      });
      await onSaveAwardedEntity({
        entityName: activeEntity.entityName,
        buyerName,
        auctionDate,
        lots,
      });
      onClose();
    } catch (err) {
      setFormError(
        `فشل حفظ اللوطات: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📄 كراسات جلسات المزادات - الترسية والتسعير"
      size="xl"
    >
      <div className="space-y-4 text-right" dir="rtl">
        <div className="space-y-3 rounded-2xl bg-slate-900 p-4 text-white dark:border dark:border-slate-700">
          <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h3 className="text-sm font-black text-amber-400 md:text-base">
                🏛️ كراسات مزادات الهيئة العامة للخدمات الحكومية
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                إجمالي {totalBrochureLots} لوط في هذه الكراسة — اختر الجلسة ثم
                الجهة ثم أدخل أسعار الترسية
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition-all hover:scale-[1.02]">
                <span>{isParsingFile ? '⏳ جاري القراءة...' : '📤 رفع كراسة PDF'}</span>
                <input
                  type="file"
                  accept=".pdf,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isParsingFile}
                />
              </label>
              {extractedText.trim() !== '' ? (
                <button
                  type="button"
                  onClick={handleSmartAnalysis}
                  disabled={isAiParsing || isParsingFile}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow-md transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAiParsing ? '⏳ جاري التحليل الذكي...' : 'تحليل ذكي ✨'}
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-black text-amber-300">
              📅 الجلسة / الكراسة ({sessionDropdownItems.length}):
            </label>
            <SearchableDropdown
              items={sessionDropdownItems}
              valueId={selectedBrochureId || null}
              onChange={handleSelectBrochure}
              placeholder="🔍 ابحث عن جلسة بالتاريخ أو العنوان..."
              emptyText="لا توجد جلسة مطابقة — جرّب كلمة أخرى"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              تاريخ الجلسة
            </label>
            <input
              type="date"
              value={auctionDate}
              onChange={(e) => setAuctionDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              المشتري / المندوب <span className="text-rose-500">*</span>
            </label>
            <select
              value={buyerName}
              onChange={(e) => {
                if (e.target.value === 'add_new') {
                  onOpenPredefinedBuyerModal();
                } else {
                  setBuyerName(e.target.value);
                }
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">-- اختر المشتري --</option>
              {predefinedBuyers.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
              <option value="add_new" className="font-bold text-indigo-600">
                ➕ إضافة مشتري جديد...
              </option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              🏢 الجهة ({entityDropdownItems.length} جهة)
            </label>
            <SearchableDropdown
              items={entityDropdownItems}
              valueId={selectedEntityId || null}
              onChange={(id) => setSelectedEntityId(id)}
              placeholder="🔍 ابحث عن جهة أو محافظة أو لوط..."
              emptyText="لا توجد جهة مطابقة — جرّب كلمة أخرى"
            />
          </div>
        </div>

        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('lots')}
            className={`min-h-[44px] flex-1 cursor-pointer rounded-xl px-3 py-2 text-xs font-black transition-all ${
              activeTab === 'lots'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            📦 اللوطات ({activeEntity?.lots.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`min-h-[44px] flex-1 cursor-pointer rounded-xl px-3 py-2 text-xs font-black transition-all ${
              activeTab === 'rejected'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            🗂️ سجل المرفوض ({rejectedLots.length})
          </button>
        </div>

        {activeTab === 'lots' ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900">
            {activeEntity ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-700">
                  <h4 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-black break-words text-slate-900 dark:text-white">
                    <span>📦 لوطات:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {activeEntity.entityName}
                    </span>
                  </h4>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    ⚖️ دمغة اللوط: {STAMP_FEE_DEFAULT} ج.م على الـ 30%
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 أدخل سعر الوحدة أو إجمالي اللوط أو (30% / 70%) وسيُحسب
                  الباقي تلقائياً:
                </p>
                <div className="-mx-3 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 sm:mx-0 dark:border-slate-700">
                  <table className="w-full min-w-[1000px] text-right text-xs">
                    <thead className="border-b border-slate-200 bg-slate-100 font-black whitespace-nowrap text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <tr>
                        <th className="w-12 p-2.5 text-center">ترسية</th>
                        <th className="w-16 p-2.5 whitespace-nowrap">اللوط</th>
                        <th className="min-w-[160px] p-2.5">بيان اللوط</th>
                        <th className="min-w-[120px] p-2.5 whitespace-nowrap">الكمية</th>
                        <th className="min-w-[130px] p-2.5 whitespace-nowrap">سعر الوحدة</th>
                        <th className="min-w-[140px] p-2.5 whitespace-nowrap">الإجمالي (100%)</th>
                        <th className="min-w-[140px] p-2.5 whitespace-nowrap text-indigo-700 dark:text-indigo-400">
                          30% + دمغة
                        </th>
                        <th className="min-w-[130px] p-2.5 whitespace-nowrap text-amber-700 dark:text-amber-400">
                          70% متبقي
                        </th>
                        <th className="w-28 p-2.5 whitespace-nowrap">مرفوض</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {activeEntity.lots.map((lot) => {
                        const row = lotsState[lot.lotNumber];
                        if (!row) return null;
                        const { calc } = row;
                        const matches = rejectedByNorm.get(normalizeArabic(lot.name)) ?? [];
                        const firstMatch = matches[0];
                        const isRejectOpen = rejectOpenLot === lot.lotNumber;
                        return (
                          <Fragment key={lot.lotNumber}>
                            <tr
                              className={`transition-colors ${row.selected ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                            >
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={() => handleToggleLot(lot.lotNumber)}
                                  aria-label={`ترسية لوط ${lot.lotNumber}`}
                                  className="h-5 w-5 cursor-pointer rounded text-indigo-600"
                                />
                              </td>
                              <td className="p-2.5 font-mono font-bold whitespace-nowrap text-slate-900 dark:text-slate-100">
                                {lot.lotNumber}
                              </td>
                              <td className="min-w-[160px] p-2.5 font-semibold break-words text-slate-800 dark:text-slate-200">
                                <div>{lot.name}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                    {lot.condition ?? 'خردة'}
                                  </span>
                                  {lot.notes && (
                                    <span className="text-[10px] break-words text-amber-700 dark:text-amber-400">
                                      ⚠️ {lot.notes}
                                    </span>
                                  )}
                                </div>
                                {firstMatch ? (
                                  <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black break-words text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                    🔁 قدمت فيها قبل كده بـ {formatCurrency(firstMatch.myBidPrice)}
                                    {firstMatch.sessionDate !== '' ? (
                                      <span> • جلسة {firstMatch.sessionDate}</span>
                                    ) : null}
                                    {matches.length > 1 ? (
                                      <span> (+{matches.length - 1} مرة أخرى)</span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-2.5">
                                <div className="flex min-w-[120px] items-center gap-1">
                                  <input
                                    type="number"
                                    value={inputValue(calc.quantity)}
                                    onChange={(e) =>
                                      updateLot(
                                        lot.lotNumber,
                                        applyQuantityChange(
                                          calc,
                                          toNumericInput(e.target.value),
                                        ),
                                        false,
                                      )
                                    }
                                    className="w-20 rounded border border-slate-200 px-1.5 py-2 text-center font-mono text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                    step="any"
                                  />
                                  <span className="text-[10px] font-bold whitespace-nowrap text-slate-500">
                                    {row.unit}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  placeholder="سعر الوحدة..."
                                  value={inputValue(calc.unitPrice)}
                                  onChange={(e) =>
                                    updateLot(
                                      lot.lotNumber,
                                      applyUnitPriceChange(
                                        calc,
                                        toNumericInput(e.target.value),
                                      ),
                                    )
                                  }
                                  className="w-full min-w-[130px] rounded border border-slate-200 bg-white px-2 py-2 font-mono text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                  step="any"
                                />
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  placeholder="إجمالي اللوط..."
                                  value={inputValue(calc.totalValue)}
                                  onChange={(e) =>
                                    updateLot(
                                      lot.lotNumber,
                                      applyTotalChange(
                                        calc,
                                        toNumericInput(e.target.value),
                                      ),
                                    )
                                  }
                                  className="w-full min-w-[140px] rounded-lg border-2 border-slate-200 bg-white px-2 py-2 font-mono text-xs font-black text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                  step="any"
                                />
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  placeholder="30% + دمغة..."
                                  value={inputValue(calc.value30)}
                                  onChange={(e) =>
                                    updateLot(
                                      lot.lotNumber,
                                      applyValue30Change(
                                        calc,
                                        toNumericInput(e.target.value),
                                      ),
                                    )
                                  }
                                  className="w-full min-w-[140px] rounded-lg border border-indigo-200 bg-indigo-50/40 px-2 py-2 font-mono text-xs font-black text-indigo-700 focus:border-indigo-500 focus:outline-none dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                                  step="any"
                                />
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  placeholder="70% متبقي..."
                                  value={inputValue(calc.value70)}
                                  onChange={(e) =>
                                    updateLot(
                                      lot.lotNumber,
                                      applyValue70Change(
                                        calc,
                                        toNumericInput(e.target.value),
                                      ),
                                    )
                                  }
                                  className="w-full min-w-[130px] rounded-lg border border-amber-200 bg-amber-50/40 px-2 py-2 font-mono text-xs font-black text-amber-700 focus:border-amber-500 focus:outline-none dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  step="any"
                                />
                              </td>
                              <td className="p-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isRejectOpen ? setRejectOpenLot(null) : openRejectForm(lot.lotNumber)
                                  }
                                  className="min-h-[44px] cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] font-black whitespace-nowrap text-amber-800 transition-all hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
                                >
                                  {isRejectOpen ? 'إغلاق ✕' : 'تسجيل كمرفوض 📝'}
                                </button>
                              </td>
                            </tr>
                            {isRejectOpen ? (
                              <tr key={`${lot.lotNumber}-reject`} className="bg-amber-50/60 dark:bg-amber-950/30">
                                <td colSpan={9} className="p-3">
                                  <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-slate-900">
                                    <p className="text-[11px] font-black text-amber-800 dark:text-amber-300">
                                      📝 تسجيل «{lot.name}» (لوط {lot.lotNumber}) كمرفوض — سعرك اللي اترفض:
                                    </p>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <input
                                        type="number"
                                        placeholder="سعر مزايدتي (ج.م) *"
                                        value={rejectPrice}
                                        onChange={(e) => setRejectPrice(e.target.value)}
                                        className="min-h-[44px] flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 font-mono text-xs font-black text-slate-900 focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-slate-800 dark:text-white"
                                        step="any"
                                      />
                                      <input
                                        type="text"
                                        placeholder="ملاحظات (اختياري) — سبب الرفض، سعر الترسية..."
                                        value={rejectNotes}
                                        onChange={(e) => setRejectNotes(e.target.value)}
                                        className="min-h-[44px] flex-[2] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                      />
                                    </div>
                                    {rejectError !== '' ? (
                                      <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        ⚠️ {rejectError}
                                      </p>
                                    ) : null}
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setRejectOpenLot(null)}
                                        className="min-h-[44px] cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                      >
                                        إلغاء
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleSaveRejected(lot)}
                                        disabled={rejectSaving}
                                        className="min-h-[44px] cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-black text-slate-950 shadow-md transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {rejectSaving ? '⏳ جاري الحفظ...' : '💾 حفظ في السجل'}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400">
                اختر جهة من القائمة لعرض لوطاتها
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-700">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                🗂️ سجل اللوطات المرفوضة ({rejectedLots.length})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                لوطات قدمت فيها واترفضت — هتظهرلك علامة 🔁 لما ترجع في كراسة جديدة
              </p>
            </div>
            <input
              type="text"
              placeholder="🔍 ابحث في السجل بالاسم أو الجهة أو الملاحظات..."
              value={journalSearch}
              onChange={(e) => setJournalSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {filteredJournal.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                {rejectedLots.length === 0
                  ? 'السجل فاضي — سجّل أول لوط مرفوض من تبويب اللوطات بزر «تسجيل كمرفوض» 📝'
                  : 'لا توجد قيود مطابقة للبحث'}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredJournal.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black break-words text-slate-900 dark:text-white">
                          {entry.name}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          <span>🏢 {entry.entityName}</span>
                          {entry.sessionDate !== '' ? (
                            <span>📅 جلسة {entry.sessionDate}</span>
                          ) : null}
                          {entry.quantity ? <span>📦 {entry.quantity}</span> : null}
                        </p>
                        {entry.notes ? (
                          <p className="mt-1 text-[11px] break-words text-slate-500 dark:text-slate-400">
                            📝 {entry.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-[11px] font-black whitespace-nowrap text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          مزايدتي: {formatCurrency(entry.myBidPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRejected(entry.id)}
                          disabled={deletingId === entry.id}
                          className={`min-h-[36px] cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-black transition-all ${
                            deleteConfirmId === entry.id
                              ? 'bg-rose-600 text-white hover:bg-rose-700'
                              : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {deletingId === entry.id
                            ? '⏳...'
                            : deleteConfirmId === entry.id
                              ? 'تأكيد الحذف؟ 🗑️'
                              : '🗑️ حذف'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aiError !== '' ? (
          <p className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
            ✨ {aiError}
          </p>
        ) : null}
        {formError && (
          <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            ⚠️ {formError}
          </p>
        )}

        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-slate-900 p-4 text-white dark:border dark:border-slate-700 md:flex-row">
          <div className="grid w-full grid-cols-2 gap-4 text-center md:w-auto md:grid-cols-4">
            <div>
              <span className="block text-[10px] font-bold text-slate-400">
                اللوطات المختارة
              </span>
              <span className="font-mono text-sm font-black text-amber-400 md:text-base">
                {summary.count} لوط
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400">
                إجمالي الترسية (100%)
              </span>
              <span className="font-mono text-sm font-black text-white md:text-base" dir="ltr">
                {formatCurrency(summary.total)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-indigo-300">
                مسدد بالجلسة (30% + دمغات)
              </span>
              <span className="font-mono text-sm font-black text-indigo-400 md:text-base" dir="ltr">
                {formatCurrency(summary.total30)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-amber-300">
                متبقي الـ 70% (15 يوم)
              </span>
              <span className="font-mono text-sm font-black text-amber-400 md:text-base" dir="ltr">
                {formatCurrency(summary.total70)}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] cursor-pointer rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || summary.count === 0}
              className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-black shadow-lg transition-all ${
                summary.count > 0 && !isSaving
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:scale-105 hover:from-emerald-600 hover:to-teal-700'
                  : 'cursor-not-allowed bg-slate-700 text-slate-400'
              }`}
            >
              {isSaving ? '⏳ جاري الحفظ...' : '💾 تسجيل وترسية اللوطات'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
