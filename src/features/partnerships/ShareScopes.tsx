import type { ReactNode } from 'react';
import type { Partnership } from '../../domain/types';
import { buyerBalance, buyerSales, itemBuyCost, itemQuantity, salePaid, saleRemaining } from '../../domain/finance';
import { formatCurrency, formatDate } from '../../utils/format';
import { BrandMark } from '../../components/ui/BrandLogo';

function ShareHeader({ subtitle }: { subtitle: string }): ReactNode {
  return (
    <header className="border-b border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
          <BrandMark size={40} />
        </span>
        <div>
          <p className="font-bold">العبارة للتجارة والتوريدات</p>
          <p className="text-xs text-slate-500">👁️ {subtitle} — اطلاع فقط</p>
        </div>
      </div>
    </header>
  );
}

function Shell({ subtitle, children }: { subtitle: string; children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100" dir="rtl">
      <ShareHeader subtitle={subtitle} />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">{children}</main>
    </div>
  );
}

/** Buyer-scoped view: own balance + own sales/deliveries only. No partners, no profit, no dues. */
export function BuyerShareView({ partnership: p, buyerId }: { partnership: Partnership; buyerId?: string }): ReactNode {
  const buyer = (p.buyers ?? []).find((b) => b.id === buyerId)
    ?? (p.buyers ?? []).find((b) => b.id === buyerId);
  const sales = buyer ? buyerSales(buyer, p.sales ?? []) : [];
  const balance = buyer ? buyerBalance(buyer, p.sales ?? []) : 0;
  const bought = sales.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
  const paid = sales.reduce((s, sale) => s + salePaid(sale), 0);

  if (!buyer) {
    return (
      <Shell subtitle="حساب مشتري">
        <div className="card card-pad text-center">
          <p className="font-bold text-slate-600 dark:text-slate-300">تعذر العثور على حساب المشتري المرتبط بهذا الرابط.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell subtitle={`حساب المشتري: ${buyer.name}`}>
      <div className="card card-pad">
        <h1 className="text-xl font-black">أهلاً {buyer.name} 👋</h1>
        <p className="mt-1 text-xs font-bold text-slate-500">كشف حسابك في شراكة «{p.name}»</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">إجمالي مشترياتك</p>
          <p className="font-mono font-black" dir="ltr">{formatCurrency(bought)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">المدفوع</p>
          <p className="font-mono font-black text-emerald-600" dir="ltr">{formatCurrency(paid)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">رصيدك الحالي</p>
          <p className={`font-mono font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black">🧾 البضاعة التي استلمتها</h2>
        {sales.length > 0 ? (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold">{formatDate(sale.date)}</span>
                  <span className="font-mono font-black" dir="ltr">{formatCurrency(sale.totalAmount)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {(sale.lines ?? []).map((line, i) => (
                    <p key={i} className="text-xs text-slate-600 dark:text-slate-300">
                      • {line.name} — الكمية: <span className="font-mono" dir="ltr">{line.quantity}</span>
                      {line.unit ? ` ${line.unit}` : ''} — <span className="font-mono" dir="ltr">{formatCurrency(line.total)}</span>
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  مدفوع: <span className="font-mono" dir="ltr">{formatCurrency(salePaid(sale))}</span>
                  {' '}• متبقي: <span className="font-mono" dir="ltr">{formatCurrency(saleRemaining(sale))}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-slate-400">لا مبيعات مسجلة باسمك بعد.</p>
        )}
      </div>
    </Shell>
  );
}

/** Supplier-scoped view: purchased goods + amounts paid only. No sales, buyers, profit, or expenses. */
export function SupplierShareView({ partnership: p }: { partnership: Partnership }): ReactNode {
  const buyCostTotal = (p.items ?? []).reduce((sum, item) => sum + itemBuyCost(item), 0);
  const paid = (p.supplierPayments ?? []).reduce((sum, pay) => sum + (pay.amount || 0), 0);
  const remaining = buyCostTotal - paid;

  return (
    <Shell subtitle={`حساب المورّد${p.supplierName ? `: ${p.supplierName}` : ''}`}>
      <div className="card card-pad">
        <h1 className="text-xl font-black">🏭 كشف حساب المورّد</h1>
        <p className="mt-1 text-xs font-bold text-slate-500">شراكة «{p.name}» — البضاعة المورّدة والمبالغ المستلمة فقط</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">إجمالي البضاعة</p>
          <p className="font-mono font-black" dir="ltr">{formatCurrency(buyCostTotal)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">المبالغ التي وصلتك</p>
          <p className="font-mono font-black text-emerald-600" dir="ltr">{formatCurrency(paid)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-[11px] text-slate-500">المتبقي لك</p>
          <p className="font-mono font-black text-rose-600" dir="ltr">{formatCurrency(remaining)}</p>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black">📦 البضاعة المشتركة</h2>
        {(p.items ?? []).length > 0 ? (
          <div className="space-y-3">
            {(p.items ?? []).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {item.name} <span className="chip mr-2">{item.mode === 'weight' ? '⚖️ وزن' : '📦 لوط'}</span>
                  </p>
                  <p className="font-mono text-sm font-black" dir="ltr">{formatCurrency(itemBuyCost(item))}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">إجمالي الكمية: <span className="font-mono" dir="ltr">{itemQuantity(item)}</span></p>
                {(item.deliveries ?? []).length > 0 ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-right text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="p-1.5">التاريخ</th>
                          <th className="p-1.5">الكمية</th>
                          <th className="p-1.5">السعر</th>
                          <th className="p-1.5">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item.deliveries ?? []).map((delivery) => (
                          <tr key={delivery.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="p-1.5">{formatDate(delivery.date)}</td>
                            <td className="p-1.5 font-mono" dir="ltr">{delivery.quantity}</td>
                            <td className="p-1.5 font-mono" dir="ltr">{formatCurrency(delivery.unitPrice)}</td>
                            <td className="p-1.5 font-mono font-bold" dir="ltr">{formatCurrency(delivery.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-slate-400">لا أصناف مسجلة.</p>
        )}
      </div>

      <div className="card card-pad">
        <h2 className="mb-3 text-base font-black">💵 المبالغ التي وصلتك</h2>
        {(p.supplierPayments ?? []).length > 0 ? (
          <div className="space-y-2">
            {(p.supplierPayments ?? []).map((pay) => (
              <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 p-2.5 text-xs dark:border-slate-700">
                <span className="font-mono font-black" dir="ltr">{formatCurrency(pay.amount)}</span>
                <span className="text-slate-400">{formatDate(pay.date)}</span>
                {pay.notes !== '' ? <span className="w-full text-slate-500">{pay.notes}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-slate-400">لا مدفوعات مسجلة بعد.</p>
        )}
      </div>
    </Shell>
  );
}
