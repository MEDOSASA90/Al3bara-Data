import { useMemo, useState, type ReactNode } from 'react';
import type { Client, PartnershipSale } from '../../domain/types';
import { SALE_STATUS_LABELS, salePaid, saleRemaining, saleStatus, salesTotals } from '../../domain/finance';
import { clientBalance } from '../../domain/finance';
import { formatCurrency, formatDate } from '../../utils/format';
import { Modal } from '../../components/ui/Modal';
import { AuditBadge } from './AuditBadge';

export interface BuyerSaleRef {
  partnershipId: string;
  partnershipName: string;
  sale: PartnershipSale;
}

interface BuyerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerName: string;
  currentPartnershipName: string;
  currentSales: PartnershipSale[];
  allSales: BuyerSaleRef[];
  privateMatches: { advances: Client[]; work: Client[] };
}

type BuyerTab = 'current' | 'all' | 'private';

const TABS: { id: BuyerTab; label: string }[] = [
  { id: 'current', label: 'هذه الشراكة' },
  { id: 'all', label: 'كل الشراكات' },
  { id: 'private', label: 'بضاعتي الخاصة' },
];

function SaleRows(props: { sales: PartnershipSale[]; showPartnership?: (sale: PartnershipSale) => string | null }): ReactNode {
  const { sales, showPartnership } = props;
  if (sales.length === 0) {
    return <p className="py-3 text-center text-xs font-medium text-slate-400">لا مبيعات مسجلة لهذا المشتري هنا.</p>;
  }
  return (
    <div className="space-y-2">
      {sales.map((sale) => {
        const paid = salePaid(sale);
        const remaining = saleRemaining(sale);
        const status = saleStatus(sale);
        const partnershipLabel = showPartnership ? showPartnership(sale) : null;
        return (
          <div key={sale.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black" dir="ltr">{formatCurrency(sale.totalAmount)}</span>
              <span className="chip-brand">{SALE_STATUS_LABELS[status]}</span>
              {sale.isAdvance === true && <span className="chip">📝 عربون</span>}
              {partnershipLabel ? <span className="chip">🤝 {partnershipLabel}</span> : null}
              <span className="text-[11px] font-semibold text-slate-400">{formatDate(sale.date)}</span>
              <AuditBadge createdBy={sale.createdBy} createdAt={sale.createdAt} updatedBy={sale.updatedBy} updatedAt={sale.updatedAt} />
            </div>
            <div className="mt-1.5 space-y-0.5">
              {(sale.lines ?? []).map((line, i) => (
                <p key={i} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  • {line.name} — <span className="font-mono" dir="ltr">{line.quantity}{line.unit ? ` ${line.unit}` : ''} × {formatCurrency(line.unitPrice)}</span>
                </p>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              المحصّل <span className="font-mono" dir="ltr">{formatCurrency(paid)}</span> • المتبقي <span className="font-mono" dir="ltr">{formatCurrency(remaining)}</span>
            </p>
            {(sale.payments ?? []).length > 0 ? (
              <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                {(sale.payments ?? []).map((pay) => (
                  <p key={pay.id} className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                    <span className="font-mono font-bold" dir="ltr">{formatCurrency(pay.amount)}</span>
                    <span>{formatDate(pay.date)}</span>
                    {pay.notes !== '' ? <span>{pay.notes}</span> : null}
                    <AuditBadge createdBy={pay.createdBy} createdAt={pay.createdAt} updatedBy={pay.updatedBy} updatedAt={pay.updatedAt} />
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BuyerProfileModal(props: BuyerProfileModalProps): ReactNode {
  const { isOpen, onClose, buyerName, currentPartnershipName, currentSales, allSales, privateMatches } = props;
  const [tab, setTab] = useState<BuyerTab>('current');

  const currentTotals = useMemo(() => salesTotals(currentSales), [currentSales]);
  const allTotals = useMemo(() => salesTotals(allSales.map((ref) => ref.sale)), [allSales]);
  const partnershipOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const ref of allSales) map.set(ref.sale.id, ref.partnershipName);
    return map;
  }, [allSales]);

  const privateClients = useMemo(
    () => [...privateMatches.advances.map((c) => ({ kind: 'سلف', client: c })), ...privateMatches.work.map((c) => ({ kind: 'شغل', client: c }))],
    [privateMatches],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`👤 ${buyerName}`}>
      <div className="space-y-4 text-right" dir="rtl">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'btn-primary' : 'btn-ghost'}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'current' ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="mb-1 text-slate-500">اشترى ({currentPartnershipName})</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(currentTotals.bought)}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
                <div className="mb-1 text-emerald-600">سدد</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(currentTotals.paid)}</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
                <div className="mb-1 text-amber-600">المتبقي</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(currentTotals.remaining)}</div>
              </div>
            </div>
            <SaleRows sales={currentSales} />
          </>
        ) : null}

        {tab === 'all' ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="mb-1 text-slate-500">إجمالي المشتريات</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(allTotals.bought)}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
                <div className="mb-1 text-emerald-600">إجمالي المسدد</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(allTotals.paid)}</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
                <div className="mb-1 text-amber-600">إجمالي المتبقي</div>
                <div className="font-mono text-sm" dir="ltr">{formatCurrency(allTotals.remaining)}</div>
              </div>
            </div>
            <SaleRows sales={allSales.map((ref) => ref.sale)} showPartnership={(sale) => partnershipOf.get(sale.id) ?? null} />
          </>
        ) : null}

        {tab === 'private' ? (
          <>
            {privateClients.length > 0 ? (
              <div className="space-y-2">
                {privateClients.map(({ kind, client }) => {
                  const balance = clientBalance(client);
                  return (
                    <div key={`${kind}-${client.id}`} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-800 dark:text-slate-100">{client.name}</span>
                        <span className="chip">{kind}</span>
                        <span className="text-xs font-bold text-slate-500">
                          الرصيد <span className="font-mono" dir="ltr">{formatCurrency(balance)}</span>
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">{client.transactions.length} حركة في حساب {kind}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3 text-center text-xs font-medium text-slate-400">لا يوجد حساب خاص (سلف/شغل) مطابق لهذا الاسم.</p>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
