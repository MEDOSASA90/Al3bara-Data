import { useMemo, useState, type ReactNode } from 'react';
import type { Partnership, PartnershipStatus } from '../../domain/types';
import { partnershipSettlement } from '../../domain/finance';
import { formatCurrency } from '../../utils/format';

export type PartnershipStatusFilter = 'all' | PartnershipStatus;

interface PartnershipsViewProps {
  partnerships: Partnership[];
  onAdd: () => void;
  onOpen: (partnership: Partnership) => void;
  onEdit: (partnership: Partnership) => void;
  onDelete: (partnershipId: string) => void;
}

export function PartnershipsView(props: PartnershipsViewProps): ReactNode {
  const { partnerships, onAdd, onOpen, onEdit, onDelete } = props;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnershipStatusFilter>('all');

  const filtered = useMemo(() => {
    let result = partnerships ?? [];
    const q = searchTerm.trim().toLowerCase();
    if (q !== '') {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.partners.some((partner) => partner.name.toLowerCase().includes(q)) ||
          (p.partnerName ?? '').toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter);
    return result;
  }, [partnerships, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const list = partnerships ?? [];
    const active = list.filter((p) => p.status === 'active').length;
    const settled = list.filter((p) => p.status === 'settled').length;
    const dueToMe = list
      .filter((p) => p.status === 'active')
      .reduce(
        (sum, p) =>
          sum +
          (partnershipSettlement(p.items ?? [], p.txs ?? [], p.shares, ['me', ...p.partners.map((partner) => partner.id)], p.supplierPayments ?? [], p.sales ?? [], p.buyers ?? []).dues['me'] ?? 0),
        0,
      );
    return { active, settled, dueToMe };
  }, [partnerships]);

  function filterButton(value: PartnershipStatusFilter, label: string, activeClass: string): ReactNode {
    return (
      <button
        key={value}
        type="button"
        onClick={() => setStatusFilter(value)}
        className={`min-h-[40px] cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition-all duration-150 ${
          statusFilter === value
            ? `border border-slate-200/20 bg-white shadow-sm ${activeClass} dark:border-slate-600 dark:bg-slate-800`
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="text-right" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 md:text-3xl dark:text-slate-100">حسابات الشركاء</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            بضاعة مشتركة مع تاجر آخر: التكلفة والمصاريف والبيع والتسوية حسب النسبة المتفق عليها.
          </p>
        </div>
        <button type="button" onClick={onAdd} className="btn-primary">
          ➕ شراكة جديدة
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card card-pad">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">شراكات نشطة</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{summary.active}</p>
        </div>
        <div className="card card-pad">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">شراكات مسواة</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{summary.settled}</p>
        </div>
        <div className="card card-pad">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">صافي المستحق لي (النشطة)</p>
          <p className="mt-1 font-mono text-2xl font-black text-brand-700 dark:text-brand-200" dir="ltr">
            {formatCurrency(summary.dueToMe)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary.dueToMe > 0 ? 'لي مبلغ عند الشركاء' : summary.dueToMe < 0 ? 'علي مبلغ للشركاء' : 'لا فروقات'}
          </p>
        </div>
      </div>

      <div className="card card-pad mb-6 space-y-4">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <div className="relative w-full md:flex-1">
            <input
              type="text"
              placeholder="🔍 ابحث باسم الشراكة أو الشريك أو الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
            />
            {searchTerm !== '' && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                مسح
              </button>
            )}
          </div>
          <div className="flex w-full shrink-0 overflow-x-auto rounded-xl border border-slate-200/50 bg-slate-100 p-1 md:w-auto dark:border-slate-700 dark:bg-slate-800">
            {filterButton('all', `الكل (${partnerships.length})`, 'text-slate-800 dark:text-slate-100')}
            {filterButton('active', 'نشطة', 'text-emerald-600')}
            {filterButton('settled', 'مسواة', 'text-slate-600')}
          </div>
        </div>
        {(searchTerm !== '' || statusFilter !== 'all') && (
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            عرض {filtered.length} من أصل {partnerships.length} شراكات.
          </p>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((p) => {
            const partyIds = ['me', ...p.partners.map((partner) => partner.id)];
            const s = partnershipSettlement(p.items ?? [], p.txs ?? [], p.shares, partyIds, p.supplierPayments ?? [], p.sales ?? [], p.buyers ?? []);
            const myDue = s.dues['me'] ?? 0;
            const myShare = p.shares['me'] ?? 0;
            return (
              <div key={p.id} className="card card-pad space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      🤝 {p.partners.map((partner) => partner.name).join('، ') || 'بدون شركاء'} • نسبتي {myShare}%
                    </p>
                  </div>
                  <span className={p.status === 'active' ? 'chip-credit' : 'chip-warn'}>
                    {p.status === 'active' ? 'نشطة' : 'مسواة'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span>
                    المبيعات: <span className="font-mono" dir="ltr">{formatCurrency(s.sales)}</span>
                  </span>
                  <span>
                    الربح: <span className="font-mono" dir="ltr">{formatCurrency(s.profit)}</span>
                  </span>
                  <span>
                    المستحق لي:{' '}
                    <span className={`font-mono ${myDue >= 0 ? 'text-emerald-700' : 'text-rose-600'}`} dir="ltr">
                      {formatCurrency(myDue)}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button type="button" onClick={() => onOpen(p)} className="btn-primary flex-1">
                    فتح التفاصيل
                  </button>
                  <button type="button" onClick={() => onEdit(p)} className="btn-ghost">
                    تعديل
                  </button>
                  <button type="button" onClick={() => onDelete(p.id)} className="btn-danger">
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card card-pad p-10 text-center">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {partnerships.length === 0
              ? 'لا توجد شراكات بعد. اضغط "شراكة جديدة" للبدء.'
              : 'لا توجد نتائج تطابق البحث أو الفلتر.'}
          </p>
        </div>
      )}
    </div>
  );
}
