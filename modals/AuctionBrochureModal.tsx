import React, { useState, useMemo, useEffect } from 'react';
import { PredefinedBuyer } from '../types';
import { Modal } from '../components/Modal';
import { PRELOADED_AUCTIONS, AuctionBrochureData, ParsedEntity, ParsedLot } from '../utils/preloadedAuctions';
import { extractTextFromPDF, parseBrochureText } from '../utils/brochureParser';
import { analyzeBrochureWithGemini, getGeminiApiKey, saveGeminiApiKey } from '../utils/geminiParser';
import { formatCurrency } from '../utils/helpers';

interface WinningLotItem {
    parsedLot: ParsedLot;
    selected: boolean;
    quantity: number | '';
    unit: string;
    unitPrice: number | '';
    totalValue: number | '';
    stampFee: number;
    value30: number | '';
    value70: number | '';
}

interface AuctionBrochureModalProps {
    isOpen: boolean;
    onClose: () => void;
    predefinedBuyers: PredefinedBuyer[];
    onOpenPredefinedBuyerModal: () => void;
    onSaveAwardedEntity: (data: {
        entityName: string;
        buyerName: string;
        auctionDate: string;
        lots: {
            lotNumber: string;
            name: string;
            quantity: string;
            totalValue: number;
            value30: number;
            value70: number;
        }[];
    }) => Promise<void>;
}

