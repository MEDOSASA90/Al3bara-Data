import { useMemo, useState, type ReactNode } from 'react';
import type { Client } from '../../domain/types';
import {
  clientsNeedingMigration,
  countLegacyTransactions,
} from '../../domain/clientMerge';
import {
  migrateClientTransactions,
  type MigrationProgress,
} from '../../data/repositories';
import { downloadBackup } from '../../utils/backup';
import { useToast } from '../../components/ui/Toast';

export interface SettingsViewProps {
  userId: string;
  userEmail: string | null;
  appVersion: string;
  advanceClients: Client[];
  workClients: Client[];
}

type MigrationState =
  | { status: 'idle' }
  | { status: 'running'; progress: MigrationProgress }
  | { status: 'done'; clients: number; txs: number }
  | { status: 'error'; message: string };

export function SettingsView({
  userId,
  userEmail,
  appVersion,
  advanceClients,
  workClients,
}: SettingsViewProps): ReactNode {
  const { showToast: toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [migration, setMigration] = useState<MigrationState>({ status: 'idle' });

  const pending = useMemo(
    () => [...clientsNeedingMigration(advanceClients), ...clientsNeedingMigration(workClients)],
    [advanceClients, workClients],
  );
  const pendingTxCount = useMemo(() => countLegacyTransactions(pending), [pending]);
  const allMigrated = pending.length === 0;

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      const result = await downloadBackup();
      if (result.ok) {
        toast(`تم تنزيل النسخة الاحتياطية (${result.fileName}) ✅`, 'success');
      } else {
        toast(`فشل التصدير: ${result.error ?? 'خطأ غير متوقع'}`, 'error');
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleMigrate(): Promise<void> {
    if (migration.status === 'running') return;
    setMigration({ status: 'running', progress: { clientName: '', index: 0, total: pending.length, movedTxs: 0 } });
    let migratedClients = 0;
    let movedTransactions = 0;
    try {
      let index = 0;
      for (const client of pending) {
        index += 1;
        const type = advanceClients.some((c) => c.id === client.id) ? 'advance' : 'work';
        const result = await migrateClientTransactions(
          type,
          client.id,
          client.name,
          userId,
          index,
          pending.length,
          (progress) => setMigration({ status: 'running', progress }),
        );
        if (result.moved > 0) migratedClients += 1;
        movedTransactions += result.moved;
      }
      setMigration({ status: 'done', clients: migratedClients, txs: movedTransactions });
      toast('تم ترحيل الحركات بنجاح ✅', 'success');
    } catch (error) {
      setMigration({
        status: 'error',
        message: error instanceof Error ? error.message : 'خطأ غير متوقع',
      });
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* الحساب */}
      <section className="card card-pad space-y-2">
        <h2 className="text-base font-black text-slate-900 dark:text-white">👤 الحساب</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          مسجّل الدخول: <span className="font-bold">{userEmail ?? userId}</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          نسخة التطبيق: <span className="font-mono font-bold">{appVersion}</span>
        </p>
      </section>

      {/* النسخة الاحتياطية */}
      <section className="card card-pad space-y-3">
        <h2 className="text-base font-black text-slate-900 dark:text-white">💾 نسخة احتياطية</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          نزّل ملف JSON فيه كل بياناتك (حسابات، حركات، جهات، لوطات، شراكات، كراسات) واحتفظ به في مكان آمن.
        </p>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? '⏳ جاري التصدير...' : '⬇️ تنزيل النسخة الاحتياطية'}
        </button>
      </section>

      {/* ترحيل الحركات */}
      <section className="card card-pad space-y-3">
        <h2 className="text-base font-black text-slate-900 dark:text-white">🗄️ ترحيل الحركات القديمة</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          الحركات القديمة متخزنة داخل ملف العميل نفسه — ده بيعرّض البيانات لضياع عند الاستخدام من أكتر من
          جهاز وبيلمس حد أقصى للحجم. الترحيل بينقلها لمكان أأمن (مجموعة فرعية لكل عميل) مرة واحدة.
        </p>
        {allMigrated ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✅ كل الحركات مترحّلة — مفيش حاجة محتاجة نقل.
          </p>
        ) : (
          <>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️ فيه {pending.length} عميل عليهم {pendingTxCount} حركة محتاجة ترحيل.
            </p>
            <button
              type="button"
              onClick={() => void handleMigrate()}
              disabled={migration.status === 'running'}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {migration.status === 'running' ? '⏳ جاري الترحيل...' : '🚚 ابدأ الترحيل الآن'}
            </button>
            {migration.status === 'running' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                جاري نقل: {migration.progress.clientName} ({migration.progress.index}/{migration.progress.total})
              </p>
            ) : null}
            {migration.status === 'done' ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✅ تم ترحيل {migration.txs} حركة لـ {migration.clients} عميل.
              </p>
            ) : null}
            {migration.status === 'error' ? (
              <p className="rounded-xl bg-debit-50 px-3 py-2 text-sm font-bold text-debit-700 dark:bg-debit-600/10 dark:text-rose-300">
                ⚠️ فشل الترحيل: {migration.message} — الترحيل آمن لإعادة المحاولة (البيانات ما بتفقدش).
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
