import React, { useState, useEffect } from 'react';
import { Lot } from '../types';
import { Modal } from '../components/Modal';
import { compressImage } from '../compressImage';
import { formatCurrency } from '../utils/helpers';

interface LotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    lot: Lot | null;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}

export const LotModal: React.FC<LotModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    lot, 
    onFileUpload 
}) => {
    const [lotNumber, setLotNumber] = useState('');
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [quantityType, setQuantityType] = useState<'count' | 'weight'>('count');
    const [unitPrice, setUnitPrice] = useState<number | ''>('');
    const [totalValue, setTotalValue] = useState<number | ''>('');
    const [value30, setValue30] = useState<number | ''>('');
    const [value70, setValue70] = useState<number | ''>('');
    const [stampFee, setStampFee] = useState<number>(10);
    const [contractImageFile, setContractImageFile] = useState<File | null>(null);
    const [existingImage, setExistingImage] = useState<{ name: string, url: string } | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (lot) {
            setLotNumber(lot.lotNumber);
            setName(lot.name);
            const qMatch = lot.quantity ? lot.quantity.match(/([\d.]+)\s*(.*)/) : null;
            let parsedQty: number | '' = '';
            if (qMatch) {
                parsedQty = parseFloat(qMatch[1]);
                setQuantity(parsedQty);
                const unit = qMatch[2].toLowerCase();
                if (unit.includes('طن') || unit.includes('kg') || unit.includes('kilo') || unit.includes('weight') || unit.includes('وزن')) {
                    setQuantityType('weight');
                } else {
                    setQuantityType('count');
                }
            } else {
                setQuantity('');
            }
            setTotalValue(lot.totalValue);
            setValue30(lot.value30);
            setValue70(lot.value70 || (lot.totalValue - lot.value30));
            setStampFee(10);
            if (typeof parsedQty === 'number' && parsedQty > 0 && lot.totalValue) {
                setUnitPrice(parseFloat((lot.totalValue / parsedQty).toFixed(2)));
            } else {
                setUnitPrice('');
            }
            setExistingImage(lot.contractImage);
            setContractImageFile(null);
        } else {
            setLotNumber('');
            setName('');
            setQuantity('');
            setQuantityType('count');
            setUnitPrice('');
            setTotalValue('');
            setValue30('');
            setValue70('');
            setStampFee(10);
            setExistingImage(undefined);
            setContractImageFile(null);
        }
    }, [lot]);

    // Bidirectional Calculation Handlers
    const handleQuantityChange = (qtyVal: number | '') => {
        setQuantity(qtyVal);
        if (typeof qtyVal === 'number' && typeof unitPrice === 'number' && qtyVal > 0 && unitPrice > 0) {
            const newTotal = parseFloat((qtyVal * unitPrice).toFixed(2));
            setTotalValue(newTotal);
            const base30 = Math.round(newTotal * 0.3);
            setValue30(base30 + stampFee);
            setValue70(newTotal - base30);
        } else if (typeof qtyVal === 'number' && typeof totalValue === 'number' && qtyVal > 0 && totalValue > 0) {
            setUnitPrice(parseFloat((totalValue / qtyVal).toFixed(2)));
        }
    };

    const handleUnitPriceChange = (priceVal: number | '') => {
        setUnitPrice(priceVal);
        if (typeof priceVal === 'number' && typeof quantity === 'number' && priceVal > 0 && quantity > 0) {
            const newTotal = parseFloat((quantity * priceVal).toFixed(2));
            setTotalValue(newTotal);
            const base30 = Math.round(newTotal * 0.3);
            setValue30(base30 + stampFee);
            setValue70(newTotal - base30);
        }
    };

    const handleTotalValueChange = (totalVal: number | '') => {
        setTotalValue(totalVal);
        if (typeof totalVal === 'number' && !isNaN(totalVal) && totalVal >= 0) {
            const base30 = Math.round(totalVal * 0.3);
            setValue30(base30 + stampFee);
            setValue70(totalVal - base30);
            if (typeof quantity === 'number' && quantity > 0) {
                setUnitPrice(parseFloat((totalVal / quantity).toFixed(2)));
            }
        } else {
            setValue30('');
            setValue70('');
        }
    };

    const handleValue30Change = (v30: number | '') => {
        setValue30(v30);
        if (typeof v30 === 'number' && !isNaN(v30)) {
            const base30 = Math.max(0, v30 - stampFee);
            if (typeof totalValue === 'number' && totalValue > 0) {
                setValue70(totalValue - base30);
            } else {
                const derivedTotal = Math.round(base30 / 0.3);
                setTotalValue(derivedTotal);
                setValue70(derivedTotal - base30);
                if (typeof quantity === 'number' && quantity > 0) {
                    setUnitPrice(parseFloat((derivedTotal / quantity).toFixed(2)));
                }
            }
        }
    };

    const handleValue70Change = (v70: number | '') => {
        setValue70(v70);
        if (typeof v70 === 'number' && !isNaN(v70)) {
            if (typeof totalValue === 'number' && totalValue > 0) {
                const base30 = totalValue - v70;
                setValue30(base30 + stampFee);
            } else {
                const derivedTotal = Math.round(v70 / 0.7);
                setTotalValue(derivedTotal);
                const base30 = derivedTotal - v70;
                setValue30(base30 + stampFee);
                if (typeof quantity === 'number' && quantity > 0) {
                    setUnitPrice(parseFloat((derivedTotal / quantity).toFixed(2)));
                }
            }
        }
    };

    const handleStampFeeChange = (fee: number) => {
        setStampFee(fee);
        if (typeof totalValue === 'number' && totalValue > 0) {
            const base30 = Math.round(totalValue * 0.3);
            setValue30(base30 + fee);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totalValue === '' || isNaN(totalValue)) return;
        if (value30 === '' || isNaN(value30)) return;

        let contractImage: { name: string, url: string } | undefined | null = existingImage;
        if (contractImageFile) {
            setIsUploading(true);
            try {
                // Compress contract image (higher width for details readability)
                const compressedFile = await compressImage(contractImageFile, 1024, 0.7);
                contractImage = await onFileUpload(compressedFile, 'lot_contract');
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("فشل رفع صورة العقد");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const unitLabel = quantityType === 'weight' ? 'طن' : 'عدد/قطعة';
        const quantityString = (typeof quantity === 'number') ? `${quantity} ${unitLabel}` : '';

        onSave({ 
            lotNumber: lotNumber.trim(), 
            name: name.trim(), 
            quantity: quantityString, 
            totalValue: Number(totalValue), 
            value30: Number(value30), 
            contractImage 
        });
    };

    const lightInputClasses = "w-full px-4 py-2.5 bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 text-sm hover:border-slate-300";

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={lot ? 'تعديل بيانات اللوط' : 'إضافة لوط جديد للمزاد'} 
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                
                {/* Lot Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم اللوط</label>
                        <input 
                            type="text" 
                            placeholder="أدخل رقم اللوط (مثال: لوط 4)" 
                            value={lotNumber} 
                            onChange={e => setLotNumber(e.target.value)} 
                            className={lightInputClasses} 
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">مسمى وصنف اللوط</label>
                        <input 
                            type="text" 
                            placeholder="مثال: خشب كسر / حديد خردة / جراكن" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className={lightInputClasses} 
                            required 
                        />
                    </div>
                </div>

                {/* Quantity and Unit Price */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-slate-700">الكمية وسعر الوحدة (لحساب الإجمالي تلقائياً)</label>
                        <div className="flex bg-slate-200/70 rounded-lg p-0.5 text-xs font-bold">
                            <button 
                                type="button" 
                                onClick={() => setQuantityType('count')} 
                                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                    quantityType === 'count' 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600'
                                }`}
                            >
                                عدد / كراتين / جراكن
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setQuantityType('weight')} 
                                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                    quantityType === 'weight' 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600'
                                }`}
                            >
                                طن / كجم
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <span className="text-[11px] text-slate-500 font-bold block mb-1">الكمية المقدرة:</span>
                            <input 
                                type="number" 
                                placeholder="مثال: 5000 أو 10.5" 
                                value={quantity} 
                                onChange={e => handleQuantityChange(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                className={lightInputClasses} 
                                step="any"
                            />
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-500 font-bold block mb-1">سعر الوحدة الواحدة (ج.م):</span>
                            <input 
                                type="number" 
                                placeholder="مثال: 6.10 للجركن أو 24200 للطن" 
                                value={unitPrice} 
                                onChange={e => handleUnitPriceChange(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                                className={lightInputClasses} 
                                step="any"
                            />
                        </div>
                    </div>
                </div>

                {/* Total Lot Value */}
                <div>
                    <label className="block text-xs font-black text-slate-800 mb-1.5">إجمالي قيمة ترسية اللوط (100%) (ج.م)</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={totalValue}
                        onChange={e => handleTotalValueChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-black text-lg text-center font-mono outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-xs"
                        required
                        step="any"
                    />
                </div>

                {/* 30% Down Payment and 70% Remaining */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="lot-value-30" className="text-xs font-black text-indigo-900">
                                دفعة 30% + الدمغة (مسدد بالجلسة)
                            </label>
                            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                + {stampFee} ج دمغة لوط
                            </span>
                        </div>
                        <input
                            id="lot-value-30"
                            type="number"
                            value={value30}
                            onChange={e => handleValue30Change(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-indigo-700 text-center font-black font-mono text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
                            required
                            step="any"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-black text-amber-900">
                                متبقي التوريد 70% (خلال 15 يوم)
                            </label>
                            <span className="text-[10px] text-slate-500 font-bold">قابل للتعديل</span>
                        </div>
                        <input
                            type="number"
                            value={value70}
                            onChange={e => handleValue70Change(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full p-2.5 bg-white border border-amber-200 rounded-xl text-amber-800 text-center font-black font-mono text-sm focus:outline-none focus:border-amber-500 shadow-xs"
                            required
                            step="any"
                        />
                    </div>
                </div>

                {/* Stamp duty quick config toggle */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>قيمة دمغة اللوط المقررة:</span>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="number"
                            value={stampFee}
                            onChange={e => handleStampFeeChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            className="w-16 px-2 py-0.5 border border-slate-200 rounded-lg text-center font-bold font-mono text-xs bg-white"
                        />
                        <span className="font-bold">ج.م (تضاف على الـ 30% تلقائياً)</span>
                    </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 font-bold flex justify-between items-center">
                    <span>صافي ثمن اللوط بدون دمغة:</span>
                    <span className="font-mono text-xs text-slate-800 font-black" dir="ltr">
                        {typeof totalValue === 'number' ? formatCurrency(totalValue) : '0.00'} ج.م
                    </span>
                </div>

                {/* Contract File Attachment */}
                <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl">
                    <label className="block text-xs font-bold text-slate-500 mb-2">إرفاق صورة العقد / كراسة الشروط</label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="text" 
                            readOnly 
                            value={contractImageFile ? contractImageFile.name : (existingImage ? existingImage.name : '')} 
                            placeholder="لم يتم اختيار صورة..." 
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 text-right outline-none" 
                        />
                        <label 
                            htmlFor="contract-image-upload" 
                            className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 text-indigo-600 font-bold text-xs py-2 px-3 rounded-lg transition-colors"
                        >
                            تصفح الملف
                        </label>
                        <input 
                            id="contract-image-upload" 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => setContractImageFile(e.target.files ? e.target.files[0] : null)} 
                        />
                    </div>
                    {existingImage && !contractImageFile && (
                        <a 
                            href={existingImage.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-indigo-600 hover:underline mt-2 inline-block font-semibold"
                        >
                            🔗 عرض العقد الحالي المرفوع
                        </a>
                    )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 mt-5">
                    <button 
                        type="submit" 
                        disabled={isUploading} 
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm"
                    >
                        {isUploading ? '🔄 جاري الرفع...' : (lot ? '💾 حفظ التعديلات' : '➕ إضافة اللوط للمزاد')}
                    </button>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="flex-1 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 px-5 rounded-xl transition-all duration-200 cursor-pointer text-sm"
                    >
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};
