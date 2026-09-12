import { useMemo, useState, type ReactNode } from 'react';
import type { Payer, Partnership, PartyRef, ShareLink } from '../../domain/types';
import { itemBuyCost, itemQuantity, partnershipSettlement, salesTotals } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';
import { ItemModal, type PartnershipItemFormData } from './ItemModal';
import type { PartnershipTxFormData } from './TxModal';
import { LedgerModal } from './LedgerModal';
import { SupplierModal } from './SupplierModal';
import { SalesModal, type PartnershipSaleFormData, type SalePaymentFormData } from './SalesModal';
import { BuyersModal, type NewBuyerFormData } from './BuyersModal';
import type { BuyerTopUpFormData } from './BuyerAccountModal';

export interface SupplierPaymentFormData {
  amount: number;
  paidBy: Payer;
  deliveredBy?: Payer;
  dateInput: string;
  notes: string;
}

interface PartnershipDetailsProps {
  partnership: Partnership;
  onBack: () => void;
  onEditMeta: () => void;
  onDeletePartnership: () => void;
  onPrint: () => void;
  onSaveItem: (data: PartnershipItemFormData, existingId: string | null) => void;
  onDeleteItem: (itemId: string) => void;
  onSaveTx: (data: PartnershipTxFormData, existingId: string | null) => void;
  onDeleteTx: (txId: string) => void;
  onSettle: () => void;
  onSaveSupplierPayment: (data: SupplierPaymentFormData, existingId: string | null) => void;
  onDeleteSupplierPayment: (paymentId: string) => void;
  onSaveSupplierName: (name: string) => void;
  onSaveSale: (data: PartnershipSaleFormData, existingId: string | null) => void;
  onDeleteSale: (saleId: string) => void;
  onSaveSalePayment: (saleId: string, data: SalePaymentFormData, existingId: string | null) => void;
  onDeleteSalePayment: (saleId: string, paymentId: string) => void;
  onOpenBuyerProfile: (buyerName: string) => void;
  onAddBuyer: (data: NewBuyerFormData) => void;
  onTopUpBuyer: (buyerId: string, data: BuyerTopUpFormData) => void;
  shareLinks: ShareLink[];
  onCreateShareLink: () => void;
  onRevokeShareLink: (token: string) => void;
}

