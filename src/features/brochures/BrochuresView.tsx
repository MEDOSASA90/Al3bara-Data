/**
 * BrochuresView — شاشة الكراسات المحللة من النظام المستقل (n8n على VPS)
 * - تحميل تلقائي لما الشاشة تفتح + كل دقيقة
 * - كل كراسة: عرض اللوطات والجهات (زي التحليل الداخلي) + كراسة الشروط PDF + استيراد للترسية
 * - رفع كراسة PDF/DOCX → النظام يحللها والنتيجة تظهر
 */
import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../config/firebase';
import {
  listAnalyzedBrochures,
  fetchAnalyzedBrochure,
  uploadExternalBrochure,
  brochurePdfUrl,
  type AnalyzedBrochure,
  type AnalyzedBrochureSummary,
} from '../../services/analyzedBrochures';

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function formatAnalyzedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function BrochuresView(): ReactNode {
  const [items, setItems] = useState<AnalyzedBrochureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imported, setImported] = useState<AnalyzedBrochure | null>(null);
  const [importing, setImporting] = useState('');
  const [showPdf, setShowPdf] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [uploadMsg, setUploadMsg] = useState('');
  /** Firebase uid — الكراسات المرفوعة بيه خاصة بيه (ترجع له هو بس). */
  const [uid, setUid] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      setUid(firebaseUser?.uid ?? '');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        // القايمة العامة + كراساتي الخاصة (لو مسجل) — في قايمة واحدة
        const [publicList, mineList] = await Promise.all([
          listAnalyzedBrochures(),
          uid ? listAnalyzedBrochures(uid) : Promise.resolve([]),
        ]);
        if (!alive) return;
        const mineFiles = new Set(mineList.map((m) => m.file));
        const merged = [...mineList, ...publicList.filter((p) => !mineFiles.has(p.file))];
        setItems(merged);
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
  }, [uid]);

  async function handleImport(file: string): Promise<void> {
    setImporting(file);
    setError('');
    try {
      const analyzed = await fetchAnalyzedBrochure(file);
      setImported(analyzed);
    } catch (err) {
      setError(`تعذر استيراد نتيجة التحليل: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setImporting('');
    }
  }

  async function handleUpload(file: File): Promise<void> {
    if (uid === '') {
      setError('لازم تسجل دخول الأول — الكراسة بتتحلل باسمك وترجع ليك بس');
      return;
    }
    setUploadState('uploading');
    setUploadMsg(`⏳ جاري رفع ${file.name} — النظام يحللها باسمك والنتيجة ترجع ليك بس`);
    setError('');
    try {
      await uploadExternalBrochure(file, uid);
      setUploadState('done');
      setUploadMsg(`✅ ${file.name} اترفعت — بتتحلل على النظام والنتيجة خاصة بيك (مش بتظهر لباقي المستخدمين)`);
      setLoading(true);
      window.setTimeout(() => {
        Promise.all([listAnalyzedBrochures(), listAnalyzedBrochures(uid)])
          .then(([publicList, mineList]) => {
            const mineFiles = new Set(mineList.map((m) => m.file));
            setItems([...mineList, ...publicList.filter((p) => !mineFiles.has(p.file))]);
          })
          .catch(() => undefined)
          .finally(() => setLoading(false));
      }, 8000);
    } catch (err) {
      setUploadState('idle');
      setUploadMsg('');
      setError(`فشل رفع الكراسة: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    }
  }

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">📋 الكراسات المحللة (النظام)</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            التحليل بيتم على السيرفر بـ Gemini — دوس على أي كراسة لعرض اللوطات والجهات وكراسة الشروط
          </p>
        </div>
        <label className="cursor-pointer rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-md transition-all hover:scale-[1.02]">
          {uploadState === 'uploading' ? '⏳ جاري الرفع...' : '📤 رفع كراسة PDF'}
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

      {uploadMsg ? (
        <p className={`rounded-xl border px-3 py-2 text-xs font-bold ${uploadState === 'done' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'}`}>
          {uploadMsg}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          ⚠️ {error}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          ⏳ جاري جلب الكراسات المحللة من النظام...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
          📋 مفيش كراسات محللة لسه — ارفع كراسة PDF أو استنى تحليل النظام التلقائي
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => {
            const isOpen = imported?.file === item.file;
            const isImporting = importing === item.file;
            const hasPdf = item.sourcePdf !== '';
            return (
              <li key={item.file} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => (isOpen ? setImported(null) : void handleImport(item.file))}
                  className="w-full cursor-pointer text-right"
                >
                  <p className="text-sm font-black break-words text-slate-900 dark:text-white">
                    📋 {item.title || item.entityName || item.file}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                    {item.auctionDate ? (
                      <span className="rounded-lg bg-indigo-100 px-2 py-1 font-mono text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        📅 {formatDate(item.auctionDate)}
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {item.lotsCount} لوط
                    </span>
                    <span className="rounded-lg bg-teal-100 px-2 py-1 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      {item.entitiesCount} جهة
                    </span>
                    {item.source === 'external-upload' ? (
                      <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        🔒 خاصة بيك
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    اتحللت {formatAnalyzedAt(item.analyzedAt)}
                  </p>
                </button>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (isOpen ? setImported(null) : void handleImport(item.file))}
                    disabled={isImporting}
                    className="min-h-[36px] cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isImporting ? '⏳...' : isOpen ? 'إخفاء اللوطات ▲' : '📦 عرض اللوطات والجهات'}
                  </button>
                  {hasPdf ? (
                    <button
                      type="button"
                      onClick={() => setShowPdf(showPdf === item.file ? null : item.file)}
                      className="min-h-[36px] cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {showPdf === item.file ? 'إغلاق الكراسة ✕' : '📄 كراسة الشروط'}
                    </button>
                  ) : null}
                </div>

                {/* كراسة الشروط — الـ PDF الأصلي من النظام */}
                {showPdf === item.file && hasPdf ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <iframe
                      src={brochurePdfUrl(item.sourcePdf)}
                      title={`كراسة الشروط — ${item.sourcePdf}`}
                      className="h-[500px] w-full bg-white"
                    />
                    <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">📄 {item.sourcePdf}</span>
                      <a
                        href={brochurePdfUrl(item.sourcePdf)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        فتح في تبويب جديد ↗
                      </a>
                    </div>
                  </div>
                ) : null}

                {/* اللوطات والجهات — نفس عرض التحليل الداخلي */}
                {isOpen ? (
                  <div className="mt-3 space-y-3">
                    {imported && imported.notes ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold break-words text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        📝 {imported.notes}
                      </p>
                    ) : null}
                    {imported && imported.documentsRequired && imported.documentsRequired.length > 0 ? (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <p className="text-[11px] font-black text-slate-600 dark:text-slate-300">📋 المستندات المطلوبة:</p>
                        <ul className="mt-1 space-y-0.5 pr-3">
                          {imported.documentsRequired.map((doc) => (
                            <li key={doc} className="text-[11px] font-bold text-slate-500 dark:text-slate-400">• {doc}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {imported && imported.entities.length > 0 ? (
                      imported.entities.map((entity) => (
                        <div key={entity.entityName} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                          <p className="text-xs font-black break-words text-slate-900 dark:text-white">
                            🏛️ {entity.entityName} ({entity.lots.length} لوط)
                          </p>
                          {entity.location ? (
                            <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">📍 {entity.location}</p>
                          ) : null}
                          <ul className="mt-2 space-y-1">
                            {entity.lots.map((lot) => (
                              <li
                                key={`${entity.entityName}-${lot.lotNumber}-${lot.name}`}
                                className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-[11px] dark:bg-slate-900/60"
                              >
                                <span className="min-w-0 flex-1 break-words font-bold text-slate-700 dark:text-slate-200">
                                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">لوط {lot.lotNumber}:</span> {lot.name}
                                </span>
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-bold whitespace-nowrap text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  {lot.quantity}{lot.unit ? ` ${lot.unit}` : ''}
                                  {lot.condition ? ` • ${lot.condition}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-400 dark:bg-slate-800/60">
                        مفيش لوطات مستخرجة من الكراسة دي
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
