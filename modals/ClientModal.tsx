import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { Modal } from '../components/Modal';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, phone?: string) => void;
    clientType: 'سلف' | 'شغل';
    existingClients: Client[];
}

export const ClientModal: React.FC<ClientModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    clientType, 
    existingClients 
}) => {
    const [mode, setMode] = useState<'select' | 'new'>('select');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [name, setName] = useState('');
    const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredClients = (existingClients || []).filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof client.phone === 'string' && client.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (Array.isArray(client.phone) && client.phone.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const handleClientSelection = (value: string) => {
        if (value === 'new') {
            setMode('new');
            setSelectedClientId('');
        } else {
            setMode('select');
            setSelectedClientId(value);
            setShowSuggestions(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (value && mode === 'select') {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (client: Client) => {
        setSelectedClientId(client.id);
        setSearchQuery(client.name);
        setMode('select');
        setShowSuggestions(false);
    };

    const addPhoneNumber = () => {
        setPhoneNumbers([...phoneNumbers, '']);
    };

    const removePhoneNumber = (index: number) => {
        setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
    };

    const updatePhoneNumber = (index: number, value: string) => {
        const updated = [...phoneNumbers];
        updated[index] = value;
        setPhoneNumbers(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'select' && selectedClientId) {
            const client = (existingClients || []).find(c => c.id === selectedClientId);
            if (client) {
                const phoneStr = Array.isArray(client.phone) ? client.phone.join(', ') : client.phone || '';
                onSave(client.name, phoneStr);
            }
        } else if (mode === 'new' && name.trim()) {
            const validPhones = phoneNumbers.filter(p => p.trim() !== '');
            const phoneString = validPhones.length > 0 ? validPhones.join(', ') : '';
            onSave(name.trim(), phoneString);
        }

        handleClose();
    };

    const handleClose = () => {
        setName('');
        setPhoneNumbers(['']);
        setSearchQuery('');
        setSelectedClientId('');
        setMode('select');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`إضافة/اختيار عميل ${clientType}`}>
            <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
                {/* Search Input */}
                <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">البحث السريع عن عميل</label>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="🔍 ابحث عن عميل بالاسم أو الهاتف..."
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350"
                    />

                    {/* Suggestions list */}
                    {showSuggestions && filteredClients.length > 0 && searchQuery && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                            {filteredClients.slice(0, 5).map(client => {
                                const phoneVal = Array.isArray(client.phone) ? client.phone.join(', ') : client.phone;
                                return (
                                    <div
                                        key={client.id}
                                        onClick={() => handleSuggestionClick(client)}
                                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex justify-between items-center transition-colors duration-150"
                                    >
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800 text-sm">{client.name}</p>
                                            {phoneVal && <p className="text-[10px] text-slate-500 mt-0.5">{phoneVal}</p>}
                                        </div>
                                        {client.isArchived && (
                                            <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/50 px-2.5 py-0.5 rounded-full">
                                                مؤرشف
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Dropdown Selector */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اختيار من القائمة</label>
                    <select
                        value={mode === 'new' ? 'new' : selectedClientId}
                        onChange={(e) => handleClientSelection(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350 bg-white"
                    >
                        <option value="">-- اختر عميل --</option>
                        <option value="new" className="font-extrabold text-indigo-600">➕ إضافة عميل جديد</option>
                        {filteredClients.length > 0 && (
                            <optgroup label="العملاء المتوفرين">
                                {filteredClients.map(client => {
                                    const phoneVal = Array.isArray(client.phone) ? client.phone.join(', ') : client.phone;
                                    return (
                                        <option key={client.id} value={client.id}>
                                            {client.name} {phoneVal ? `(${phoneVal})` : ''}
                                        </option>
                                    );
                                })}
                            </optgroup>
                        )}
                    </select>
                </div>

                {/* Form elements for New Client */}
                {mode === 'new' && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 animate-fadeIn">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                اسم العميل الجديد <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="اسم العميل الكامل"
                                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">
                                أرقام الهاتف (اختياري)
                            </label>
                            <div className="space-y-2">
                                {phoneNumbers.map((phone, index) => (
                                    <div key={index} className="flex gap-2">
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => updatePhoneNumber(index, e.target.value)}
                                                placeholder="رقم الهاتف"
                                                className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-slate-800 text-sm hover:border-slate-350"
                                            />
                                            {phoneNumbers.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoneNumber(index)}
                                                    className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200/50 transition-colors font-black text-sm cursor-pointer"
                                                    title="حذف رقم الهاتف"
                                                >
                                                    حذف
                                                </button>
                                            )}
                                            {index === phoneNumbers.length - 1 && (
                                                <button
                                                    type="button"
                                                    onClick={addPhoneNumber}
                                                    className="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-200/50 transition-colors font-black text-sm cursor-pointer"
                                                    title="إضافة رقم هاتف آخر"
                                                >
                                                    إضافة
                                                </button>
                                            )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={mode === 'select' ? !selectedClientId : !name.trim()}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm"
                    >
                        {mode === 'select' ? 'تحديد العميل' : 'حفظ وتسجيل'}
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 px-4 rounded-xl transition-all duration-200 cursor-pointer text-sm"
                    >
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};
