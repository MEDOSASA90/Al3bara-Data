import type { ReactNode } from 'react';
import { BrandMark } from './BrandLogo';

export function SplashScreen(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#060f28] via-[#0b1f4d] to-[#14306b] text-white">
      <div className="animate-float">
        <BrandMark size={96} />
      </div>
      <h1 className="animate-fadeIn mt-6 text-3xl font-black">العبارة</h1>
      <p className="animate-fadeIn mt-1 text-sm font-bold tracking-wide text-[#E7C55A]">
        للتجارة والتوريدات
      </p>
      <p className="animate-fadeIn mt-3 text-blue-100/70">جاري التحميل...</p>
    </div>
  );
}
