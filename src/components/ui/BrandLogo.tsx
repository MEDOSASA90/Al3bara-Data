interface BrandLogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

/**
 * العبارة للتجارة والتوريدات — الهوية البصرية.
 * عبّارة شحن (هيكل + حاويات) فوق موجتين، داخل شارة كحلي بحلقة ذهبية.
 */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="شعار العبارة"
      className={className}
    >
      <rect x="2" y="2" width="92" height="92" rx="24" fill="#0B1F4D" />
      <rect x="2" y="2" width="92" height="92" rx="24" stroke="#C9A227" strokeWidth="4" />
      {/* horizon arc */}
      <path d="M18 52a30 30 0 0 1 60 0" stroke="#C9A227" strokeWidth="3.5" strokeLinecap="round" />
      {/* containers */}
      <rect x="32" y="30" width="13" height="11" rx="1.5" fill="#E7C55A" />
      <rect x="47" y="30" width="13" height="11" rx="1.5" fill="#F4E3AC" />
      <rect x="39" y="19" width="13" height="9" rx="1.5" fill="#C9A227" />
      {/* hull */}
      <path d="M24 46h48l-7 12H31l-7-12Z" fill="#FFFFFF" />
      <rect x="24" y="43.5" width="48" height="3.5" rx="1.75" fill="#FFFFFF" />
      {/* waves */}
      <path d="M20 68c6-5 12-5 18 0s12 5 18 0 12-5 18 0" stroke="#7FA6E8" strokeWidth="4" strokeLinecap="round" />
      <path d="M28 78c5-4 10-4 15 0s10 4 15 0 8-3.5 12-1" stroke="#3D5A99" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ size = 40, className, withWordmark = true }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BrandMark size={size} />
      {withWordmark ? (
        <span className="leading-tight">
          <span className="block text-lg font-black text-slate-900 dark:text-white">العبارة</span>
          <span className="block text-[11px] font-bold tracking-wide text-[#9A7B1E] dark:text-[#E7C55A]">
            للتجارة والتوريدات
          </span>
        </span>
      ) : null}
    </span>
  );
}
