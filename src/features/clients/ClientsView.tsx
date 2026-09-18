import { useMemo, useState, type ReactNode } from 'react';
import type { Client, ClientType, Transaction } from '../../domain/types';
import { clientBalance, groupTransactionsByDay, summarizeTransactions } from '../../domain/finance';
import { formatCurrency, formatDate, getDirectImageUrl } from '../../utils/format';
import { BalanceDisplay } from '../../components/ui/BalanceDisplay';
import { AnalysisModal } from '../ai/AnalysisModal';
import { summarizeClient } from '../../ai/sectionAnalysis';

export type ClientBalanceFilter = 'all' | 'debit' | 'credit' | 'zero';

export interface ClientsViewProps {
  kind: ClientType;
  clients: Client[];
  onAddClient: () => void;
  onDeleteClient: (clientId: string) => void;
  onAddTransaction: (client: Client) => void;
  onEditTransaction: (client: Client, transaction: Transaction) => void;
  onDeleteTransaction: (clientId: string, transactionId: string) => void;
  onAddPayment: (client: Client) => void;
  onExportTransaction: (client: Client, transaction: Transaction) => void;
  onExportSummary: (client: Client) => void;
  onSettleClient: (client: Client, total: number) => void;
}

/** Zero-balance margin shared by the filter and the settle button. */
const ZERO_MARGIN = 0.05;

function phoneList(client: Client): string[] {
  if (client.phone === undefined) return [];
  return Array.isArray(client.phone) ? client.phone : [client.phone];
}

function hasValidDate(tx: Transaction): boolean {
  return !!tx.date && typeof tx.date.toDate === 'function';
}

