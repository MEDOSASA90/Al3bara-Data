import type { ReactNode } from 'react';
import { formatCurrency } from '../../utils/format';

interface BalanceDisplayProps {
  total: number;
}

/** Debit (>=0, rose) vs credit (<0, emerald) balance badge. */
export function BalanceDisplay({ total }: BalanceDisplayProps): ReactNode {
  const safe = Number.isNaN(total) ? 0 : total;
  const isDebit = safe >= 0;
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${
        isDebit ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      }`}
    >
      {isDebit ? 'مدين: ' : 'دائن: '}
      {formatCurrency(Math.abs(safe))}
      {isDebit ? ' (مطلوب منه)' : ' (مدفوع مقدماً)'}
    </span>
  );
}
