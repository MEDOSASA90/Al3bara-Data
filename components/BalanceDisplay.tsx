import React from 'react';
import { formatCurrency } from '../utils/helpers';

interface BalanceDisplayProps {
    total: number;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ total }) => {
    const isDebit = total >= 0;
    const statusText = isDebit ? '(مدين)' : '(دائن)';
    const safeTotal = isNaN(total) ? 0 : Math.abs(total);
    const amount = formatCurrency(safeTotal);
    
    // Premium color gradients
    const cardStyle = isDebit 
        ? 'from-rose-500 via-rose-600 to-red-600 shadow-rose-500/20 border-rose-400/20' 
        : 'from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-500/20 border-emerald-400/20';

    return (
        <div className={`p-5 rounded-2xl shadow-xl bg-gradient-to-br border text-white w-full max-w-sm ${cardStyle}`}>
            <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                    <span className="text-xs text-white/80 font-bold uppercase tracking-wider">الرصيد النهائي</span>
                    <h4 className="text-base font-black flex items-center gap-1">
                        {statusText}
                        <span className="text-xs opacity-75 font-normal">
                            {isDebit ? '✍️ مطلوب منه' : '🤝 مدفوع مقدماً'}
                        </span>
                    </h4>
                </div>
                <div className="text-right">
                    <span className="text-2xl md:text-3xl font-black tracking-tight font-mono" dir="ltr">
                        {amount}
                    </span>
                    <span className="text-[10px] text-white/80 block -mt-1 font-semibold">جنيه مصري</span>
                </div>
            </div>
        </div>
    );
};
