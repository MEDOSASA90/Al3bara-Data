import { useEffect, useState, type ReactNode } from 'react';
import type { Partner, Partnership } from '../../domain/types';
import { ME_PARTY_ID, myShareOf } from '../../domain/types';
import { Modal } from '../../components/ui/Modal';

export interface PartnershipFormData {
  name: string;
  partners: Partner[];
  shares: Record<string, number>;
  inOurName: boolean;
  supplierName: string;
}

interface PartnerRow {
  key: string;
  id: string;
  name: string;
  phone: string;
  share: number | '';
}

interface PartnershipModalProps {
  isOpen: boolean;
  partnership: Partnership | null;
  onClose: () => void;
  onSave: (data: PartnershipFormData) => void;
}

function clampPct(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function rowId(index: number): string {
  return `partner-${index + 1}`;
}

export function PartnershipModal(props: PartnershipModalProps): ReactNode {
  const { isOpen, partnership, onClose, onSave } = props;
  const [name, setName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [myShare, setMyShare] = useState<number | ''>(50);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [inOurName, setInOurName] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(partnership?.name ?? '');
    setSupplierName(partnership?.supplierName ?? '');
    setMyShare(partnership ? myShareOf(partnership) : 50);
    const existing = partnership?.partners ?? [];
    if (existing.length > 0) {
      setRows(
        existing.map((p, i) => ({
          key: `${p.id}-${i}`,
          id: p.id,
          name: p.name,
          phone: p.phone ?? '',
          share: partnership?.shares?.[p.id] ?? '',
        })),
      );
    } else {
      setRows([{ key: 'new-0', id: rowId(0), name: '', phone: '', share: '' }]);
    }
    setInOurName(partnership?.inOurName ?? false);
    setError('');
  }, [isOpen, partnership]);

  const partnersTotal = rows.reduce((sum, r) => sum + (typeof r.share === 'number' ? r.share : 0), 0);
  const grandTotal = (typeof myShare === 'number' ? myShare : 0) + partnersTotal;
  const totalValid = Math.abs(grandTotal - 100) < 0.001;

  function updateRow(key: string, patch: Partial<PartnerRow>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow(): void {
    setRows((prev) => {
      const next: PartnerRow = {
        key: `new-${Date.now()}-${prev.length}`,
        id: rowId(prev.length),
        name: '',
        phone: '',
        share: '',
      };
      return [...prev, next];
    });
  }

  function removeRow(key: string): void {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (name.trim() === '') {
      setError('يرجى إدخال اسم الشراكة.');
      return;
    }
    const named = rows.filter((r) => r.name.trim() !== '');
    if (named.length === 0) {
      setError('يرجى إدخال اسم شريك واحد على الأقل.');
      return;
    }
    if (myShare === '' || Number.isNaN(Number(myShare))) {
      setError('يرجى إدخال نسبتك من الربح (0 - 100).');
      return;
    }
    for (const r of named) {
      if (r.share === '' || Number.isNaN(Number(r.share))) {
        setError(`يرجى إدخال نسبة الربح للشريك "${r.name.trim()}".`);
        return;
      }
    }
    if (!totalValid) {
      setError(`مجموع النسب يجب أن يساوي 100% (الحالي ${grandTotal}%).`);
      return;
    }
    const seen = new Set<string>();
    const partners: Partner[] = [];
    const shares: Record<string, number> = { [ME_PARTY_ID]: clampPct(Number(myShare)) };
    named.forEach((r, i) => {
      let id = r.id !== '' ? r.id : rowId(i);
      if (id === ME_PARTY_ID || seen.has(id)) id = `${rowId(i)}-x${i}`;
      seen.add(id);
      const partner: Partner = { id, name: r.name.trim() };
      if (r.phone.trim() !== '') partner.phone = r.phone.trim();
      partners.push(partner);
      shares[id] = clampPct(Number(r.share));
    });
    onSave({ name: name.trim(), partners, shares, inOurName, supplierName: supplierName.trim() });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={partnership ? 'تعديل الشراكة' : 'شراكة جديدة'}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم الشراكة <span className="text-rose-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: صفقة أرز مشتركة"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اسم المورد (اختياري)
          </label>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="اسم المورد"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            نسبتي من الربح % (0 - 100) <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={myShare}
            onChange={(e) => {
              const raw = e.target.value;
              setMyShare(raw === '' ? '' : Number(raw));
            }}
            placeholder="50"
            className="input"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              الشركاء <span className="text-rose-500">*</span>
            </label>
            <button type="button" onClick={addRow} className="btn-ghost px-3 py-1 text-xs">
              + إضافة شريك
            </button>
          </div>
          {rows.map((row) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  value={row.name}
                  onChange={(e) => updateRow(row.key, { name: e.target.value })}
                  placeholder="اسم الشريك *"
                  className="input"
                />
                <input
                  value={row.phone}
                  onChange={(e) => updateRow(row.key, { phone: e.target.value })}
                  placeholder="هاتف الشريك (اختياري)"
                  inputMode="tel"
                  className="input"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={row.share}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateRow(row.key, { share: raw === '' ? '' : Number(raw) });
                  }}
                  placeholder="نسبة الربح %"
                  className="input"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className={`text-[11px] font-bold ${totalValid ? 'text-emerald-600' : 'text-rose-600'}`}>
            المجموع: نسبتك ({typeof myShare === 'number' ? myShare : 0}%) + الشركاء ({partnersTotal}%) = {grandTotal}%
            {totalValid ? ' ✓' : ' — يجب أن يساوي 100%'}
          </p>
          <p className="text-[11px] text-slate-400">نسب متفق عليها بحرية ولا ترتبط بحجم المساهمة.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <input
            type="checkbox"
            checked={inOurName}
            onChange={(e) => setInOurName(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
          <span>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">البضاعة باسمنا؟</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              عند التفعيل تُسجَّل عمولة المزاد في حسابات السلف باسم الشريك الأول.
            </span>
          </span>
        </label>
        {error !== '' && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">
            حفظ
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
