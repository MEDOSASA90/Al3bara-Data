import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableDropdownItem {
  id: string;
  label: string;
  sub?: string;
  keywords?: string;
}

interface SearchableDropdownProps {
  items: SearchableDropdownItem[];
  valueId: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
}

/** Arabic-smart normalization: أإآ→ا, ة→ه, ى→ي, strip tashkeel/tatweel. */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normalized form plus map from normalized index -> original index (for highlighting). */
function normalizeWithMap(input: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (/[\u064B-\u0652\u0670\u0640]/.test(ch)) continue;
    let out = ch;
    if (/[أإآٱ]/.test(ch)) out = 'ا';
    else if (ch === 'ة') out = 'ه';
    else if (ch === 'ى') out = 'ي';
    else out = ch.toLowerCase();
    if (out === ' ' && norm.endsWith(' ')) continue;
    norm += out;
    map.push(i);
  }
  return { norm: norm.trimEnd(), map };
}

interface RankedItem {
  item: SearchableDropdownItem;
  score: number;
  index: number;
}

function rankItems(items: SearchableDropdownItem[], query: string): RankedItem[] {
  const normQuery = normalizeArabic(query);
  if (normQuery === '') {
    return items.map((item, index) => ({ item, score: 50 + index * 0.001, index }));
  }
  const terms = normQuery.split(' ').filter(Boolean);
  const out: RankedItem[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item) continue;
    const normLabel = normalizeArabic(item.label);
    const normSub = normalizeArabic(item.sub ?? '');
    const normKeys = normalizeArabic(item.keywords ?? '');
    const haystack = `${normLabel} ${normSub} ${normKeys}`;
    const matchesAll = terms.every((t) => haystack.includes(t));
    if (!matchesAll) continue;
    let score: number;
    if (normLabel === normQuery) score = 0;
    else if (normLabel.startsWith(normQuery)) score = 1;
    else if (terms.every((t) => normLabel.includes(t))) score = 2;
    else score = 10;
    // Prefer label matches over sub/keywords-only matches.
    if (!terms.every((t) => normLabel.includes(t))) score += 5;
    out.push({ item, score: score + index * 0.001, index });
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}

/** Split a label into highlighted / plain parts for the given raw query terms. */
function highlightParts(
  label: string,
  rawTerms: string[],
): { text: string; highlight: boolean }[] {
  const terms = rawTerms.map((t) => normalizeArabic(t)).filter(Boolean);
  if (terms.length === 0 || label === '') return [{ text: label, highlight: false }];
  const { norm, map } = normalizeWithMap(label);
  const marked = new Array<boolean>(norm.length).fill(false);
  for (const term of terms) {
    let from = 0;
    while (from <= norm.length - term.length) {
      const hit = norm.indexOf(term, from);
      if (hit === -1) break;
      for (let k = hit; k < hit + term.length; k++) marked[k] = true;
      from = hit + Math.max(1, term.length);
    }
  }
  const origMarked = new Array<boolean>(label.length).fill(false);
  for (let k = 0; k < marked.length; k++) {
    if (marked[k]) {
      const oi = map[k];
      if (oi !== undefined) origMarked[oi] = true;
    }
  }
  const parts: { text: string; highlight: boolean }[] = [];
  let cur = '';
  let curHl = origMarked[0] ?? false;
  for (let i = 0; i < label.length; i++) {
    const hl = origMarked[i] ?? false;
    if (i === 0) curHl = hl;
    if (hl !== curHl) {
      parts.push({ text: cur, highlight: curHl });
      cur = '';
      curHl = hl;
    }
    cur += label[i];
  }
  if (cur !== '') parts.push({ text: cur, highlight: curHl });
  return parts;
}

export function SearchableDropdown({
  items,
  valueId,
  onChange,
  placeholder = '🔍 ابحث...',
  emptyText = 'لا توجد نتائج مطابقة',
}: SearchableDropdownProps): React.JSX.Element {
  const selected = items.find((i) => i.id === valueId) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Mirror the selected label when closed / selection changes externally.
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '');
  }, [open, selected?.label]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent): void {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open ]);

  const ranked = useMemo(() => rankItems(items, query), [items, query]);
  const terms = useMemo(() => query.split(' ').filter(Boolean), [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function choose(id: string): void {
    onChange(id);
    setOpen(false);
  }

  const showAll = normalizeArabic(query) === '' || query === (selected?.label ?? '');

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? query)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Start a fresh search when focusing a previously-selected value.
          if (selected && query === selected.label) setQuery('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActiveIndex((i) => Math.min(i + 1, Math.max(0, ranked.length - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            const hit = ranked[activeIndex];
            if (open && hit) {
              e.preventDefault();
              choose(hit.item.id);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {ranked.length} نتيجة{showAll ? ' — كل الجهات' : ''}
          </div>
          {ranked.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {emptyText}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              className="max-h-72 w-full overflow-y-auto overscroll-contain"
            >
              {ranked.map(({ item }, i) => {
                const isSelected = item.id === valueId;
                const isActive = i === activeIndex;
                return (
                  <li key={item.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => choose(item.id)}
                      className={`flex min-h-[44px] w-full items-start justify-between gap-2 px-3 py-2.5 text-right text-xs transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 font-bold text-white'
                          : isActive
                            ? 'bg-indigo-50 text-slate-900 dark:bg-indigo-950/50 dark:text-white'
                            : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold break-words">
                          {highlightParts(item.label, terms).map((p, pi) =>
                            p.highlight ? (
                              <mark
                                key={pi}
                                className={
                                  isSelected
                                    ? 'rounded bg-amber-300 px-0.5 text-slate-950'
                                    : 'rounded bg-amber-200 px-0.5 text-slate-950 dark:bg-amber-400/70'
                                }
                              >
                                {p.text}
                              </mark>
                            ) : (
                              <span key={pi}>{p.text}</span>
                            ),
                          )}
                        </span>
                        {item.sub ? (
                          <span
                            className={`mt-0.5 block truncate text-[10px] ${
                              isSelected
                                ? 'text-indigo-100'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                            title={item.sub}
                          >
                            {item.sub}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span aria-hidden="true" className="shrink-0 font-black">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
