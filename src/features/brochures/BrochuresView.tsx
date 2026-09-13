import { useMemo, useState, type ReactNode } from 'react';
import type { SavedBrochure } from '../../domain/types';
import { brochureLotsCount } from '../../data/repositories';

const SOURCE_LABELS: Record<SavedBrochure['source'], { label: string; style: string }> = {
  preloaded: { label: 'مضمنة', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  file: { label: 'PDF مرفوع', style: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  ai: { label: 'تحليل ذكي', style: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  auto: { label: 'أوتوماتيك', style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
};

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatSavedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export interface BrochuresViewProps {
  brochures: SavedBrochure[];
  /** Opens the auction modal pre-loaded with this saved brochure. */
  onOpenInAuction?: (brochure: SavedBrochure) => void;
  onDelete: (id: string) => void;
  onOpenAuctionModal: () => void;
}

export function BrochuresView({
  brochures,
  onOpenInAuction,
  onDelete,
  onOpenAuctionModal,
}: BrochuresViewProps): ReactNode {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | SavedBrochure['source']>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim();
    return brochures.filter((b) => {
      if (sourceFilter !== 'all' && b.source !== sourceFilter) return false;
      if (q === '') return true;
      const haystack = `${b.title} ${b.auctionDate} ${b.fileName ?? ''} ${b.entities
        .map((e) => e.entityName)
        .join(' ')}`;
      return haystack.includes(q);
    });
  }, [brochures, search, sourceFilter]);

  const totals = useMemo(() => {
    const lots = brochures.reduce((sum, b) => sum + brochureLotsCount(b), 0);
    const entityCount = brochures.reduce((sum, b) => sum + b.entities.length, 0);
    return { sessions: brochures.length, lots, entityCount };
  }, [brochures]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'جلسات محفوظة', value: `${totals.sessions}`, icon: '📚' },
          { label: 'جهات', value: `${totals.entityCount}`, icon: '🏢' },
          { label: 'لوطات', value: `${totals.lots}`, icon: '📦' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="text-xl">{card.icon}</span>
            <p className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-white">{card.value}</p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder="🔍 ابحث بالتاريخ أو اسم الجهة أو اسم الملف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">كل المصادر</option>
          <option value="file">PDF مرفوع</option>
          <option value="ai">تحليل ذكي</option>
          <option value="auto">أوتوماتيك</option>
        </select>
        <button
          type="button"
          onClick={onOpenAuctionModal}
          className="min-h-[44px] cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-black whitespace-nowrap text-slate-950 shadow-md transition-all hover:scale-[1.02]"
        >
          📤 استيراد كراسة
        </button>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
          <p className="text-sm font-bold text-slate-400">
            {brochures.length === 0
              ? 'مكتبة الكراسات فاضية — استورد أول كراسة PDF من زر «استيراد كراسة» 📤'
              : 'لا توجد كراسات مطابقة للبحث'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((brochure) => {
            const lotsCount = brochureLotsCount(brochure);
            const source = SOURCE_LABELS[brochure.source];
            const isDeleteConfirm = deleteConfirmId === brochure.id;
            return (
              <li
                key={brochure.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-indigo-100 px-2.5 py-1 font-mono text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        📅 {formatDate(brochure.auctionDate)}
                      </span>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${source.style}`}>
                        {source.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-black break-words text-slate-900 dark:text-white">
                      {brochure.title}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>🏢 {brochure.entities.length} جهة</span>
                      <span>📦 {lotsCount} لوط</span>
                      {brochure.fileName ? <span>📄 {brochure.fileName}</span> : null}
                      <span>💾 {formatSavedAt(brochure.savedAt.toMillis())}</span>
                    </p>
                    {brochure.entities.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                          الجهات ({brochure.entities.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1 pr-3">
                          {brochure.entities.map((entity) => (
                            <li
                              key={entity.id}
                              className="flex items-start justify-between gap-2 text-[11px]"
                            >
                              <span className="min-w-0 flex-1 break-words font-bold text-slate-600 dark:text-slate-300">
                                {entity.entityName}
                              </span>
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {entity.lots.length} لوط
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                    {onOpenInAuction ? (
                      <button
                        type="button"
                        onClick={() => onOpenInAuction(brochure)}
                        className="min-h-[36px] cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-indigo-700"
                      >
                        🔨 ترسية
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (isDeleteConfirm) {
                          onDelete(brochure.id);
                          setDeleteConfirmId(null);
                        } else {
                          setDeleteConfirmId(brochure.id);
                        }
                      }}
                      className={`min-h-[36px] cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                        isDeleteConfirm
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400'
                      }`}
                    >
                      {isDeleteConfirm ? 'تأكيد الحذف؟ 🗑️' : '🗑️ حذف'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
