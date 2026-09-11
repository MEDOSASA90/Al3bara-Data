import React from 'react';

export const SplashScreen: React.FC = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col justify-center items-center z-50 text-slate-800 animate-fadeIn">
        {/* Glow behind the icon */}
        <div className="absolute w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <svg
                className="w-28 h-28 mb-6 text-indigo-600 animate-float"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(79, 70, 229, 0.15))' }}
            >
                <path d="M10 55L20 40H80L90 55H10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M20 65V55" stroke="currentColor" strokeWidth="3" />
                <path d="M80 65V55" stroke="currentColor" strokeWidth="3" />
                <path d="M10 55L20 65H80L90 55" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
                <rect x="25" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
                <rect x="45" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
                <rect x="65" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
                <path d="M5 75H95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M15 80H85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
            </svg>
            <h1 
                className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-indigo-600 via-slate-800 to-indigo-800 bg-clip-text text-transparent animate-fadeInScale pb-2"
                style={{ textShadow: '0 2px 10px rgba(79, 70, 229, 0.05)' }}
            >
                العبارة للتجارة والتوريدات
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide animate-pulse">جاري تحميل النظام...</p>
        </div>
    </div>
);
