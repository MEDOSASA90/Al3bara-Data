import { useMemo, useState } from 'react';
import type { Entity, Lot } from '../../domain/types';
import { isLotUnpaid, lotPaymentDeadline } from '../../domain/finance';
import { formatCurrency, formatDate, toBase64 } from '../../utils/format';
import { compressImage } from '../../utils/images';
import { Modal } from '../../components/ui/Modal';
import { analyzeLotImage } from '../../ai/analyzeImage';
import type { LotImageAnalysis } from '../../ai/schemas';

export type LotStatusFilter = 'all' | 'unpaid70' | 'paid70';

export interface EntitiesViewProps {
  entities: Entity[];
  initialStatusFilter?: LotStatusFilter;
  onOpenLotModal: (entity: Entity, lot?: Lot) => void;
  onOpenEntityModal: (entity: Entity) => void;
  onDeleteEntity: (entityId: string) => void;
  onDeleteLot: (entityId: string, lotId: string) => void;
  onArchiveLot: (entityId: string, lotId: string) => void;
  /** lotId omitted => supply the whole entity (all unpaid lots). */
  onOpenSupplyModal: (entityId: string, lotId?: string) => void;
  /** lotId omitted => loading the whole entity. */
  onOpenLoadingModal: (entityId: string, lotId?: string) => void;
  onExportEntity: (entity: Entity) => void;
}

interface SessionGroup {
  key: string;
  auctionMillis: number;
  label: string;
  entities: Entity[];
  totalValue: number;
  total30: number;
  remaining70: number;
  deadline: Date;
}

function formatDeadline(date: Date): string {
  try {
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function sortLots(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) =>
    a.lotNumber.localeCompare(b.lotNumber, 'ar', { numeric: true }),
  );
}

