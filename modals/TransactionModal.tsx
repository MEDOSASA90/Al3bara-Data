import React, { useState, useEffect, useMemo } from 'react';
import { Client, Transaction, TransactionItem, PredefinedItem } from '../types';
import { Modal } from '../components/Modal';
import { toBase64, formatCurrency } from '../utils/helpers';
import { compressImage } from '../compressImage';
import { uploadToDrive } from '../uploadToDrive';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { 
        amount: number; 
        notes: string; 
        date: Date; 
        items: TransactionItem[]; 
        isSettled: boolean; 
        image?: { name: string; url: string } 
    }) => void;
    client: Client;
    transaction: Transaction | null;
    predefinedItems: PredefinedItem[];
    onOpenPredefinedItemModal: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    client,
    transaction,
    predefinedItems,
    onOpenPredefinedItemModal
}) => {
    const [date, setDate] = useState(new Date());
    const [notes, setNotes] = useState('');
    const [isSettled, setIsSettled] = useState(false);
    const [showItems, setShowItems] = useState(false);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [totalAmount, setTotalAmount] = useState<number | ''>('');
    const [transactionImage, setTransactionImage] = useState<{ name: string; url: string } | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);

    const calculatedTotalFromItems = useMemo(() => {
        if (!showItems || items.length === 0) return 0;
        return items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.pricePerKilo || 0)), 0);
    }, [items, showItems]);

    useEffect(() => {
        if (transaction) {
            setDate(transaction.date.toDate());
            setNotes(transaction.notes);
            setIsSettled(transaction.isSettled);
            const transactionItems = transaction.items || [];
            setItems(transactionItems);
            setShowItems(transactionItems.length > 0);
            setTotalAmount(transaction.amount);
            setTransactionImage(transaction.image || null);
        } else {
            setDate(new Date());
            setNotes('');
            setIsSettled(false);
            setItems([]);
            setShowItems(false);
            setTotalAmount('');
            setTransactionImage(null);
        }
    }, [transaction]);

    useEffect(() => {
        if (showItems) {
            setTotalAmount(calculatedTotalFromItems);
        }
    }, [calculatedTotalFromItems, showItems]);

    const handleDateChange = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        if (year && month && day) {
            setDate(new Date(year, month - 1, day));
        }
    };

    const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const handleItemImageUpload = async (index: number, file: File | null) => {
        if (!file) return;

        setUploadingItemIndex(index);
        try {
            const compressedFile = await compressImage(file);
            const base64 = await toBase64(compressedFile);
            const fileName = `${client.name}_item_${Date.now()}_${compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            
            const result: any = await uploadToDrive(base64, fileName, compressedFile.type);

            if (result && result.success) {
                const newItems = [...items];
                newItems[index].image = { name: compressedFile.name, url: result.url };
                setItems(newItems);
                alert("تم رفع الصورة بنجاح");
            } else {
                alert("فشل رفع الصورة: " + (result.error || "خطأ غير معروف"));
            }
        } catch (err: any) {
            console.error("Upload error:", err);
            alert("فشل معالجة/رفع الصورة: " + err.message);
        } finally {
            setUploadingItemIndex(null);
        }
    };

    const handleTransactionImageUpload = async (file: File | null) => {
        if (!file) return;

        setIsUploadingImage(true);
        try {
            const compressedFile = await compressImage(file);
            const base64 = await toBase64(compressedFile);
            const fileName = `${client.name}_tx_${Date.now()}_${compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            
            const result: any = await uploadToDrive(base64, fileName, compressedFile.type);

            if (result && result.success) {
                setTransactionImage({ name: compressedFile.name, url: result.url });
                alert("تم رفع صورة الحركة بنجاح");
            } else {
                alert("فشل رفع الصورة: " + (result.error || "خطأ غير معروف"));
            }
        } catch (err: any) {
            console.error("Upload error:", err);
            alert("فشل معالجة/رفع الصورة: " + err.message);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const addItem = () => {
        setItems([...items, { id: `${Date.now()}`, name: '', quantity: 0, pricePerKilo: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalAmount = typeof totalAmount === 'number' ? totalAmount : parseFloat(String(totalAmount)) || 0;
        onSave({
            amount: finalAmount,
            notes,
            date,
            items: showItems ? items : [],
            isSettled,
            image: transactionImage || undefined
        });
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={transaction ? `تعديل حركة لـ ${client.name}` : `إضافة حركة لـ ${client.name}`}
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                
                {/* Transaction Date */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الحركة</label>
                    <input 
                        type="date" 
                        value={date.toLocaleDateString('en-CA')} 
                        onChange={e => handleDateChange(e.target.value)} 
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white" 
                        required 
                    />
                </div>

                {/* Weights / Items toggle */}
                <div className="flex justify-between items-center py-1">
                    <span className="text-xs font-bold text-slate-500">أصناف ووزن البضاعة</span>
                    <button 
                        type="button" 
                        onClick={() => setShowItems(!showItems)} 
                        className="text-xs font-extrabold text-indigo-650 hover:text-indigo-850 transition-colors cursor-pointer"
                    >
                        {showItems ? '❌ إخفاء بنود الأصناف' : '➕ إضافة أصناف وأوزان مخصصة'}
                    </button>
                </div>

                {/* Items Breakdown list */}
                {showItems && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                        {items.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-2">لا توجد أصناف مضافة. اضغط لإضافة صنف جديد.</p>
                        ) : (
                            <div className="space-y-3 divide-y divide-slate-200/60">
                                {items.map((item, index) => (
                                    <div key={item.id} className="pt-3 first:pt-0 grid grid-cols-1 md:grid-cols-6 gap-2.5 items-center">
                                        
                                        {/* Name selection */}
                                        <div className="md:col-span-2">
                                            <select
                                                value={item.name}
                                                onChange={(e) => {
                                                    if (e.target.value === 'add_new') {
                                                        onOpenPredefinedItemModal();
                                                    } else {
                                                        handleItemChange(index, 'name', e.target.value)
                                                    }
                                                }}
                                                className="w-full px-3 py-1.5 border border-slate-205 rounded-lg text-xs outline-none bg-white focus:border-indigo-500"
                                                required
                                            >
                                                <option value="">-- اختر صنف --</option>
                                                {predefinedItems.map(pItem => (
                                                    <option key={pItem.id} value={pItem.name}>{pItem.name}</option>
                                                ))}
                                                <option value="add_new" className="font-extrabold text-indigo-600">➕ إضافة صنف جديد...</option>
                                            </select>
                                        </div>

                                        {/* Quantity */}
                                        <input 
                                            type="number" 
                                            placeholder="الوزن (كجم)" 
                                            value={item.quantity || ''} 
                                            onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} 
                                            className="w-full px-3 py-1.5 border border-slate-205 rounded-lg text-xs outline-none focus:border-indigo-500 font-mono" 
                                            min="0"
                                            step="any"
                                            required
                                        />

                                        {/* Price per Kilo */}
                                        <input 
                                            type="number" 
                                            placeholder="سعر الكيلو" 
                                            value={item.pricePerKilo || ''} 
                                            onChange={e => handleItemChange(index, 'pricePerKilo', parseFloat(e.target.value) || 0)} 
                                            className="w-full px-3 py-1.5 border border-slate-205 rounded-lg text-xs outline-none focus:border-indigo-500 font-mono" 
                                            min="0"
                                            step="any"
                                            required
                                        />

                                        {/* Total calculation */}
                                        <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-black text-center font-mono">
                                            {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                        </div>

                                        {/* Image Attach and Remove */}
                                        <div className="flex items-center justify-between gap-1 md:justify-center">
                                            <input 
                                                type="file" 
                                                id={`item-image-${index}`} 
                                                className="hidden" 
                                                onChange={(e) => handleItemImageUpload(index, e.target.files ? e.target.files[0] : null)} 
                                                disabled={uploadingItemIndex === index}
                                            />
                                            <label 
                                                htmlFor={`item-image-${index}`} 
                                                className={`text-[10px] px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer border border-slate-200 text-slate-755 font-bold transition-colors ${
                                                    uploadingItemIndex === index ? 'opacity-50 cursor-wait' : ''
                                                }`}
                                            >
                                                {uploadingItemIndex === index ? 'جاري...' : item.image ? '📸 تم' : '📎 صورة'}
                                            </label>
                                            
                                            {item.image && (
                                                <a href={item.image.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-650 hover:underline mr-1 font-semibold">
                                                    عرض
                                                </a>
                                            )}
                                            
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)} 
                                                className="text-rose-500 hover:text-rose-700 font-black text-lg p-1.5 cursor-pointer"
                                                title="حذف هذا الصنف"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button 
                            type="button" 
                            onClick={addItem} 
                            className="text-xs font-extrabold text-indigo-650 hover:text-indigo-850 transition-colors mt-2 block cursor-pointer"
                        >
                            ➕ إضافة بند صنف جديد
                        </button>
                    </div>
                )}

                {/* Total amount */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">المبلغ الإجمالي (جنيه مصري)</label>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="0.00"
                            value={totalAmount}
                            onChange={e => setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-center text-slate-900 font-mono outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200"
                            required
                            readOnly={showItems && items.length > 0} // Readonly if calculated automatically from items
                        />
                        {showItems && items.length > 0 && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 border border-slate-300/60 text-slate-600 px-2 py-0.5 rounded-md">حساب تلقائي</span>
                        )}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات وبيان الحركة</label>
                    <textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        rows={3} 
                        placeholder="اكتب ملاحظات الحركة هنا..."
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 resize-none"
                    ></textarea>
                </div>

                {/* Attachment Upload */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                    <label className="block text-xs font-bold text-slate-500 mb-2">صورة أو مستند الحركة (اختياري)</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            id="transaction-image"
                            className="hidden"
                            onChange={(e) => handleTransactionImageUpload(e.target.files ? e.target.files[0] : null)}
                            disabled={isUploadingImage}
                        />
                        <label
                            htmlFor="transaction-image"
                            className={`text-xs font-extrabold px-4 py-2 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all duration-150 ${
                                isUploadingImage ? 'opacity-50 cursor-wait' : ''
                            }`}
                        >
                            {isUploadingImage ? '🔄 جاري الرفع...' : '📎 اختيار ملف الصورة'}
                        </label>
                        {transactionImage && (
                            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-150 py-1.5 px-3 rounded-xl">
                                <a href={transactionImage.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 font-extrabold hover:underline">
                                    عرض الملف المرفق
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setTransactionImage(null)}
                                    className="text-rose-500 hover:text-rose-700 font-black text-sm cursor-pointer"
                                    title="حذف المرفق"
                                >
                                    حذف
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Settlement Flag */}
                <div className="flex items-center py-1 bg-indigo-50/40 border border-indigo-100 rounded-2xl px-4 select-none">
                    <input 
                        type="checkbox" 
                        id="isSettled" 
                        checked={isSettled} 
                        onChange={e => setIsSettled(e.target.checked)} 
                        className="h-4.5 w-4.5 text-indigo-650 border-slate-350 rounded-lg cursor-pointer" 
                    />
                    <label htmlFor="isSettled" className="mr-2.5 block text-xs font-extrabold text-slate-750 cursor-pointer">
                        هل هذه العملية دفعة سداد؟ (تخصم من حساب العميل)
                    </label>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] cursor-pointer text-sm"
                    >
                        {transaction ? '💾 حفظ التعديلات' : '➕ تسجيل الحركة'}
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
