import { useMemo, useState, type ReactNode } from 'react';
import type { Client, Entity, Lot, Transaction } from '../../domain/types';
import { clientBalance, groupTransactionsByDay } from '../../domain/finance';
import { formatCurrency, formatDate } from '../../utils/format';
import { BalanceDisplay } from '../../components/ui/BalanceDisplay';

export type ArchiveBalanceFilter = 'all' | 'debit' | 'credit';

export type ArchiveMenuTarget = 'lots' | 'work' | 'advances';

export interface ArchiveClientsViewProps {
  clients: Client[];
  kindLabel: string;
  onRestore: (client: Client) => void;
  onExportClient: (client: Client) => void;
  onExportAll: (clients: Client[]) => void;
}

export interface ArchiveLotsViewProps {
  entities: Entity[];
  onRestoreLot: (lot: Lot, entityId: string) => void;
}

export interface ArchiveMenuCounts {
  archivedLots: number;
  archivedAdvances: number;
  archivedWork: number;
}

export interface ArchiveMenuViewProps {
  counts: ArchiveMenuCounts;
  onNavigate: (target: ArchiveMenuTarget) => void;
  onExportReport: () => void;
}

function ArchivedClientCard(props: {
  client: Client;
  onRestore: (client: Client) => void;
  onExportClient: (client: Client) => void;
}): ReactNode {
  const { client, onRestore, onExportClient } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const total = clientBalance(client);
  const groups = useMemo(() => groupTransactionsByDay(client.transactions ?? []), [client.transactions]);

  return (
    <div dir="rtl" className="rounded-2xl border border-slate-300/80 bg-slate-50 p-4 text-right shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="group flex cursor-pointer select-none items-center gap-2.5 outline-none"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-500 transition-transform duration-200 dark:bg-slate-700 dark:text-slate-300 ${
              isExpanded ? 'rotate-180 bg-slate-300 dark:bg-slate-600' : ''
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
          <span className="text-sm font-extrabold text-slate-800 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
            {client.name}
          </span>
          <span className="rounded-full border border-slate-300 bg-slate-200 px-2.5 py-0.5 text-[9px] font-extrabold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            مؤرشف
          </span>
        </button>
        <div className="flex select-none items-center gap-2">
          <button
            type="button"
            onClick={() => onRestore(client)}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700"
          >
            🔄 استرجاع للنشط
          </button>
          <button
            type="button"
            onClick={() => onExportClient(client)}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            🖨️ كشف حساب
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3.5 border-t border-slate-200 pt-3.5 dark:border-slate-700">
          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.key} className="space-y-2 border-b border-slate-200/40 pb-3 last:border-b-0 last:pb-0 dark:border-slate-700/40">
                <p className="text-[10px] font-black text-slate-400">
                  {group.transactions[0] ? formatDate(group.transactions[0].date) : ''}
                </p>
                {group.transactions.map((t: Transaction) => {
                  const isPayment = t.amount < 0;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-white/70 p-3 shadow-inner dark:border-slate-700/50 dark:bg-slate-800/70"
                    >
                      <div>
                        <p dir="ltr" className={`font-mono text-sm font-black ${isPayment ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {formatCurrency(t.amount)}
                        </p>
                        {t.notes && <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">بيان: {t.notes}</p>}
                      </div>
                      {t.image && (
                        <a href={t.image.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                          🖼️ عرض المستند
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <p className="py-3 text-center text-xs font-medium text-slate-400">لا توجد حركات مسجلة لهذا العميل.</p>
          )}

          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 p-3.5 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الرصيد الكلي المؤرشف:</span>
            <BalanceDisplay total={total} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ArchiveClientsView(props: ArchiveClientsViewProps): ReactNode {
  const { clients, kindLabel, onRestore, onExportClient, onExportAll } = props;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ArchiveBalanceFilter>('all');

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = term.length === 0 || client.name.toLowerCase().includes(term);
      const total = clientBalance(client);
      const matchesFilter = filterType === 'all' || (filterType === 'debit' && total >= 0) || (filterType === 'credit' && total < 0);
      return matchesSearch && matchesFilter;
    });
  }, [clients, searchTerm, filterType]);

  if (clients.length === 0) {
    return (
      <div dir="rtl" className="py-12 text-center font-semibold text-slate-400">
        <div className="mb-3 text-5xl">📭</div>
        <p className="text-sm">لا يوجد أي عملاء مؤرشفين في هذا القسم.</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-5 text-right">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-700 bg-slate-800 p-5 text-white shadow-md dark:border-slate-600 dark:bg-slate-900">
        <div>
          <h2 className="mb-1 text-sm font-extrabold">العملاء المؤرشفين — {kindLabel}</h2>
          <p className="text-xs font-semibold text-slate-300">
            إجمالي مؤرشف: {clients.length} | معروض للتصفية: {filteredClients.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onExportAll(filteredClients)}
          className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-indigo-700"
        >
          🖨️ تصدير قائمة الكل ({filteredClients.length})
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="🔍 ابحث عن عميل مؤرشف باسمه..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 sm:min-w-[200px] sm:flex-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <select
          value={filterType}
          onChange={(event) => setFilterType(event.target.value as ArchiveBalanceFilter)}
          className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-cyan-500 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          aria-label="تصفية حسب الرصيد"
        >
          <option value="all">كل الأرصدة</option>
          <option value="debit">رصيد مدين</option>
          <option value="credit">رصيد دائن</option>
        </select>
      </div>

      {filteredClients.length > 0 ? (
        <div className="space-y-4">
          {filteredClients.map((client) => (
            <ArchivedClientCard key={client.id} client={client} onRestore={onRestore} onExportClient={onExportClient} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs font-semibold text-slate-400">لا توجد نتائج تطابق شروط التصفية.</p>
      )}
    </div>
  );
}

export function ArchiveLotsView(props: ArchiveLotsViewProps): ReactNode {
  const { entities, onRestoreLot } = props;

  const archivedByEntity = useMemo(
    () =>
      entities
        .map((entity) => ({ entity, lots: (entity.lots ?? []).filter((lot) => lot.isArchived) }))
        .filter((entry) => entry.lots.length > 0),
    [entities],
  );

  if (archivedByEntity.length === 0) {
    return (
      <div dir="rtl" className="py-12 text-center font-semibold text-slate-400">
        <div className="mb-3 text-5xl">📭</div>
        <p className="text-sm">لا يوجد لوطات مؤرشفة بالمستودع حالياً.</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 text-right">
      {archivedByEntity.map(({ entity, lots }) => (
        <div key={entity.id} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="mb-2 text-sm font-extrabold break-words text-slate-500 dark:text-slate-300">الجهة: {entity.name}</h3>
          <div className="space-y-3">
            {lots.map((lot) => (
              <div
                key={lot.id}
                className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="text-right">
                  <p className="text-sm font-extrabold break-words text-slate-800 dark:text-slate-100">
                    لوط رقم:{' '}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400" style={{ unicodeBidi: 'plaintext', direction: 'ltr' }}>
                      {lot.lotNumber}
                    </span>{' '}
                    - {lot.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>
                      القيمة الإجمالية:{' '}
                      <span dir="ltr" className="font-mono text-slate-700 dark:text-slate-200">
                        {formatCurrency(lot.totalValue)} جنيه
                      </span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span>
                      تاريخ الجلسة: <span className="text-slate-700 dark:text-slate-200">{formatDate(entity.auctionDate)}</span>
                    </span>
                  </div>
                  {lot.loadingDetails && (
                    <p className="mt-2 w-fit rounded-xl border border-emerald-200/40 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:border-emerald-800/40 dark:bg-emerald-950 dark:text-emerald-300">
                      🚛 تم شحنه وتحميله بواسطة: {lot.loadingDetails.loaderName} في {formatDate(lot.loadingDetails.date)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreLot(lot, entity.id)}
                  className="cursor-pointer select-none rounded-xl border border-indigo-200/50 bg-indigo-50 px-4 py-2 text-xs font-extrabold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                >
                  🔄 استرجاع من الأرشيف
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArchiveMenuView(props: ArchiveMenuViewProps): ReactNode {
  const { counts, onNavigate, onExportReport } = props;

  const cards: Array<{ id: ArchiveMenuTarget; title: string; icon: string; stat: string }> = [
    { id: 'lots', title: 'أرشيف اللوطات والمزادات', icon: '🏢', stat: `${counts.archivedLots} لوط مؤرشف` },
    { id: 'work', title: 'أرشيف عملاء الشغل', icon: '💼', stat: `${counts.archivedWork} عميل مؤرشف` },
    { id: 'advances', title: 'أرشيف عملاء السلف', icon: '💰', stat: `${counts.archivedAdvances} عميل مؤرشف` },
  ];

  return (
    <div dir="rtl" className="py-6 text-right">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 md:text-3xl dark:text-white">الأرشيف العام</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            استعرض البيانات واللوطات والعملاء المؤرشفين، أو قم باسترجاعهم مجدداً للنظام النشط.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportReport}
          className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md transition-colors hover:bg-indigo-700"
        >
          🖨️ تصدير تقرير الأرشيف
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-700 to-slate-800 p-6 text-right text-white shadow-md outline-none transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-600"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"></div>
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-4xl" role="img" aria-label={item.title}>
                  {item.icon}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                  <svg className="h-3.5 w-3.5 rotate-180 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7-7" />
                  </svg>
                </span>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-extrabold">{item.title}</h3>
                <p className="font-mono text-base font-bold text-indigo-300">{item.stat}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
