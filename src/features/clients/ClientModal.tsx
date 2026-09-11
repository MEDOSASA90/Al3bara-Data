import { useState, type ReactNode } from 'react';
import type { Client } from '../../domain/types';
import { Modal } from '../../components/ui/Modal';

export interface ClientModalProps {
  isOpen: boolean;
  clientTypeLabel: string;
  existingClients: Client[];
  onClose: () => void;
  onSave: (name: string, phone?: string) => void;
}

function phoneText(client: Client): string {
  if (!client.phone) return '';
  return Array.isArray(client.phone) ? client.phone.join(', ') : client.phone;
}

function matchesQuery(client: Client, query: string): boolean {
  const q = query.toLowerCase();
  if (client.name.toLowerCase().includes(q)) return true;
  const phone = client.phone;
  if (typeof phone === 'string') return phone.toLowerCase().includes(q);
  if (Array.isArray(phone)) return phone.some((p: string) => p.toLowerCase().includes(q));
  return false;
}

export function ClientModal(props: ClientModalProps): ReactNode {
  const { isOpen, clientTypeLabel, existingClients, onClose, onSave } = props;
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [name, setName] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredClients = (existingClients ?? []).filter((client) =>
    searchQuery.trim() === '' ? true : matchesQuery(client, searchQuery),
  );

  function handleClose(): void {
    setName('');
    setPhoneNumbers(['']);
    setSearchQuery('');
    setSelectedClientId('');
    setShowSuggestions(false);
    setMode('select');
    onClose();
  }

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    setShowSuggestions(value !== '' && mode === 'select');
  }

  function handleSuggestionClick(client: Client): void {
    setSelectedClientId(client.id);
    setSearchQuery(client.name);
    setMode('select');
    setShowSuggestions(false);
  }

  function handleClientSelection(value: string): void {
    if (value === 'new') {
      setMode('new');
      setSelectedClientId('');
    } else {
      setMode('select');
      setSelectedClientId(value);
      setShowSuggestions(false);
    }
  }

  function updatePhoneNumber(index: number, value: string): void {
    setPhoneNumbers((prev) => prev.map((phone, i) => (i === index ? value : phone)));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (mode === 'select' && selectedClientId !== '') {
      const client = (existingClients ?? []).find((c) => c.id === selectedClientId);
      if (client) onSave(client.name, phoneText(client));
    } else if (mode === 'new' && name.trim() !== '') {
      const validPhones = phoneNumbers.map((p) => p.trim()).filter((p) => p !== '');
      onSave(name.trim(), validPhones.length > 0 ? validPhones.join(', ') : '');
    }
    handleClose();
  }

  const canSubmit = mode === 'select' ? selectedClientId !== '' : name.trim() !== '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`إضافة/اختيار عميل ${clientTypeLabel}`}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div className="relative">
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            البحث السريع عن عميل
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="🔍 ابحث عن عميل بالاسم أو الهاتف..."
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {showSuggestions && searchQuery !== '' && filteredClients.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {filteredClients.slice(0, 5).map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleSuggestionClick(client)}
                  className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                >
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{client.name}</p>
                    {phoneText(client) !== '' && (
                      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{phoneText(client)}</p>
                    )}
                  </div>
                  {client.isArchived === true && (
                    <span className="rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-0.5 text-[9px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      مؤرشف
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
            اختيار من القائمة
          </label>
          <select
            value={mode === 'new' ? 'new' : selectedClientId}
            onChange={(e) => handleClientSelection(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">-- اختر عميل --</option>
            <option value="new" className="font-extrabold text-indigo-600">
              ➕ إضافة عميل جديد
            </option>
            {filteredClients.length > 0 && (
              <optgroup label="العملاء المتوفرين">
                {filteredClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {phoneText(client) !== '' ? ` (${phoneText(client)})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {mode === 'new' && (
          <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
                اسم العميل الجديد <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العميل الكامل"
                required
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400">
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
                      className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none transition-all duration-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    {phoneNumbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPhoneNumbers((prev) => prev.filter((_, i) => i !== index))}
                        title="حذف رقم الهاتف"
                        className="cursor-pointer rounded-xl border border-rose-200/50 bg-rose-50 px-3 text-sm font-black text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                      >
                        حذف
                      </button>
                    )}
                    {index === phoneNumbers.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setPhoneNumbers((prev) => [...prev, ''])}
                        title="إضافة رقم هاتف آخر"
                        className="cursor-pointer rounded-xl border border-indigo-200/50 bg-indigo-50 px-3 text-sm font-black text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
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

        <div className="flex flex-wrap gap-3 pt-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
          >
            {mode === 'select' ? 'تحديد العميل' : 'حفظ وتسجيل'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-all duration-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
