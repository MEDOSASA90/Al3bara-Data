import React from 'react';
import { User } from '../types';

interface HeaderProps {
    user: User;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => (
    <header className="bg-white/80 backdrop-blur-md text-slate-800 shadow-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/10 flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-black bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 bg-clip-text text-transparent leading-none">
                        العبارة
                    </h1>
                    <span className="text-[10px] text-slate-500 font-semibold tracking-wider hidden xs:inline-block">للتجارة والتوريدات</span>
                </div>
            </div>

            {/* Profile & Logout Section */}
            <div className="flex items-center gap-3">
                {user.email && (
                    <div className="hidden md:flex items-center gap-2 bg-slate-50 rounded-xl px-3.5 py-1.5 border border-slate-200/60">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-slate-600 font-mono" dir="ltr">{user.email}</span>
                    </div>
                )}
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 font-bold px-3.5 py-2 rounded-xl shadow-sm transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    title="تسجيل الخروج"
                >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-xs font-bold">خروج</span>
                </button>
            </div>
        </div>
    </header>
);
