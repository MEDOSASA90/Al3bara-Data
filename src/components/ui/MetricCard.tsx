import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  tag?: string;
  gradient: string;
  icon: string;
  subText?: string;
  valueColor?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  tag,
  gradient,
  icon,
  subText,
  valueColor,
  onClick,
}: MetricCardProps): ReactNode {
  const clickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`card card-pad w-full text-right transition ${
        clickable ? 'cursor-pointer hover:shadow-pop hover:-translate-y-0.5' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-2xl text-white shadow-soft ${gradient}`}>
          {icon}
        </span>
        {tag ? <span className="chip-brand">{tag}</span> : null}
      </div>
      <div className="muted-text mt-3">{title}</div>
      <div className={`text-2xl font-black text-slate-900 dark:text-white ${valueColor ?? ''}`}>{value}</div>
      {subText ? <div className="muted-text mt-1 text-xs">{subText}</div> : null}
      {clickable ? <div className="mt-1 text-xs font-bold text-brand-600 dark:text-brand-300">انقر للتصفية ←</div> : null}
    </button>
  );
}
