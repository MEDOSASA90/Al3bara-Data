import React, { useState } from 'react';
import { Modal } from '../components/Modal';

interface LoadingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { loaderName: string; date: Date }) => void;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, onClose, onSave }) => {
    const [loaderName, setLoaderName] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);
        onSave({ loaderName: loaderName.trim(), date: correctedDate });
        setLoaderName('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تسجيل بيانات شحن وتحميل اللوط">
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                
                {/* Loader Name */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم القائم بالتحميل / الشحن</label>
                    <input
                        type="text"
                        value={loaderName}
                        onChange={e => setLoaderName(e.target.value)}
                        placeholder="أدخل اسم السائق أو شركة الشحن"
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    />
                </div>

                {/* Loading Date */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ التحميل والشحن</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    />
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] cursor-pointer text-sm"
                    >
                        💾 حفظ ونقل للأرشيف
                    </button>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 px-5 rounded-xl transition-all duration-200 cursor-pointer text-sm"
                    >
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};
