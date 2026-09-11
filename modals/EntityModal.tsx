import React, { useState, useEffect } from 'react';
import { Entity, PredefinedBuyer } from '../types';
import { Modal } from '../components/Modal';

interface EntityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; buyerName: string; auctionDate: string }) => void;
    entity: Entity | null;
    predefinedBuyers: PredefinedBuyer[];
    onOpenPredefinedBuyerModal: () => void;
}

export const EntityModal: React.FC<EntityModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    entity, 
    predefinedBuyers, 
    onOpenPredefinedBuyerModal 
}) => {
    const [name, setName] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [auctionDateString, setAuctionDateString] = useState('');

    useEffect(() => {
        if (entity) {
            setName(entity.name);
            setBuyerName(entity.buyerName || '');
            if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                try {
                    setAuctionDateString(entity.auctionDate.toDate().toISOString().split('T')[0]);
                } catch (e) {
                    setAuctionDateString('');
                }
            }
        } else {
            setAuctionDateString(new Date().toISOString().split('T')[0]);
            setBuyerName('');
            setName('');
        }
    }, [entity, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name: name.trim(), buyerName, auctionDate: auctionDateString });
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={entity ? 'تعديل بيانات الجهة' : 'إضافة جهة/جلسة جديدة'}
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                {/* Entity Name */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم الجهة / الهيئة</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="مثال: شركة المياه، السكة الحديد..."
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white" 
                        required 
                    />
                </div>

                {/* Buyer Name */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المشتري / المندوب</label>
                    <select
                        value={buyerName}
                        onChange={(e) => {
                            if (e.target.value === 'add_new') {
                                onOpenPredefinedBuyerModal();
                            } else {
                                setBuyerName(e.target.value);
                            }
                        }}
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    >
                        <option value="">-- اختر مشتري --</option>
                        {predefinedBuyers.map(buyer => (
                            <option key={buyer.id} value={buyer.name}>{buyer.name}</option>
                        ))}
                        <option value="add_new" className="font-extrabold text-indigo-600">➕ إضافة مشتري جديد...</option>
                    </select>
                </div>

                {/* Auction/Session Date */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الجلسة</label>
                    <input
                        type="date"
                        value={auctionDateString}
                        onChange={e => setAuctionDateString(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    />
                </div>

                {/* Submit actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] cursor-pointer text-sm"
                    >
                        {entity ? '💾 حفظ التعديلات' : '➕ إضافة الجلسة'}
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
