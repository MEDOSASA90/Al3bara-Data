import type { ReactNode } from 'react';

interface SkeletonLoaderProps {
  type: 'card' | 'table' | 'metrics' | 'list';
  count?: number;
}

function Block({ className }: { className: string }): ReactNode {
  return <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

export function SkeletonLoader({ type, count = 3 }: SkeletonLoaderProps): ReactNode {
  const rows = Array.from({ length: count }, (_, index) => index);

  if (type === 'metrics') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.slice(0, 4).map((key) => (
          <Block key={key} className="h-28" />
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="space-y-2">
        {rows.map((key) => (
          <Block key={key} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((key) => (
        <Block key={key} className={type === 'list' ? 'h-16' : 'h-40'} />
      ))}
    </div>
  );
}
