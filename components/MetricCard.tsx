import React from 'react';

interface MetricCardProps {
    title: string;
    value: React.ReactNode;
    tag?: React.ReactNode;
    gradient: string;
    icon: string;
    subText?: string;
    valueColor?: string;
    onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    tag,
    gradient,
    icon,
    subText,
    valueColor = 'text-white',
    onClick
}) => {
    const isClickable = !!onClick;

    return (
        <div 
            onClick={onClick}
            className={`group relative bg-gradient-to-br ${gradient} rounded-2xl p-5 shadow-lg border border-white/5 overflow-hidden transition-all duration-300 transform select-none ${
                isClickable 
                    ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]' 
                    : ''
            }`}
        >
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110"></div>
            
            <div className="relative z-10 flex flex-col text-right w-full" dir="rtl">
                {/* Card Header */}
                <div className="flex items-center gap-2 mb-3 justify-end">
                    {tag}
                    <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10 group-hover:bg-white/25 transition-colors duration-200">
                        <span className="text-2xl" role="img" aria-label={title}>{icon}</span>
                    </div>
                </div>
                
                {/* Title */}
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">
                    {title}
                </span>
                
                {/* Main Value */}
                <p className={`text-2xl md:text-3xl font-black tracking-tight mb-1 font-mono ${valueColor}`} dir="ltr">
                    {value}
                </p>
                
                {/* Secondary Info */}
                {subText && (
                    <p className="text-[10px] text-white/70 font-semibold mt-1">
                        {subText}
                    </p>
                )}

                {/* Shimmer/Interactive Highlight indicator */}
                {isClickable && (
                    <div className="absolute bottom-2 left-3 text-[10px] text-white/40 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                        <span>انقر للتصفية</span>
                        <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
};
