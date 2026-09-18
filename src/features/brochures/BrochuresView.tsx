/**
 * BrochuresView — شاشة الكراسات المستقلة: تعرض الكراسات المحللة من n8n مباشرة
 * - تحميل تلقائي لما الشاشة تفتح
 * - كل كراسة تفتح في مودال الترسية والتسعير (استيراد نتيجة التحليل)
 * - رفع كراسة خارجية (PDF/DOCX) لتحليل n8n
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  listAnalyzedBrochures,
  fetchAnalyzedBrochure,
  uploadExternalBrochure,
  type AnalyzedBrochureSummary,
} from '../../services/analyzedBrochures';


interface ImportedBrochure {
  id: string;
  title: string;
  auctionDate: string;
  entities: { id: string; entityName: string; lots: { id: string; lotNumber: string; name: string; quantity: string; totalValue: number }[] }[];
}

function analyzedToBrochureData(a: unknown): ImportedBrochure {
  const raw = a as Record<string, unknown> | null;
  const rawEntities = Array.isArray(raw?.entities) ? (raw?.entities as Record<string, unknown>[]) : [];
  const entities = rawEntities.map((e, i) => {
    const rawLots = Array.isArray(e?.lots) ? (e.lots as Record<string, unknown>[]) : [];
    const lots = rawLots.map((l, j) => ({
      id: `lot-${i}-${j}`,
      lotNumber: String(l?.lotNumber ?? j + 1),
      name: String(l?.name ?? 'لوط'),
      quantity: String(l?.quantity ?? '1 عدد'),
      totalValue: Number(l?.totalValue ?? 0),
    }));
    return {
      id: `entity-${i}`,
      entityName: String(e?.entityName ?? e?.name ?? 'جهة'),
      lots,
    };
  });
  return {
    id: `analyzed-${String(raw?.file ?? Date.now())}`,
    title: String(raw?.title ?? 'كراسة محللة'),
    auctionDate: String(raw?.auctionDate ?? ''),
    entities,
  };
}

export function BrochuresView(): ReactNode {
  const [items, setItems] = useState<AnalyzedBrochureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [imported, setImported] = useState<BrochureData | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done'>('idle');

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const list = await listAnalyzedBrochures();
        if (alive) setItems(list);
      } catch (err) {
        if (alive) setError(`تعذر جلب الكراسات المحللة: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  async function handleImport(file: string): Promise<void> {
    setLoading(true);
    setError('');
    try {
      const analyzed = await fetchAnalyzedBrochure(file);
      setImported(analyzedToBrochureData(analyzed));
      setModalOpen(true);
    } catch (err) {
      setError(`تعذر استيراد نتيجة التحليل: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File): Promise<void> {
    setUploadState('uploading');
    setError('');
    try {
      await uploadExternalBrochure(file);
      setUploadState('done');
    } catch (err) {
      setUploadState('idle');
      setError(`فشل رفع الكراسة: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    }
  }

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">📄 كراسات المزادات المحللة (n8n)</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            الكراسات اللي اتحللت تلقائياً في الـ Workflow — دوس على أي كراسة لاستيرادها وترسيتها
          </p>
        </div>
        <label className="cursor-pointer rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-md transition-all hover:scale-[1.02]">
          {uploadState === 'uploading' ? '⏳ جاري الرفع...' : uploadState === 'done' ? '✅ اترفعت — n8n بيحللها' : '📤 رفع كراسة خارجية'}
          <input
            type="file"
            accept="application/pdf,.docx,.doc"
            className="hidden"
            disabled={uploadState === 'uploading'}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          ⚠️ {error}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          ⏳ جاري جلب الكراسات المحللة...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          📋 مفيش كراسات محللة لسه — ارفع كراسة خارجية أو استنى التحليل التلقائي
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.file}>
              <button
                type="button"
                onClick={() => void handleImport(item.file)}
                className="w-full cursor-pointer rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-indigo-50 p-4 text-right shadow-md transition-all hover:scale-[1.01] dark:border-violet-800 dark:from-violet-950/40 dark:to-indigo-950/30"
              >
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  📋 {item.title || item.file}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {item.entityName || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    {item.auctionDate || 'بدون تاريخ'}
                  </span>
                  <span className="rounded-lg bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {item.lotsCount} لوط
                  </span>
                  <span className="rounded-lg bg-teal-100 px-2 py-1 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                    {item.entitiesCount} جهة
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {imported ? (
        <div className="rounded-2xl border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <p className="mb-2 text-sm font-black text-indigo-800 dark:text-indigo-300">
            📄 {imported.title} — {imported.auctionDate}
          </p>
          {imported.entities.map((entity) => (
            <div key={entity.id} className="mb-3 rounded-xl bg-white/80 p-3 dark:bg-slate-800/80">
              <p className="text-xs font-black text-slate-900 dark:text-white">
                🏛️ {entity.entityName} ({entity.lots.length} لوط)
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {entity.lots.map((lot) => (
                  <li key={lot.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    لوط {lot.lotNumber}: {lot.name} — {lot.quantity} — قيمة: {lot.totalValue} ج
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            💡 للتسعير والترسية: افتح «كراسات جلسات المزادات» من لوحة التحكم واستورد الكراسة
          </p>
        </div>
      ) : null}
    </div>
  );
}
