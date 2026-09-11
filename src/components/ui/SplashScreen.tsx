import type { ReactNode } from 'react';

export function SplashScreen(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700 text-white">
      <div className="animate-float flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 text-5xl">
        ع
      </div>
      <h1 className="animate-fadeIn mt-6 text-3xl font-bold">العبارة للتجارة والتوريدات</h1>
      <p className="animate-fadeIn mt-2 text-blue-100">جاري التحميل...</p>
    </div>
  );
}
