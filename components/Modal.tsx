import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    dialogClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, dialogClassName }) => {
    // Prevent body scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fadeIn" 
            onClick={onClose}
        >
            <div 
                className={`rounded-3xl shadow-2xl border bg-white border-slate-200/80 w-full ${dialogClassName || 'max-w-md'} transform transition-all duration-300 scale-100`} 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-sm md:text-base font-black text-slate-800">
                            {title}
                        </h3>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150 cursor-pointer"
                    >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar text-slate-800 text-right" dir="rtl">
                    {children}
                </div>
            </div>
        </div>
    );
};