export const AuctionBrochureModal: React.FC<AuctionBrochureModalProps> = ({
    isOpen,
    onClose,
    predefinedBuyers,
    onOpenPredefinedBuyerModal,
    onSaveAwardedEntity
}) => {
    // Current active brochure data
    const [selectedBrochureId, setSelectedBrochureId] = useState<string>(PRELOADED_AUCTIONS[0].id);
    const [customBrochure, setCustomBrochure] = useState<AuctionBrochureData | null>(null);

    // Selected Entity & Buyer
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [buyerName, setBuyerName] = useState<string>('');
    const [auctionDate, setAuctionDate] = useState<string>('');

    // Lots being bid/won on the selected entity
    const [entityLotsState, setEntityLotsState] = useState<{ [lotNumber: string]: WinningLotItem }>({});

    // Processing states
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [parsingMessage, setParsingMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [entitySearch, setEntitySearch] = useState('');

    // Gemini API Key management
    const [geminiKey, setGeminiKey] = useState<string>('');
    const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
    const [tempKeyInput, setTempKeyInput] = useState<string>('');

    useEffect(() => {
        const key = getGeminiApiKey();
        setGeminiKey(key);
        setTempKeyInput(key);
        if (key) {
            saveGeminiApiKey(key);
        }
    }, [isOpen]);

    // Available brochures (preloaded + any custom uploaded)
    const allBrochures = useMemo(() => {
        if (customBrochure) {
            return [customBrochure, ...PRELOADED_AUCTIONS];
        }
        return PRELOADED_AUCTIONS;
    }, [customBrochure]);

    // Current brochure
    const activeBrochure = useMemo(() => {
        return allBrochures.find(b => b.id === selectedBrochureId) || allBrochures[0];
    }, [allBrochures, selectedBrochureId]);

    // Total lots in active brochure
    const totalBrochureLotsCount = useMemo(() => {
        if (!activeBrochure || !activeBrochure.entities) return 0;
        return activeBrochure.entities.reduce((acc, ent) => acc + (ent.lots ? ent.lots.length : 0), 0);
    }, [activeBrochure]);

    // Set initial auction date when brochure changes
    useEffect(() => {
        if (activeBrochure) {
            setAuctionDate(activeBrochure.auctionDate);
            if (activeBrochure.entities.length > 0) {
                // If current selected entity is not in this brochure, pick first
                const exists = activeBrochure.entities.some(e => e.id === selectedEntityId);
                if (!exists) {
                    setSelectedEntityId(activeBrochure.entities[0].id);
                }
            }
        }
    }, [activeBrochure, selectedBrochureId]);

    // Current entity
    const activeEntity = useMemo(() => {
        if (!activeBrochure || !activeBrochure.entities) return null;
        return activeBrochure.entities.find(e => e.id === selectedEntityId) || activeBrochure.entities[0] || null;
    }, [activeBrochure, selectedEntityId]);

    // Helper: Parse quantity and unit from string like "200 عدد" or "6.400 طن" or "1700 كيلو"
    const parseQtyString = (str: string): { qty: number | ''; unit: string } => {
        if (!str) return { qty: '', unit: 'عدد' };
        const match = str.match(/([\d.,]+)\s*(.*)/);
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ''));
            const unit = match[2].trim() || 'عدد';
            return { qty: isNaN(num) ? '' : num, unit };
        }
        return { qty: '', unit: 'عدد' };
    };

    // Initialize or reset lots state when switching entity
    useEffect(() => {
        if (!activeEntity) return;
        const initialLots: { [lotNumber: string]: WinningLotItem } = {};
        activeEntity.lots.forEach(lot => {
            const { qty, unit } = parseQtyString(lot.quantity);
            initialLots[lot.lotNumber] = {
                parsedLot: lot,
                selected: false,
                quantity: qty,
                unit: unit,
                unitPrice: '',
                totalValue: '',
                stampFee: 10, // 10 EGP stamp duty on each lot
                value30: '',
                value70: ''
            };
        });
        setEntityLotsState(initialLots);
    }, [activeEntity]);

    // Smart Bidirectional Handlers for each lot
    const handleLotQuantityChange = (lotNum: string, valStr: string) => {
        const val = valStr === '' ? '' : parseFloat(valStr);
        setEntityLotsState(prev => {
            const cur = prev[lotNum];
            if (!cur) return prev;
            const updated = { ...cur, quantity: val };
            if (typeof val === 'number' && typeof cur.unitPrice === 'number' && val > 0 && cur.unitPrice > 0) {
                const newTotal = parseFloat((val * cur.unitPrice).toFixed(2));
                const base30 = Math.round(newTotal * 0.3);
                updated.totalValue = newTotal;
                updated.value30 = base30 + cur.stampFee;
                updated.value70 = newTotal - base30;
                updated.selected = true;
            } else if (typeof val === 'number' && typeof cur.totalValue === 'number' && val > 0 && cur.totalValue > 0) {
                updated.unitPrice = parseFloat((cur.totalValue / val).toFixed(2));
            }
            return { ...prev, [lotNum]: updated };
        });
    };

    const handleLotUnitPriceChange = (lotNum: string, valStr: string) => {
        const val = valStr === '' ? '' : parseFloat(valStr);
        setEntityLotsState(prev => {
            const cur = prev[lotNum];
            if (!cur) return prev;
            const updated = { ...cur, unitPrice: val };
            if (typeof val === 'number' && typeof cur.quantity === 'number' && val > 0 && cur.quantity > 0) {
                const newTotal = parseFloat((cur.quantity * val).toFixed(2));
                const base30 = Math.round(newTotal * 0.3);
                updated.totalValue = newTotal;
                updated.value30 = base30 + cur.stampFee;
                updated.value70 = newTotal - base30;
                updated.selected = true;
            }
            return { ...prev, [lotNum]: updated };
        });
    };

    const handleLotTotalChange = (lotNum: string, valStr: string) => {
        const val = valStr === '' ? '' : parseFloat(valStr);
        setEntityLotsState(prev => {
            const cur = prev[lotNum];
            if (!cur) return prev;
            const updated = { ...cur, totalValue: val };
            if (typeof val === 'number' && !isNaN(val) && val >= 0) {
                const base30 = Math.round(val * 0.3);
                updated.value30 = base30 + cur.stampFee;
                updated.value70 = val - base30;
                updated.selected = true;
                if (typeof cur.quantity === 'number' && cur.quantity > 0) {
                    updated.unitPrice = parseFloat((val / cur.quantity).toFixed(2));
                }
            } else {
                updated.value30 = '';
                updated.value70 = '';
                updated.selected = false;
            }
            return { ...prev, [lotNum]: updated };
        });
    };

    const handleLot30Change = (lotNum: string, valStr: string) => {
        const val = valStr === '' ? '' : parseFloat(valStr);
        setEntityLotsState(prev => {
            const cur = prev[lotNum];
            if (!cur) return prev;
            const updated = { ...cur, value30: val };
            if (typeof val === 'number' && !isNaN(val)) {
                const base30 = Math.max(0, val - cur.stampFee);
                if (typeof cur.totalValue === 'number' && cur.totalValue > 0) {
                    updated.value70 = cur.totalValue - base30;
                } else {
                    const derivedTotal = Math.round(base30 / 0.3);
                    updated.totalValue = derivedTotal;
                    updated.value70 = derivedTotal - base30;
                    if (typeof cur.quantity === 'number' && cur.quantity > 0) {
                        updated.unitPrice = parseFloat((derivedTotal / cur.quantity).toFixed(2));
                    }
                }
                updated.selected = true;
            }
            return { ...prev, [lotNum]: updated };
        });
    };

    const handleLot70Change = (lotNum: string, valStr: string) => {
        const val = valStr === '' ? '' : parseFloat(valStr);
        setEntityLotsState(prev => {
            const cur = prev[lotNum];
            if (!cur) return prev;
            const updated = { ...cur, value70: val };
            if (typeof val === 'number' && !isNaN(val)) {
                if (typeof cur.totalValue === 'number' && cur.totalValue > 0) {
                    const base30 = cur.totalValue - val;
                    updated.value30 = base30 + cur.stampFee;
                } else {
                    const derivedTotal = Math.round(val / 0.7);
                    updated.totalValue = derivedTotal;
                    const base30 = derivedTotal - val;
                    updated.value30 = base30 + cur.stampFee;
                    if (typeof cur.quantity === 'number' && cur.quantity > 0) {
                        updated.unitPrice = parseFloat((derivedTotal / cur.quantity).toFixed(2));
                    }
                }
                updated.selected = true;
            }
            return { ...prev, [lotNum]: updated };
        });
    };

    const handleToggleLotSelect = (lotNum: string) => {
        setEntityLotsState(prev => {
            const current = prev[lotNum];
            if (!current) return prev;
            return {
                ...prev,
                [lotNum]: {
                    ...current,
                    selected: !current.selected
                }
            };
        });
    };

    // Handle PDF upload with option for Gemini AI
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsingFile(true);
        setParsingMessage('جاري قراءة محتوى المستند وتفريغ الصفحات...');

        try {
            let extractedText = '';
            if (file.name.toLowerCase().endsWith('.pdf')) {
                extractedText = await extractTextFromPDF(file);
            } else {
                extractedText = await file.text();
            }

            let parsed: AuctionBrochureData;

            // Check if Gemini API key is available for ultra-accurate extraction
            const currentKey = geminiKey || getGeminiApiKey();
            if (currentKey) {
                setParsingMessage('🧠 جاري التحليل الذكي فائق الدقة بواسطة Gemini AI...');
                try {
                    parsed = await analyzeBrochureWithGemini(extractedText, false, currentKey);
                } catch (geminiErr: any) {
                    console.warn('Gemini API attempt encountered issue, falling back to built-in parser:', geminiErr);
                    parsed = parseBrochureText(extractedText);
                }
            } else {
                parsed = parseBrochureText(extractedText);
            }

            setCustomBrochure(parsed);
            setSelectedBrochureId(parsed.id);
            if (parsed.entities.length > 0) {
                setSelectedEntityId(parsed.entities[0].id);
            }
        } catch (err: any) {
            console.error('Error parsing brochure file:', err);
            alert('حدث خطأ أثناء قراءة ملف الكراسة: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setIsParsingFile(false);
            setParsingMessage('');
            e.target.value = '';
        }
    };

    // Save Gemini Key
    const handleSaveGeminiKey = () => {
        saveGeminiApiKey(tempKeyInput);
        setGeminiKey(tempKeyInput.trim());
        setShowKeyModal(false);
        alert('✅ تم حفظ مفتاح Gemini API بنجاح! سيتم استخدامه في التحليل فائق الدقة لكافة الكراسات.');
    };

    // Calculation summary of selected lots
    const summary = useMemo(() => {
        const items = Object.values(entityLotsState).filter(item => item.selected && typeof item.totalValue === 'number' && item.totalValue > 0);
        const count = items.length;
        const total = items.reduce((sum, item) => sum + (typeof item.totalValue === 'number' ? item.totalValue : 0), 0);
        const total30 = items.reduce((sum, item) => sum + (typeof item.value30 === 'number' ? item.value30 : 0), 0);
        const total70 = items.reduce((sum, item) => sum + (typeof item.value70 === 'number' ? item.value70 : 0), 0);
        const totalStamp = items.reduce((sum, item) => sum + (item.stampFee || 0), 0);
        return { count, total, total30, total70, totalStamp, items };
    }, [entityLotsState]);

    // Save awarded lots to Firebase
    const handleSave = async () => {
        if (!activeEntity) {
            alert('يرجى اختيار الجهة أولاً');
            return;
        }

        if (!buyerName.trim()) {
            alert('يرجى اختيار اسم المشتري / المندوب');
            return;
        }

        if (summary.count === 0) {
            alert('يرجى تحديد لوط واحد على الأقل وإدخال سعر الترسية له');
            return;
        }

        setIsSaving(true);
        try {
            const lotsToSave = summary.items.map(item => {
                const qtyStr = typeof item.quantity === 'number' ? `${item.quantity} ${item.unit}` : (item.parsedLot.quantity || '1 عدد');
                return {
                    lotNumber: item.parsedLot.lotNumber,
                    name: `${item.parsedLot.name}${item.parsedLot.condition ? ` (${item.parsedLot.condition})` : ''}`,
                    quantity: qtyStr,
                    totalValue: Number(item.totalValue),
                    value30: Number(item.value30), // Includes 10 EGP stamp duty
                    value70: Number(item.value70)
                };
            });

            await onSaveAwardedEntity({
                entityName: activeEntity.entityName,
                buyerName,
                auctionDate,
                lots: lotsToSave
            });

            alert(`✅ تم بنجاح تسجيل وترسية ${summary.count} لوط لصالح "${activeEntity.entityName}" بإجمالي ترسية ${formatCurrency(summary.total)} ج.م (شاملة ${summary.totalStamp} ج دمغات)`);
            onClose();
        } catch (err: any) {
            console.error('Error saving awarded lots:', err);
            alert('فشل حفظ اللوطات: ' + (err.message || 'خطأ غير متوقع'));
        } finally {
            setIsSaving(false);
        }
    };

    const filteredEntities = useMemo(() => {
        if (!activeBrochure || !activeBrochure.entities) return [];
        if (!entitySearch.trim()) return activeBrochure.entities;
        const term = entitySearch.toLowerCase();
        return activeBrochure.entities.filter(e => 
            e.entityName.toLowerCase().includes(term) || 
            (e.location && e.location.toLowerCase().includes(term))
        );
    }, [activeBrochure, entitySearch]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="📄 كراسات جلسات مزادات الخدمات الحكومية - الترسية والتسعير الذكي"
            dialogClassName="w-[96vw] max-w-7xl"
        >
            <div className="space-y-4 text-right max-h-[85vh] overflow-y-auto px-1" dir="rtl">
                
                {/* Header Banner */}
                <div className="bg-slate-900 text-white p-4 md:p-5 rounded-3xl shadow-lg border border-slate-800 space-y-4">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-800 pb-3.5">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base md:text-lg font-black text-amber-400">
                                    🏛️ كراسات مزادات وزارة المالية - الهيئة العامة للخدمات الحكومية
                                </h3>
                                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                                    إجمالي {totalBrochureLotsCount} لوط في هذه الكراسة
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                                اختر كراسة الجلسة لتفريغ كافة الجهات واللوطات وحساب الـ 30% والـ 70% والدمغات آلياً
                            </p>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowKeyModal(true)}
                                className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    geminiKey 
                                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900' 
                                        : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900'
                                }`}
                            >
                                <span>{geminiKey ? '✨ Gemini AI متصل تلقائياً' : '🔑 ربط Gemini API'}</span>
                            </button>

                            <label className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-2 hover:scale-[1.02]">
                                <span>📤 رفع كراسة PDF جديدة</span>
                                <input 
                                    type="file" 
                                    accept=".pdf,text/plain" 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    disabled={isParsingFile}
                                />
                            </label>
                        </div>
                    </div>

                    {isParsingFile && (
                        <div className="bg-amber-950/70 border border-amber-500/50 p-3 rounded-2xl text-amber-200 text-xs flex items-center gap-2.5 animate-pulse">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></div>
                            <span className="font-bold">{parsingMessage}</span>
                        </div>
                    )}

                    {/* Quick Session Tabs */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {allBrochures.map(b => {
                            const isSelected = b.id === selectedBrochureId;
                            const lotsCount = b.entities.reduce((sum, e) => sum + (e.lots ? e.lots.length : 0), 0);
                            return (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedBrochureId(b.id);
                                        if (b.entities.length > 0) {
                                            setSelectedEntityId(b.entities[0].id);
                                        }
                                    }}
                                    className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                                        isSelected 
                                            ? 'bg-amber-400 text-slate-950 shadow-lg scale-[1.02]' 
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                                    }`}
                                >
                                    <span>📅 {b.auctionDate}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${isSelected ? 'bg-slate-900 text-amber-300' : 'bg-slate-900 text-slate-400'}`}>
                                        {b.entities.length} جهة | {lotsCount} لوط
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* API Key Modal Popup if triggered */}
                {showKeyModal && (
                    <div className="bg-indigo-900/90 text-white p-5 rounded-3xl border border-indigo-400/40 shadow-2xl space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                                🔑 إعداد مفتاح Gemini API للتحليل فائق الدقة
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowKeyModal(false)}
                                className="text-slate-300 hover:text-white text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                            يتيح لك مفتاح Gemini تفريغ كراسات الشروط الكبيرة واستخراج كافة اللوطات والجهات المذكورة بنسبة دقة 100%. يمكنك الحصول على مفتاح مجاني من موقع <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">Google AI Studio</a>.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                placeholder="ألصق مفتاح Gemini API هنا (AIzaSy...)"
                                value={tempKeyInput}
                                onChange={(e) => setTempKeyInput(e.target.value)}
                                className="flex-1 px-4 py-2 bg-slate-950 border border-indigo-300/40 rounded-xl text-xs font-mono text-white outline-none focus:border-amber-400"
                            />
                            <button
                                type="button"
                                onClick={handleSaveGeminiKey}
                                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-5 py-2 rounded-xl cursor-pointer shadow-md"
                            >
                                حفظ المفتاح
                            </button>
                        </div>
                    </div>
                )}

                {/* Session Config: Date & Buyer & Hall */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-200">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ الجلسة</label>
                        <input
                            type="date"
                            value={auctionDate}
                            onChange={(e) => setAuctionDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">المشتري / المندوب <span className="text-rose-500">*</span></label>
                        <select
                            value={buyerName}
                            onChange={(e) => {
                                if (e.target.value === 'add_new') {
                                    onOpenPredefinedBuyerModal();
                                } else {
                                    setBuyerName(e.target.value);
                                }
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                            required
                        >
                            <option value="">-- اختر المشتري للشركة --</option>
                            {predefinedBuyers.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                            <option value="add_new" className="text-indigo-600 font-bold">➕ إضافة مشتري جديد...</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">مكان انعقاد الجلسة</label>
                        <p className="px-3 py-2 bg-slate-200/70 rounded-xl text-xs font-semibold text-slate-700 truncate" title={activeBrochure.hallLocation}>
                            {activeBrochure.hallLocation}
                        </p>
                    </div>
                </div>

                {/* Main Desktop Grid: Right column = Entities list (30%), Left column = Lots table (70%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    
                    {/* Entities Sidebar List (4 of 12 cols on desktop) */}
                    <div className="lg:col-span-4 bg-white p-3.5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <label className="block text-xs font-black text-slate-800">
                                🏢 جهات الكراسة ({filteredEntities.length} جهة):
                            </label>
                            <span className="text-[10px] text-slate-400 font-bold">اضغط للاختيار</span>
                        </div>

                        <input
                            type="text"
                            placeholder="🔍 ابحث عن جهة أو محافظة..."
                            value={entitySearch}
                            onChange={(e) => setEntitySearch(e.target.value)}
                            className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 w-full focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />

                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredEntities.map((ent, idx) => {
                                const isSelected = ent.id === selectedEntityId;
                                return (
                                    <div
                                        key={ent.id}
                                        onClick={() => setSelectedEntityId(ent.id)}
                                        className={`p-3 rounded-2xl cursor-pointer border transition-all text-xs flex justify-between items-start gap-2 ${
                                            isSelected
                                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-md font-bold scale-[1.01]'
                                                : 'bg-slate-50/70 text-slate-800 border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40'
                                        }`}
                                    >
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                                <p className="font-bold truncate" title={ent.entityName}>{ent.entityName}</p>
                                            </div>
                                            {ent.location && (
                                                <p className={`text-[10px] truncate mr-6.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`} title={ent.location}>
                                                    📍 {ent.location}
                                                </p>
                                            )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 font-bold ${
                                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-white text-slate-700 border border-slate-200'
                                        }`}>
                                            {ent.lots.length} لوط
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Lots Table for Selected Entity (8 of 12 cols on desktop) */}
                    <div className="lg:col-span-8 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                        {activeEntity ? (
                            <>
                                <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-200 pb-2.5">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <span>📦 لوطات:</span>
                                            <span className="text-indigo-600 font-bold">{activeEntity.entityName}</span>
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            💡 أدخل (سعر الوحدة كالكرتونة أو الطن) أو (إجمالي اللوط) أو (30% أو 70%)؛ ليتم حساب باقي القيم وإضافة 10 ج دمغة تلقائياً:
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-amber-800 text-[11px] font-bold">
                                        ⚖️ دمغة اللوط: 10 ج.م مضافة على الـ 30%
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                                    <table className="w-full text-xs text-right min-w-[700px]">
                                        <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5 text-center w-10">ترسية</th>
                                                <th className="p-2.5 w-14">اللوط</th>
                                                <th className="p-2.5">بيان وصنف اللوط</th>
                                                <th className="p-2.5 w-24">الكمية</th>
                                                <th className="p-2.5 w-24">سعر الوحدة</th>
                                                <th className="p-2.5 w-32">إجمالي الترسية (100%)</th>
                                                <th className="p-2.5 w-32 text-indigo-700">30% + 10ج دمغة</th>
                                                <th className="p-2.5 w-28 text-amber-700">70% متبقي</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {activeEntity.lots.map(lot => {
                                                const state = entityLotsState[lot.lotNumber] || {
                                                    parsedLot: lot,
                                                    selected: false,
                                                    quantity: '',
                                                    unit: 'عدد',
                                                    unitPrice: '',
                                                    totalValue: '',
                                                    stampFee: 10,
                                                    value30: '',
                                                    value70: ''
                                                };

                                                return (
                                                    <tr key={lot.lotNumber} className={`transition-colors ${state.selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                                                        <td className="p-2.5 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={state.selected}
                                                                onChange={() => handleToggleLotSelect(lot.lotNumber)}
                                                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="p-2.5 font-bold font-mono text-slate-900">
                                                            {lot.lotNumber}
                                                        </td>
                                                        <td className="p-2.5 font-semibold text-slate-800">
                                                            <div>{lot.name}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    {lot.condition || 'خردة'}
                                                                </span>
                                                                {lot.notes && <span className="text-[10px] text-amber-700">⚠️ {lot.notes}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-2.5">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    value={state.quantity}
                                                                    onChange={(e) => handleLotQuantityChange(lot.lotNumber, e.target.value)}
                                                                    className="w-16 px-1.5 py-1 border border-slate-200 rounded text-center text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                                                    step="any"
                                                                />
                                                                <span className="text-[10px] text-slate-500 font-bold">{state.unit}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-2.5">
                                                            <input
                                                                type="number"
                                                                placeholder="سعر الوحدة..."
                                                                value={state.unitPrice}
                                                                onChange={(e) => handleLotUnitPriceChange(lot.lotNumber, e.target.value)}
                                                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500 bg-white"
                                                                step="any"
                                                            />
                                                        </td>
                                                        <td className="p-2.5">
                                                            <input
                                                                type="number"
                                                                placeholder="إجمالي اللوط..."
                                                                value={state.totalValue}
                                                                onChange={(e) => handleLotTotalChange(lot.lotNumber, e.target.value)}
                                                                className="w-full px-2 py-1 border-2 border-slate-200 rounded-lg text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-indigo-500 bg-white"
                                                                step="any"
                                                            />
                                                        </td>
                                                        <td className="p-2.5">
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    placeholder="30% + 10ج..."
                                                                    value={state.value30}
                                                                    onChange={(e) => handleLot30Change(lot.lotNumber, e.target.value)}
                                                                    className="w-full px-2 py-1 border border-indigo-200 rounded-lg text-xs font-mono font-black text-indigo-700 focus:outline-none focus:border-indigo-500 bg-indigo-50/40"
                                                                    step="any"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-2.5">
                                                            <input
                                                                type="number"
                                                                placeholder="70% متبقي..."
                                                                value={state.value70}
                                                                onChange={(e) => handleLot70Change(lot.lotNumber, e.target.value)}
                                                                className="w-full px-2 py-1 border border-amber-200 rounded-lg text-xs font-mono font-black text-amber-700 focus:outline-none focus:border-amber-500 bg-amber-50/40"
                                                                step="any"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-slate-400 text-xs">
                                اختر جهة من القائمة لعرض لوطاتها
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Bar: Stats & Submit */}
                <div className="bg-slate-900 text-white p-4 md:p-5 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4 sticky bottom-0 shadow-2xl border border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center w-full md:w-auto">
                        <div>
                            <span className="text-[10px] text-slate-400 block font-bold">اللوطات المختارة</span>
                            <span className="text-sm md:text-base font-black text-amber-400 font-mono">{summary.count} لوط</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 block font-bold">إجمالي الترسية (100%)</span>
                            <span className="text-sm md:text-base font-black text-white font-mono" dir="ltr">{formatCurrency(summary.total)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-indigo-300 block font-bold">مسدد بالجلسة (30% + دمغات)</span>
                            <span className="text-sm md:text-base font-black text-indigo-400 font-mono" dir="ltr">{formatCurrency(summary.total30)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-amber-300 block font-bold">متبقي الـ 70% (15 يوم)</span>
                            <span className="text-sm md:text-base font-black text-amber-400 font-mono" dir="ltr">{formatCurrency(summary.total70)}</span>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
                        >
                            إلغاء
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || summary.count === 0}
                            className={`px-6 py-2.5 text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                                summary.count > 0 && !isSaving
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white hover:scale-105'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isSaving ? '⏳ جاري الحفظ...' : '💾 تسجيل وترسية اللوطات بالسيستم'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