function SettlementRow(props: { label: string; value: number; strong?: boolean }): ReactNode {
  const { label, value, strong } = props;
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-mono ${strong ? 'text-base font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`} dir="ltr">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function PartnershipDetails(props: PartnershipDetailsProps): ReactNode {
  const {
    partnership: p,
    onBack,
    onEditMeta,
    onDeletePartnership,
    onPrint,
    onSaveItem,
    onDeleteItem,
    onSaveTx,
    onDeleteTx,
    onSettle,
    onSaveSupplierPayment,
    onDeleteSupplierPayment,
    onSaveSupplierName,
    onSaveSale,
    onDeleteSale,
    onSaveSalePayment,
    onDeleteSalePayment,
    onOpenBuyerProfile,
    onAddBuyer,
    onTopUpBuyer,
    shareLinks,
    onCreateShareLink,
    onRevokeShareLink,
  } = props;

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [buyersOpen, setBuyersOpen] = useState(false);

  function shareUrl(token: string): string {
    return `${window.location.origin}${window.location.pathname}#/share/${token}`;
  }

  async function copyShareUrl(token: string): Promise<void> {
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement('textarea');
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2000);
  }

  const [itemModal, setItemModal] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null });
  const parties: PartyRef[] = useMemo(
    () => [{ id: 'me', name: 'وليد' }, ...p.partners.map((partner) => ({ id: partner.id, name: partner.name }))],
    [p.partners],
  );
  const partnerIds = useMemo(() => parties.map((party) => party.id), [parties]);

  const settlement = useMemo(
    () => partnershipSettlement(p.items ?? [], p.txs ?? [], p.shares, partnerIds, p.supplierPayments ?? [], p.sales ?? [], p.buyers ?? []),
    [p.items, p.txs, p.shares, partnerIds, p.supplierPayments, p.sales, p.buyers],
  );

  const salesAgg = useMemo(() => salesTotals(p.sales ?? []), [p.sales]);

  const editingItem = itemModal.itemId ? (p.items ?? []).find((i) => i.id === itemModal.itemId) ?? null : null;

  const myDue = settlement.dues['me'] ?? 0;
  const myShare = p.shares['me'] ?? 0;
  const dueText =
    Math.abs(myDue) < 0.01
      ? '✅ الحساب متعادل — لا مستحقات'
      : myDue > 0
        ? `💰 الشركاء مدينون لك بمبلغ ${formatCurrency(myDue)}`
        : `💸 أنت مدين للشركاء بمبلغ ${formatCurrency(Math.abs(myDue))}`;

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="btn-ghost">
          → رجوع
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-slate-900 md:text-2xl dark:text-white">{p.name}</h1>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            🤝 {p.partners.map((partner) => partner.name).join('، ') || 'بدون شركاء'}
            {p.partners[0]?.phone ? ` • 📞 ${p.partners[0].phone}` : ''} • نسبتي {myShare}% •{' '}
            <span className={p.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}>
              {p.status === 'active' ? 'نشطة' : 'مسواة'}
            </span>
          </p>
        </div>
        <button type="button" onClick={onPrint} className="btn-ghost">
          🖨️ كشف حساب
        </button>
        {p.status === 'active' && Math.abs(myDue) >= 0.01 && (
          <button type="button" onClick={onSettle} className="btn-primary">
            ✅ تسجيل التسوية وإغلاق الشراكة
          </button>
        )}
        <button
          type="button"
          onClick={() => setShareOpen((current) => !current)}
          aria-expanded={shareOpen}
          className="btn-ghost"
        >
          🔗 مشاركة
        </button>
        <button type="button" onClick={onEditMeta} className="btn-ghost">
          تعديل
        </button>
        <button type="button" onClick={onDeletePartnership} className="btn-danger">
          حذف
        </button>
      </div>

      {shareOpen ? (
        <div className="card card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-slate-900 dark:text-white">🔗 لينكات المشاركة (اطلاع فقط)</h2>
            <button type="button" onClick={onCreateShareLink} className="btn-primary">
              + لينك جديد
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            الشريك يفتح اللينك بدون حساب ويشوف البضاعة والمصاريف والتكاليف كاملة — بدون أي تعديل.
          </p>
          {shareLinks.length > 0 ? (
            <div className="space-y-2">
              {shareLinks.map((link) => (
                <div key={link.token} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 p-2.5 text-xs dark:border-slate-700">
                  <span className="font-mono" dir="ltr">{shareUrl(link.token).slice(-12)}…</span>
                  {link.revoked === true ? (
                    <span className="chip">⛔ موقوف</span>
                  ) : (
                    <span className="chip-credit">🟢 شغال</span>
                  )}
                  {link.revoked !== true ? (
                    <>
                      <button type="button" onClick={() => void copyShareUrl(link.token)} className="btn-ghost">
                        {copiedToken === link.token ? '✅ اتنسخ' : '📋 نسخ'}
                      </button>
                      <button type="button" onClick={() => onRevokeShareLink(link.token)} className="btn-danger">
                        إيقاف
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-slate-400">لا توجد لينكات بعد — أنشئ أول لينك مشاركة.</p>
          )}
        </div>
      ) : null}

      {/* Settlement card (collapsible) */}
      <div className="card card-pad">
        <button
          type="button"
          onClick={() => setSettlementOpen((current) => !current)}
          aria-expanded={settlementOpen}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <span className="text-base font-black text-slate-900 dark:text-white">⚖️ كارت التسوية</span>
          <span className="flex items-center gap-2">
            <span className="max-w-[60%] truncate text-xs font-bold text-slate-500 dark:text-slate-400">{dueText}</span>
            <span className={`transition-transform ${settlementOpen ? 'rotate-180' : ''}`}>▾</span>
          </span>
        </button>
        {settlementOpen ? (
        <>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettlementRow label="تكلفة شراء البضاعة" value={settlement.buyCost} />
          <SettlementRow label="المصاريف" value={settlement.expenses} />
          <SettlementRow label="إجمالي المبيعات" value={settlement.sales} />
          {settlement.refunds > 0 && <SettlementRow label="المرتجعات" value={settlement.refunds} />}
          <SettlementRow label="المدفوع للمورد" value={settlement.supplierPaid} />
          <SettlementRow label="المتبقي للمورد" value={settlement.supplierBalance} />
          <SettlementRow label="صافي الربح" value={settlement.profit} strong />
          <SettlementRow label={`نصيبي من الربح (${myShare}%)`} value={settlement.myProfit} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={partner.id}
              label={`نصيب ${partner.name} من الربح (${p.shares[partner.id] ?? 0}%)`}
              value={settlement.profits[partner.id] ?? 0}
            />
          ))}
          <SettlementRow label="مساهمتي (مدفوعاتي)" value={settlement.contributedMe} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={`c-${partner.id}`}
              label={`مساهمة ${partner.name} (مدفوعاته)`}
              value={settlement.contributed[partner.id] ?? 0}
            />
          ))}
          <SettlementRow label="ما حصّله وليد" value={settlement.collectedMe} />
          {p.partners.map((partner) => (
            <SettlementRow
              key={`r-${partner.id}`}
              label={`ما حصّله ${partner.name}`}
              value={settlement.collected[partner.id] ?? 0}
            />
          ))}
          {p.partners.map((partner) => {
            const due = settlement.dues[partner.id] ?? 0;
            if (Math.abs(due) < 0.01) return null;
            return (
              <SettlementRow
                key={`d-${partner.id}`}
                label={due > 0 ? `مستحق لـ ${partner.name}` : `مستحق على ${partner.name}`}
                value={due}
                strong
              />
            );
          })}
        </div>
        <div
          className={`mt-3 rounded-xl px-4 py-3 text-sm font-black ${
            Math.abs(myDue) < 0.01
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : myDue > 0
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-200'
                : 'bg-debit-50 text-debit-700 dark:bg-debit-600/15 dark:text-rose-300'
          }`}
        >
          {dueText}
        </div>
        </>
        ) : null}
      </div>

      {/* Section shortcuts: ledger / supplier / sales / buyers open as popups */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => setLedgerOpen(true)} className="card card-pad flex items-center justify-between gap-2 text-right transition hover:shadow-pop">
          <span className="text-sm font-black text-slate-900 dark:text-white">📒 الدفتر</span>
          <span className="chip-brand">{(p.txs ?? []).length} حركة</span>
        </button>
        <button type="button" onClick={() => setSupplierOpen(true)} className="card card-pad flex items-center justify-between gap-2 text-right transition hover:shadow-pop">
          <span className="text-sm font-black text-slate-900 dark:text-white">🏭 المورّد{p.supplierName ? ` • ${p.supplierName}` : ''}</span>
          <span className="chip-brand">{(p.supplierPayments ?? []).length} دفعة</span>
        </button>
        <button type="button" onClick={() => setSalesOpen(true)} className="card card-pad flex items-center justify-between gap-2 text-right transition hover:shadow-pop">
          <span className="text-sm font-black text-slate-900 dark:text-white">🛒 المباع</span>
          <span className="chip-brand">{(p.sales ?? []).length} بيعة • متبقي <span className="font-mono" dir="ltr">{formatCurrency(salesAgg.remaining)}</span></span>
        </button>
        <button type="button" onClick={() => setBuyersOpen(true)} className="card card-pad flex items-center justify-between gap-2 text-right transition hover:shadow-pop">
          <span className="text-sm font-black text-slate-900 dark:text-white">🧑‍🤝‍🧑 المشتريين</span>
          <span className="chip-brand">{(p.buyers ?? []).length} مشتري</span>
        </button>
      </div>

      {/* Items table */}
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900 dark:text-white">📦 البضاعة المشتركة</h2>
          <button type="button" onClick={() => setItemModal({ open: true, itemId: null })} className="btn-primary">
            + صنف
          </button>
        </div>
        {(p.items ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <th className="p-3 text-xs font-bold">الصنف</th>
                  <th className="p-3 text-xs font-bold">النوع</th>
                  <th className="p-3 text-xs font-bold">الكمية</th>
                  <th className="p-3 text-xs font-bold">تكلفة الشراء</th>
                  <th className="p-3 text-xs font-bold">التوريدات</th>
                  <th className="p-3 text-xs font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(p.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                      {item.name}
                      {item.notes ? <span className="block text-[11px] font-medium text-slate-400">{item.notes}</span> : null}
                    </td>
                    <td className="p-3">
                      <span className="chip">{(item.mode ?? 'lot') === 'weight' ? '⚖️ وزن' : '📦 لوط'}</span>
                    </td>
                    <td className="p-3 font-mono" dir="ltr">{itemQuantity(item)}</td>
                    <td className="p-3 font-mono font-bold" dir="ltr">{formatCurrency(itemBuyCost(item))}</td>
                    <td className="p-3">
                      <span className="chip-brand">{(item.deliveries ?? []).length} توريدات</span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setItemModal({ open: true, itemId: item.id })}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-400">لا أصناف بعد — أضف البضاعة المشتركة.</p>
        )}
      </div>

      <LedgerModal
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        txs={p.txs ?? []}
        parties={parties}
        onSaveTx={onSaveTx}
        onDeleteTx={onDeleteTx}
      />
      <SupplierModal
        isOpen={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        partnership={p}
        parties={parties}
        onSaveSupplierPayment={onSaveSupplierPayment}
        onDeleteSupplierPayment={onDeleteSupplierPayment}
        onSaveSupplierName={onSaveSupplierName}
      />
      <SalesModal
        isOpen={salesOpen}
        onClose={() => setSalesOpen(false)}
        sales={p.sales ?? []}
        parties={parties}
        buyers={p.buyers ?? []}
        onSaveSale={onSaveSale}
        onDeleteSale={onDeleteSale}
        onSavePayment={onSaveSalePayment}
        onDeletePayment={onDeleteSalePayment}
        onOpenBuyerProfile={onOpenBuyerProfile}
      />
      <BuyersModal
        isOpen={buyersOpen}
        onClose={() => setBuyersOpen(false)}
        buyers={p.buyers ?? []}
        sales={p.sales ?? []}
        parties={parties}
        onAddBuyer={onAddBuyer}
        onTopUp={onTopUpBuyer}
      />

      <ItemModal
        isOpen={itemModal.open}
        item={editingItem}
        onClose={() => setItemModal({ open: false, itemId: null })}
        onSave={(data) => {
          onSaveItem(data, itemModal.itemId);
          setItemModal({ open: false, itemId: null });
        }}
      />
    </div>
  );
}