export function EntitiesView({
  entities,
  initialStatusFilter = 'all',
  onOpenLotModal,
  onOpenEntityModal,
  onDeleteEntity,
  onDeleteLot,
  onArchiveLot,
  onOpenSupplyModal,
  onOpenLoadingModal,
  onExportEntity,
}: EntitiesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LotStatusFilter>(initialStatusFilter);
  const [expandedSessionKey, setExpandedSessionKey] = useState<string | null>(null);
  const [showPendingSessions, setShowPendingSessions] = useState(false);
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
  const [analysisTarget, setAnalysisTarget] = useState<{ entityName: string; lot: Lot } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<LotImageAnalysis | null>(null);

  function closeImageAnalysis(): void {
    setAnalysisTarget(null);
    setAnalysisResult(null);
    setAnalysisError('');
    setAnalysisLoading(false);
  }

  function handleAnalyzeImage(entityName: string, lot: Lot): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) return;
      setAnalysisTarget({ entityName, lot });
      setAnalysisResult(null);
      setAnalysisError('');
      setAnalysisLoading(true);
      void (async (): Promise<void> => {
        try {
          const compressed = await compressImage(file, 1024, 0.7);
          const dataUrl = await toBase64(compressed);
          const result = await analyzeLotImage(
            dataUrl,
            compressed.type || file.type || 'image/jpeg',
            `${lot.name} — الكمية: ${lot.quantity}`,
          );
          setAnalysisResult(result);
        } catch (err) {
          setAnalysisError(err instanceof Error ? err.message : 'تعذر تحليل الصورة');
        } finally {
          setAnalysisLoading(false);
        }
      })();
    };
    input.click();
  }

  const visibleEntities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return entities
      .map((entity) => {
        let lots = entity.lots.filter((lot) => !lot.isArchived);
        if (statusFilter === 'unpaid70') lots = lots.filter(isLotUnpaid);
        else if (statusFilter === 'paid70') lots = lots.filter((lot) => !isLotUnpaid(lot));
        return { ...entity, lots };
      })
      .filter((entity) => {
        if (query.length === 0) return true;
        if (entity.name.toLowerCase().includes(query)) return true;
        if ((entity.buyerName ?? '').toLowerCase().includes(query)) return true;
        return entity.lots.some(
          (lot) =>
            lot.lotNumber.toLowerCase().includes(query) ||
            lot.name.toLowerCase().includes(query),
        );
      });
  }, [entities, searchTerm, statusFilter]);

  const sessions = useMemo<SessionGroup[]>(() => {
    const map = new Map<string, SessionGroup>();
    for (const entity of visibleEntities) {
      const millis = entity.auctionDate.toMillis();
      const key = String(millis);
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          auctionMillis: millis,
          label: formatDate(entity.auctionDate),
          entities: [],
          totalValue: 0,
          total30: 0,
          remaining70: 0,
          deadline: lotPaymentDeadline(entity.auctionDate),
        };
        map.set(key, group);
      }
      group.entities.push(entity);
      for (const lot of entity.lots) {
        group.totalValue += lot.totalValue;
        group.total30 += lot.value30;
        if (!lot.is70Paid) group.remaining70 += lot.value70;
      }
    }
    return [...map.values()].sort((a, b) => b.auctionMillis - a.auctionMillis);
  }, [visibleEntities]);

  const visibleSessions = showPendingSessions ? sessions : sessions.filter((session) => session.totalValue > 0);
  const hiddenPendingCount = sessions.length - visibleSessions.length;

  const filterButton = (value: LotStatusFilter, label: string, activeClass: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`min-h-[40px] rounded-lg px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition-all duration-150 ${
        statusFilter === value
          ? `border border-slate-200/20 bg-white shadow-sm ${activeClass}`
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {label}
    </button>
  );

  if (entities.length === 0) {
    return (
      <div
        dir="rtl"
        className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-800"
      >
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
          لا توجد أي جهات أو مزادات مسجلة حالياً. ابدأ بإضافة جهة جديدة.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 text-right">
      <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <div className="relative w-full md:flex-1">
            <input
              type="text"
              placeholder="ابحث بالجهة، المشتري، أو بمسمى اللوط..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex w-full shrink-0 gap-1 overflow-x-auto rounded-xl border border-slate-200/50 bg-slate-100 p-1 md:w-auto dark:border-slate-600 dark:bg-slate-900">
            {filterButton('all', 'كل اللوطات', 'text-slate-800 dark:text-slate-100')}
            {filterButton('unpaid70', 'غير مسدد الـ 70%', 'text-rose-600')}
            {filterButton('paid70', 'تم سدادها بالكامل', 'text-emerald-600')}
          </div>
          {hiddenPendingCount > 0 || showPendingSessions ? (
            <button
              type="button"
              onClick={() => setShowPendingSessions((current) => !current)}
              className="min-h-[40px] shrink-0 rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 md:w-auto dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {showPendingSessions ? 'إخفاء بانتظار الترسية' : `إظهار بانتظار الترسية (${hiddenPendingCount})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        {visibleSessions.map((session) => {
          const isSessionExpanded = expandedSessionKey === session.key;
          return (
            <section
              key={session.key}
              className="space-y-4 rounded-3xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div
                className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5 dark:border-slate-700"
                onClick={() => setExpandedSessionKey(isSessionExpanded ? null : session.key)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform duration-200 dark:bg-indigo-900/40 dark:text-indigo-300 ${
                      isSessionExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-800 dark:text-slate-100">
                    جلسة مزاد بتاريخ: <span dir="ltr">{session.label}</span>
                  </h2>
                </div>
                <p className="text-xs font-bold text-rose-600">
                  {session.totalValue > 0 ? (
                    <>آخر موعد للدفع: {formatDeadline(session.deadline)}</>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      بانتظار الترسية
                    </span>
                  )}
                </p>
              </div>

              {session.totalValue > 0 ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/50 bg-white p-4 shadow-inner sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">إجمالي الترسية</p>
                  <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100" dir="ltr">
                    {formatCurrency(session.totalValue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">المحقق 30%</p>
                  <p className="font-mono text-sm font-black text-indigo-700 dark:text-indigo-300" dir="ltr">
                    {formatCurrency(session.total30)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">متبقي 70%</p>
                  <p className="font-mono text-sm font-black text-amber-700 dark:text-amber-300" dir="ltr">
                    {formatCurrency(session.remaining70)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">عدد الجهات</p>
                  <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100" dir="ltr">
                    {session.entities.length}
                  </p>
                </div>
              </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  لا توجد قيم مالية بعد — {session.entities.length} جهة بانتظار الترسية. اضغط على الجلسة لعرض الجهات.
                </p>
              )}

              {isSessionExpanded && (
                <div className="space-y-4 pt-2">
                  {session.entities.map((entity) => {
                    const isExpanded = expandedEntityId === entity.id;
                    const entityTotal = entity.lots.reduce((sum, lot) => sum + lot.totalValue, 0);
                    const entity30 = entity.lots.reduce((sum, lot) => sum + lot.value30, 0);
                    const entity70 = entity.lots.reduce((sum, lot) => sum + lot.value70, 0);
                    const allPaid = entity.lots.length > 0 && entity.lots.every((lot) => lot.is70Paid);
                    const deadline = formatDeadline(lotPaymentDeadline(entity.auctionDate));
                    return (
                      <article
                        key={entity.id}
                        className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 p-4 md:flex-row md:items-center dark:border-slate-700">
                          <div
                            className="w-full flex-1 cursor-pointer md:w-auto"
                            onClick={() => setExpandedEntityId(isExpanded ? null : entity.id)}
                          >
                            <h3 className="text-base font-extrabold break-words text-indigo-700 dark:text-indigo-300">
                              {entity.name}
                            </h3>
                            {entity.buyerName && (
                              <p className="mt-0.5 text-[10px] font-bold break-words text-slate-500 dark:text-slate-400">
                                المشتري: {entity.buyerName}
                              </p>
                            )}
                          </div>
                          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onOpenLoadingModal(entity.id)}
                              className="cursor-pointer rounded-lg border border-teal-200/50 bg-teal-50 py-1.5 px-3 text-[10px] font-extrabold text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                            >
                              تم التحميل والشحن
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEntityModal(entity)}
                              className="cursor-pointer rounded-lg border border-slate-300/40 bg-slate-100 py-1.5 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => onExportEntity(entity)}
                              className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-indigo-200/60 bg-indigo-50 py-1.5 px-3 text-[10px] font-extrabold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                            >
                              طباعة
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEntity(entity.id)}
                              className="cursor-pointer rounded-lg border border-rose-200/20 bg-rose-50 py-1.5 px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            >
                              حذف الجهة
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="text-right">
                            <p className="mb-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">إجمالي اللوطات</p>
                            <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100" dir="ltr">
                              {formatCurrency(entityTotal)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="mb-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">المدفوع تعاقد (30%)</p>
                            <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100" dir="ltr">
                              {formatCurrency(entity30)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="mb-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">المتبقي توريد (70%)</p>
                            <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-100" dir="ltr">
                              {formatCurrency(entity70)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="mb-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">أقرب ميعاد دفع</p>
                            {allPaid ? (
                              <span className="text-xs font-black text-emerald-600">تم السداد</span>
                            ) : (
                              <p className="font-mono text-xs font-black text-rose-600">آخر موعد: {deadline}</p>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-4 bg-slate-50/10 p-4 dark:bg-slate-900/40">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenSupplyModal(entity.id)}
                                className="cursor-pointer rounded-xl border border-indigo-200/50 bg-indigo-50 py-1.5 px-4 text-xs font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                              >
                                توريد الـ 70% لكامل الجهة
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenLotModal(entity)}
                                className="cursor-pointer rounded-xl bg-indigo-600 py-1.5 px-4 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-indigo-700"
                              >
                                إضافة لوط جديد
                              </button>
                            </div>

                            <h4 className="mt-4 border-t border-slate-100 pt-2 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              بنود اللوطات النشطة:
                            </h4>

                            <div className="space-y-3.5">
                              {sortLots(entity.lots).map((lot) => (
                                <div
                                  key={lot.id}
                                  className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <p className="text-sm font-extrabold break-words text-slate-800 dark:text-slate-100">
                                    لوط رقم:{' '}
                                    <span className="font-mono text-indigo-600 dark:text-indigo-300" dir="ltr">
                                      {lot.lotNumber}
                                    </span>{' '}
                                    - {lot.name}
                                  </p>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      الكمية:{' '}
                                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                                        {lot.quantity || '-'}
                                      </span>
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      الإجمالي:{' '}
                                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                                        {formatCurrency(lot.totalValue)}
                                      </span>
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      دفعة 30%:{' '}
                                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                                        {formatCurrency(lot.value30)}
                                      </span>
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                      متبقي 70%:{' '}
                                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                                        {formatCurrency(lot.value70)}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                                    {lot.is70Paid ? (
                                      <span className="rounded-lg border border-emerald-200/40 bg-emerald-50 py-1.5 px-3 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        تم السداد
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onOpenSupplyModal(entity.id, lot.id)}
                                        className="cursor-pointer rounded-lg border border-rose-200/40 bg-rose-50 py-1.5 px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                      >
                                        توريد 70%
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onOpenLotModal(entity, lot)}
                                      className="cursor-pointer rounded-lg border border-slate-300/50 bg-slate-100 py-1.5 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                      تعديل
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAnalyzeImage(entity.name, lot)}
                                      className="cursor-pointer rounded-lg border border-violet-300/50 bg-violet-50 py-1.5 px-3 text-[10px] font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                                    >
                                      🔍 تحليل صورة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenLoadingModal(entity.id, lot.id)}
                                      className="cursor-pointer rounded-lg border border-teal-200/45 bg-teal-50 py-1.5 px-3 text-[10px] font-bold text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                                    >
                                      تم الشحن
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onArchiveLot(entity.id, lot.id)}
                                      className="cursor-pointer rounded-lg border border-slate-300/50 bg-slate-100 py-1.5 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                      أرشفة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteLot(entity.id, lot.id)}
                                      className="cursor-pointer rounded-lg border border-rose-200/20 bg-rose-50 py-1.5 px-3 text-[10px] font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                    >
                                      حذف
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {entity.lots.length === 0 && (
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  لا توجد لوطات مطابقة للفلتر الحالي.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {visibleSessions.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {hiddenPendingCount > 0 && !showPendingSessions
              ? `لا توجد جلسات مرساة مطابقة — هناك ${hiddenPendingCount} جلسة بانتظار الترسية مخفية.`
              : 'لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.'}
          </p>
        )}
      </div>

      <Modal
        isOpen={analysisTarget !== null}
        onClose={closeImageAnalysis}
        title={analysisTarget ? `🔍 تحليل صورة — لوط ${analysisTarget.lot.lotNumber}` : '🔍 تحليل صورة'}
      >
        <div dir="rtl" className="space-y-3 text-right">
          {analysisTarget ? (
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {analysisTarget.entityName} — {analysisTarget.lot.name}
            </p>
          ) : null}
          {analysisLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              جاري تحليل الصورة...
            </div>
          ) : null}
          {analysisError !== '' ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
            >
              ⚠️ {analysisError}
            </p>
          ) : null}
          {analysisResult ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الحالة</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{analysisResult.condition}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">التصنيف التقديري</p>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {analysisResult.estimatedCategory}
                </p>
              </div>
              {analysisResult.suggestedPrice !== undefined ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/40">
                  <p className="text-[11px] font-bold text-indigo-500 dark:text-indigo-300">سعر استرشادي</p>
                  <p className="font-mono text-sm font-black text-indigo-700 dark:text-indigo-300" dir="ltr">
                    {formatCurrency(analysisResult.suggestedPrice)}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ملاحظات</p>
                <p className="text-xs leading-6 font-semibold whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {analysisResult.notes}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
