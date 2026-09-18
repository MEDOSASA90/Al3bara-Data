/**
 * NewBrochuresBanner — لما كراسات جديدة تتحلل في n8n يظهر اشعار فوق الـ Dashboard
 * - بيفحص الـ VPS endpoint كل 60 ثانية
 * - بيرجع الكراسات الجديدة (اللي مش متخزنة في localStorage)
 * - FCM push (اشعار فوري والتطبيق مقفول) لما توكنه متسجل
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { listAnalyzedBrochures, type AnalyzedBrochureSummary } from '../../services/analyzedBrochures';

const SEEN_KEY = 'al3bara_seen_analyzed_files';

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(files: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(files));
  } catch {
    // storage full — ignore
  }
}

export function useNewAnalyzedBrochures(): {
  fresh: AnalyzedBrochureSummary[];
  dismissAll: () => void;
  dismiss: (file: string) => void;
} {
  const [fresh, setFresh] = useState<AnalyzedBrochureSummary[]>([]);
  const seenRef = useRef<string[]>(readSeen());
  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    const check = async (): Promise<void> => {
      try {
        const items = await listAnalyzedBrochures();
        if (!alive) return;
        const seen = new Set(seenRef.current);
        const newOnes = items.filter((i) => !seen.has(i.file));
        // أي كراسة مش متعلّمة كمشوفة تظهر بالبانر (شاملة أول تحميل)
        if (newOnes.length > 0) {
          setFresh(newOnes);
        }
        firstLoad.current = false;
        // mark all as seen after showing
        seenRef.current = items.map((i) => i.file);
        writeSeen(seenRef.current);
      } catch {
        // endpoint unreachable — silent
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const dismissAll = (): void => setFresh([]);
  const dismiss = (file: string): void => setFresh((list) => list.filter((f) => f.file !== file));

  return { fresh, dismissAll, dismiss };
}

export function NewBrochuresBanner(): ReactNode {
  const { fresh, dismissAll, dismiss } = useNewAnalyzedBrochures();
  if (fresh.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl border border-emerald-300 bg-gradient-to-l from-emerald-50 to-teal-50 p-4 shadow-md dark:border-emerald-800 dark:from-emerald-950/50 dark:to-teal-950/40">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
          🔔 كراسات جديدة نزلت ({fresh.length}) — اتحللت في n8n
        </p>
        <button
          type="button"
          onClick={dismissAll}
          className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
        >
          إخفاء الكل
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {fresh.map((item) => (
          <li
            key={item.file}
            className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-200"
          >
            <span>
              📋 {item.title || item.file} — {item.auctionDate || 'بدون تاريخ'} ({item.lotsCount} لوط، {item.entitiesCount} جهة)
            </span>
            <button
              type="button"
              onClick={() => dismiss(item.file)}
              className="cursor-pointer rounded-md px-2 py-0.5 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
            >
              ✓
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
