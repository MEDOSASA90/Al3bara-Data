import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { compressImage } from '../compressImage';

interface SupplyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { 
        payerName: string; 
        date: Date; 
        receiptImage?: { name: string; url: string } 
    }) => void;
    targetLabel: string;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}

export const SupplyModal: React.FC<SupplyModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    targetLabel, 
    onFileUpload 
}) => {
    const [payerName, setPayerName] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let receiptImage = undefined;
        if (receiptFile) {
            setIsUploading(true);
            try {
                const compressedFile = await compressImage(receiptFile, 1024, 0.7);
                receiptImage = await onFileUpload(compressedFile, 'receipt');
            } catch (err) {
                console.error(err);
                alert("فشل رفع الصورة");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);

        onSave({ payerName: payerName.trim(), date: correctedDate, receiptImage });
        setReceiptFile(null);
        setPayerName('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={targetLabel}>
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                
                {/* Payer Name */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم القائم بالدفع</label>
                    <input
                        type="text"
                        value={payerName}
                        onChange={e => setPayerName(e.target.value)}
                        placeholder="أدخل اسم الشخص الذي قام بالسداد"
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    />
                </div>

                {/* Payment Date */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الدفع</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                        required
                    />
                </div>

                {/* Upload Receipt file */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                    <label className="block text-xs font-bold text-slate-500 mb-2">إرفاق إيصال الدفع / الإيداع</label>
                    <div className="flex items-center gap-3">
                        <input 
                            id="receipt-upload" 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)} 
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

                {/* Form Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        disabled={isUploading} 
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm"
                    >
                        {isUploading ? '🔄 جاري الرفع...' : '💾 تأكيد وحفظ التوريد'}
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