function SummaryPanel(props: { clients: Client[] }): ReactNode {
  const { clients } = props;
  const summary = useMemo(() => {
    const active = (clients ?? []).filter((c) => !c.isArchived).flatMap((c) => c.transactions ?? []);
    return summarizeTransactions(active);
  }, [clients]);

  return (
    <div
      dir="rtl"
      className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-4 text-right shadow-sm md:p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-2 text-white shadow-md">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">الملخص المالي العام</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        <div className="rounded-2xl border border-rose-200/60 bg-rose-50/70 p-5 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-rose-700 uppercase dark:text-rose-300">
              إجمالي المدين (مشتريات)
            </span>
            <span className="text-lg" role="img" aria-label="debit">
              📈
            </span>
          </div>
          <p className="font-mono text-xl font-black text-rose-700" dir="ltr">
            {formatCurrency(summary.totalDebit)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">إجمالي الديون المستحقة للشركة</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              إجمالي الدائن (سداد)
            </span>
            <span className="text-lg" role="img" aria-label="credit">
              📉
            </span>
          </div>
          <p className="font-mono text-xl font-black text-emerald-700" dir="ltr">
            {formatCurrency(summary.totalCredit)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">إجمالي المبالغ المحصلة والمسددة</p>
        </div>

        <div
          className={`rounded-2xl border p-5 ${
            summary.netBalance >= 0
              ? 'border-indigo-200/60 bg-indigo-50/70 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300'
              : 'border-amber-200/60 bg-amber-50/70 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase">صافي رصيد الديون</span>
            <span className="text-lg" role="img" aria-label="balance">
              ⚖️
            </span>
          </div>
          <p className="font-mono text-xl font-black" dir="ltr">
            {formatCurrency(Math.abs(summary.netBalance))}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {summary.netBalance >= 0 ? '✍️ مستحق للشركة بطرف العملاء' : '🤝 أرصدة دفع مقدمة لصالح العملاء'}
          </p>
        </div>
      </div>
    </div>
  );
}

interface GroupItemProps {
  transactions: Transaction[];
  client: Client;
  onEditTransaction: (client: Client, transaction: Transaction) => void;
  onDeleteTransaction: (clientId: string, transactionId: string) => void;
  onExportTransaction: (client: Client, transaction: Transaction) => void;
}

function TransactionGroupItem(props: GroupItemProps): ReactNode {
  const { transactions, client, onEditTransaction, onDeleteTransaction, onExportTransaction } = props;
  const [expanded, setExpanded] = useState(false);

  if (transactions.length === 0) return null;

  if (transactions.length === 1) {
    const tx = transactions[0];
    if (!tx) return null;
    const isPayment = tx.amount < 0;
    return (
      <div
        className={`rounded-2xl border p-4 transition-all duration-200 hover:shadow-sm ${
          isPayment
            ? 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
            : 'border-slate-200/60 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p
                className={`font-mono text-lg font-black ${isPayment ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}
                dir="ltr"
              >
                {formatCurrency(tx.amount)}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                  isPayment
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {isPayment ? 'سداد' : 'شراء'}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{formatDate(tx.date)}</p>
            {tx.notes !== '' && (
              <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                بيان: {tx.notes}
              </p>
            )}
            {tx.image && (
              <a
                href={getDirectImageUrl(tx.image.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                📸 عرض مستند الحركة المرفق
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => onEditTransaction(client, tx)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              تعديل
            </button>
            <button
              type="button"
              onClick={() => onDeleteTransaction(client.id, tx.id)}
              className="cursor-pointer rounded-lg border border-rose-200/50 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            >
              حذف
            </button>
            <button
              type="button"
              onClick={() => onExportTransaction(client, tx)}
              className="cursor-pointer rounded-lg border border-indigo-200/60 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
            >
              🖨️ طباعة PDF
            </button>
          </div>
        </div>

        {(tx.items ?? []).length > 0 && (
          <div className="mt-4 border-t border-slate-200/60 pt-3.5 dark:border-slate-700">
            <h5 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">أصناف البضائع المستلمة:</h5>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(tx.items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400" dir="ltr">
                      {item.quantity} kg × {formatCurrency(item.pricePerKilo)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-xs font-black text-slate-900 dark:text-slate-100" dir="ltr">
                      {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                    </p>
                    {item.image && (
                      <a
                        href={getDirectImageUrl(item.image.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-[9px] text-indigo-600 hover:underline"
                      >
                        🖼️ عرض الصورة
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const isTotalPayment = totalAmount < 0;
  const first = transactions[0];
  const allNotes = Array.from(new Set(transactions.map((t) => t.notes).filter((n) => n !== '')));

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 ${
        isTotalPayment
          ? 'border-emerald-100 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-indigo-100 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30'
      }`}
    >
      <div
        className="flex cursor-pointer items-center justify-between p-4 transition-colors select-none hover:bg-white/40 dark:hover:bg-slate-800/40"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-lg font-black ${isTotalPayment ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-800 dark:text-indigo-200'}`}
              dir="ltr"
            >
              {formatCurrency(totalAmount)}
            </span>
            <span className="rounded-full border border-slate-200/50 bg-white px-2 py-0.5 text-[9px] font-extrabold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              مجمّع ({transactions.length} حركات)
            </span>
          </div>
          <p className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {first ? formatDate(first.date) : ''}
          </p>
          {allNotes.length > 0 && (
            <p className="mt-1 max-w-xs truncate text-[10px] font-medium text-slate-600 md:max-w-md dark:text-slate-300">
              البيان: {allNotes.join(' ، ')}
            </p>
          )}
        </div>
        <div className="text-slate-500 dark:text-slate-400">
          <svg
            className={`h-5 w-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5 border-t border-slate-200/40 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          {transactions.map((tx) => {
            const isPayment = tx.amount < 0;
            return (
              <div
                key={tx.id}
                className={`flex items-start justify-between gap-2 rounded-xl border p-3.5 shadow-sm ${
                  isPayment
                    ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <div>
                  <p
                    className={`font-mono text-sm font-black ${isPayment ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}
                    dir="ltr"
                  >
                    {formatCurrency(tx.amount)}
                  </p>
                  {tx.notes !== '' && (
                    <p className="mt-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      بيان: {tx.notes}
                    </p>
                  )}
                  {tx.image && (
                    <a
                      href={getDirectImageUrl(tx.image.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex cursor-pointer items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      🖼️ عرض المستند
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEditTransaction(client, tx)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:border-slate-600 dark:bg-slate-800 dark:text-indigo-300"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(client.id, tx.id)}
                    className="cursor-pointer rounded-lg border border-rose-200/50 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  kind: ClientType;
  onDeleteClient: (clientId: string) => void;
  onAddTransaction: (client: Client) => void;
  onEditTransaction: (client: Client, transaction: Transaction) => void;
  onDeleteTransaction: (clientId: string, transactionId: string) => void;
  onAddPayment: (client: Client) => void;
  onExportTransaction: (client: Client, transaction: Transaction) => void;
  onExportSummary: (client: Client) => void;
  onSettleClient: (client: Client, total: number) => void;
}

function ClientCard(props: ClientCardProps): ReactNode {
  const {
    client,
    kind,
    onDeleteClient,
    onAddTransaction,
    onEditTransaction,
    onDeleteTransaction,
    onAddPayment,
    onExportTransaction,
    onExportSummary,
    onSettleClient,
  } = props;
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const total = clientBalance({ transactions: client.transactions ?? [] });
  const phones = useMemo(() => phoneList(client), [client]);

  const groups = useMemo(() => {
    const valid = (client.transactions ?? []).filter(hasValidDate);
    if (kind === 'work') {
      return [...valid]
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
        .map((tx) => ({ key: tx.id, transactions: [tx] }));
    }
    return groupTransactionsByDay(valid).map((g) => ({ key: g.key, transactions: g.transactions }));
  }, [client.transactions, kind]);

  async function copyPhoneNumber(phone: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      window.setTimeout(() => setCopiedPhone((cur) => (cur === phone ? null : cur)), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div
      className={`rounded-3xl border p-4 shadow-md transition-all duration-300 md:p-5 dark:bg-slate-900 ${
        client.isBuyer === true
          ? 'border-indigo-200/70 bg-gradient-to-br from-indigo-50/40 via-white to-white hover:shadow-lg dark:border-indigo-900 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900'
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-lg dark:border-slate-700'
      }`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="group flex cursor-pointer items-center gap-3 select-none"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-transform duration-200 dark:bg-slate-800 dark:text-slate-300 ${
              isExpanded ? 'rotate-180 bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-300' : ''
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <h3 className="min-w-0 flex-1 text-lg font-extrabold break-words text-slate-800 transition-colors group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            {client.name}
          </h3>

          {client.isBuyer === true && (
            <span className="rounded-full border border-indigo-200/75 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
              مشتري
            </span>
          )}

          {phones.length > 0 && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowPhoneDropdown((prev) => !prev)}
                title="أرقام الهاتف"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                📞
              </button>
              {showPhoneDropdown && (
                <>
                  <div className="fixed inset-0 z-10 cursor-default" onClick={() => setShowPhoneDropdown(false)} />
                  <div className="absolute top-full left-0 z-20 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white p-2 text-right shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-2 border-b border-slate-50 px-2 pb-1 text-[10px] font-bold text-slate-400 dark:border-slate-700">
                      أرقام الهواتف المسجلة
                    </p>
                    {phones.map((phone) => (
                      <button
                        key={phone}
                        type="button"
                        onClick={() => void copyPhoneNumber(phone)}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-right transition-all duration-150 hover:bg-cyan-50 dark:hover:bg-slate-700"
                      >
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{phone}</span>
                        {copiedPhone === phone ? (
                          <span className="text-xs text-emerald-600">✓ تم النسخ</span>
                        ) : (
                          <span className="text-xs text-slate-300">📋 نسخ</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onExportSummary(client)}
            className="cursor-pointer rounded-xl border border-slate-200/60 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            🖨️ كشف حساب
          </button>
          <button
            type="button"
            onClick={() => setShowAnalysis(true)}
            className="cursor-pointer rounded-xl border border-indigo-200/60 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
          >
            ✨ تحليل ذكي
          </button>
          <button
            type="button"
            onClick={() => onAddPayment(client)}
            className="cursor-pointer rounded-xl border border-emerald-200/50 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          >
            💵 سداد نقدية
          </button>
          <button
            type="button"
            onClick={() => onAddTransaction(client)}
            className="cursor-pointer rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-cyan-600"
          >
            ➕ إضافة حركة
          </button>
          <button
            type="button"
            onClick={() => onDeleteClient(client.id)}
            className="cursor-pointer rounded-xl border border-rose-200/50 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
          >
            حذف
          </button>
        </div>
        <AnalysisModal
          isOpen={showAnalysis}
          onClose={() => setShowAnalysis(false)}
          title={`✨ تحليل حساب ${client.name}`}
          run={() => summarizeClient(client, kind === 'work' ? 'شغل' : 'سلف')}
        />
      </div>

      {isExpanded ? (
        <>
          <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
            {groups.length > 0 ? (
              groups.map((group) => (
                <TransactionGroupItem
                  key={group.key}
                  transactions={group.transactions}
                  client={client}
                  onEditTransaction={onEditTransaction}
                  onDeleteTransaction={onDeleteTransaction}
                  onExportTransaction={onExportTransaction}
                />
              ))
            ) : (
              <p className="py-6 text-center text-xs font-medium text-slate-400">
                لا توجد أي حركات مسجلة لهذا العميل حالياً.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            {Math.abs(total) > 0 ? (
              <button
                type="button"
                onClick={() => onSettleClient(client, total)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:shadow-lg"
              >
                تسوية الرصيد بالكامل
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200/50 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <span>✅ الحساب مُصفّر ومسدد بالكامل</span>
              </div>
            )}
            <BalanceDisplay total={total} />
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <span>حركات العميل مخفية حالياً</span>
          <span
            className={`font-mono font-black ${total >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}
            dir="ltr"
          >
            {formatCurrency(Math.abs(total))} {total >= 0 ? '(مدين)' : '(دائن)'}
          </span>
        </div>
      )}
    </div>
  );
}

export function ClientsView(props: ClientsViewProps): ReactNode {
  const {
    kind,
    clients,
    onAddClient,
    onDeleteClient,
    onAddTransaction,
    onEditTransaction,
    onDeleteTransaction,
    onAddPayment,
    onExportTransaction,
    onExportSummary,
    onSettleClient,
  } = props;

  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<ClientBalanceFilter>('all');

  const filteredClients = useMemo(() => {
    let result = clients ?? [];

    const query = searchTerm.trim().toLowerCase();
    if (query !== '') {
      result = result.filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          phoneList(client).some((phone) => phone.toLowerCase().includes(query)),
      );
    }

    if (balanceFilter !== 'all') {
      result = result.filter((client) => {
        const total = clientBalance({ transactions: client.transactions ?? [] });
        if (balanceFilter === 'debit') return total > ZERO_MARGIN;
        if (balanceFilter === 'credit') return total < -ZERO_MARGIN;
        return Math.abs(total) <= ZERO_MARGIN;
      });
    }

    return result;
  }, [clients, searchTerm, balanceFilter]);

  const activeClientsCount = useMemo(() => (clients ?? []).filter((c) => !c.isArchived).length, [clients]);

  const filterButton = (value: ClientBalanceFilter, label: string, activeClass: string): ReactNode => (
    <button
      key={value}
      type="button"
      onClick={() => setBalanceFilter(value)}
      className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition-all duration-150 min-h-[40px] ${
        balanceFilter === value
          ? `border border-slate-200/20 bg-white shadow-sm ${activeClass} dark:border-slate-600 dark:bg-slate-800`
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="text-right" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 md:text-3xl dark:text-slate-100">
            {kind === 'work' ? 'إدارة حسابات الشغل والعملاء' : 'إدارة السلف والعهد النقدية'}
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            متابعة حركة المبيعات، المدفوعات، والأرصدة المتبقية بطرف العملاء.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddClient}
          className="cursor-pointer rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
        >
          ➕ إضافة عميل جديد
        </button>
      </div>

      <SummaryPanel clients={clients} />

      <div className="mb-6 space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <div className="relative w-full md:flex-1">
            <input
              type="text"
              placeholder="🔍 ابحث عن العميل بالاسم أو برقم الهاتف المرفق..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {searchTerm !== '' && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                مسح
              </button>
            )}
          </div>

          <div className="flex w-full shrink-0 overflow-x-auto rounded-xl border border-slate-200/50 bg-slate-100 p-1 md:w-auto dark:border-slate-700 dark:bg-slate-800">
            {filterButton('all', `الكل (${activeClientsCount})`, 'text-slate-800 dark:text-slate-100')}
            {filterButton('debit', 'المدينين فقط', 'text-rose-600')}
            {filterButton('credit', 'الدائنين فقط', 'text-emerald-600')}
            {filterButton('zero', 'مسددين بالكامل', 'text-indigo-600')}
          </div>
        </div>

        {(searchTerm !== '' || balanceFilter !== 'all') && (
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            عرض {filteredClients.length} من أصل {clients.length} عملاء يطابقون خيارات التصفية الحالية.
          </p>
        )}
      </div>

      {filteredClients.length > 0 ? (
        <div className="space-y-6">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              kind={kind}
              onDeleteClient={onDeleteClient}
              onAddTransaction={onAddTransaction}
              onEditTransaction={onEditTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onAddPayment={onAddPayment}
              onExportTransaction={onExportTransaction}
              onExportSummary={onExportSummary}
              onSettleClient={onSettleClient}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {clients.length === 0
              ? 'لا يوجد أي عملاء مسجلين حالياً. اضغط على "إضافة عميل جديد" للبدء.'
              : 'لا توجد نتائج تطابق شروط الفلترة والبحث المحددة.'}
          </p>
        </div>
      )}
    </div>
  );
}
