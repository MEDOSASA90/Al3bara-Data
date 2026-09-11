import React, { useState } from 'react';
import { Client, Transaction } from '../types';
import { Modal } from '../components/Modal';
import { compressImage } from '../compressImage';
import { formatDate, formatCurrency } from '../utils/helpers';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { 
        amount: number; 
        date: Date; 
        notes: string; 
        linkedTransactionId?: string; 
        receiptImage?: { name: string; url: string } 
    }) => void;
    client: Client;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    client, 
    onFileUpload 
}) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [notes, setNotes] = useState('');
    const [linkedTransactionId, setLinkedTransactionId] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const unsettledTransactions = (client.transactions || []).filter(t => !t.isSettled);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof amount !== 'number' || amount <= 0) {
            alert("الرجاء إدخال مبلغ صحيح.");
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);

        let receiptImage: { name: string; url: string } | undefined;

        if (receiptFile) {
            setIsUploading(true);
            try {
                const compressedFile = await compressImage(receiptFile, 1024, 0.7);
                receiptImage = await onFileUpload(compressedFile, 'payment_receipt');
            } catch (error) {
                console.error(error);
                alert('فشل رفع صورة الإيصال');
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        onSave({ amount, date: correctedDate, notes, linkedTransactionId, receiptImage });
        setReceiptFile(null);
        setAmount('');
        setNotes('');
        setLinkedTransactionId('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تسجيل سداد نقدي لـ ${client.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                
                {/* Payment Amount */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">مبلغ السداد (جنيه مصري)</label>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(parseFloat(e.target.value) || '')} 
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white font-mono" 
                        required 
                        min="0"
                        step="any"
                    />
                </div>

                {/* Payment Date */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ السداد</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white" 
                        required 
                    />
                </div>

                {/* Linked Transaction */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ربط هذا السداد بفاتورة/حركة معينة (اختياري)</label>
                    <select 
                        value={linkedTransactionId} 
                        onChange={e => setLinkedTransactionId(e.target.value)} 
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                    >
                        <option value="">-- لا يوجد ربط (دفعة عامة لحساب العميل) --</option>
                        {unsettledTransactions.map(t => (
                            <option key={t.id} value={t.id}>
                                {`حركة بتاريخ ${formatDate(t.date)} - بمبلغ ${formatCurrency(t.amount)}`}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات وبيان السداد</label>
                    <textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        rows={3} 
                        placeholder="مثال: تحويل بنكي، إيصال استلام نقدية..."
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white resize-none"
                    ></textarea>
                </div>

                {/* Receipt Upload */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                    <label className="block text-xs font-bold text-slate-500 mb-2">إرفاق صورة إيصال الاستلام (اختياري)</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            id="receipt-upload"
                            accept="image/*"
                            onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <label
                            htmlFor="receipt-upload"
                            className="text-xs font-extrabold px-4 py-2 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all duration-150"
                        >
                            {receiptFile ? '🔄 تغيير الملف' : '📎 اختيار ملف الصورة'}
                        </label>
                        <span className="text-xs text-slate-500 truncate max-w-[200px]">
                            {receiptFile ? receiptFile.name : 'لا يوجد ملف مرفق'}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        disabled={isUploading} 
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-650 hover:to-teal-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm"
                    >
                        {isUploading ? '🔄 جاري الرفع...' : '💾 تسجيل السداد'}
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
