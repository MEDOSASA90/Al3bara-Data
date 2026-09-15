import * as pdfjsLib from 'pdfjs-dist';
import type {
  AuctionBrochureData,
  ParsedEntity,
  ParsedLot,
} from '../data/preloadedAuctions';
import {
  AUCTION_HALL_DEFAULT,
  AUCTION_INSURANCE_DEFAULT,
} from '../domain/constants';

if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (error) {
    console.warn('PDF.js worker initialization notice:', error);
  }
}

/** Extract all text content from a PDF file, page by page. */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item) => ('str' in item ? String(item.str) : ''))
        .join(' ');
      fullText += `\n--- PAGE ${pageNum} ---\n` + pageStrings;
    } catch (pageErr) {
      console.warn(`Error extracting page ${pageNum}:`, pageErr);
    }
  }

  return fullText;
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

/** Strip tatweel + diacritics (PDF extraction artifacts that break table/header matching). */
function cleanLine(line: string): string {
  return line.replace(/[\u0640]/g, '').replace(/[\u064B-\u065F\u0670]/g, '').trim();
}

/** Normalize Arabic for entity matching: unify hamza/ta-marbuta/alef-maksura, drop non-Arabic. */
function normalizeKey(name: string): string {
  return name
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FF0-9a-zA-Z]/g, '')
    .trim();
}

/** Dice coefficient on character bigrams (1 = identical). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let intersection = 0;
  for (const x of A) if (B.has(x)) intersection += 1;
  return (2 * intersection) / (A.size + B.size);
}

interface PageRecord {
  page: number;
  entityName: string;
  entityKey: string;
  lotLines: string[]; // lines after the table header
}

interface EntityAcc {
  entityName: string;
  entityKey: string;
  records: PageRecord[];
}

interface IndexEntry {
  name: string;
  startPage: number;
  expectedLots: number;
}

/**
 * Parse the فهرس (index) pages into (entity, startPage, expectedLots) entries.
 * The index lists entities as: <name> <startPage> <lotCount>.
 */
function parseIndexEntries(
  pages: { page: number; lines: string[] }[],
): IndexEntry[] {
  const indexPages = pages
    .filter((p) => p.page > 3 && p.lines.some((l) => /فهرس/.test(l)))
    .sort((a, b) => a.page - b.page);
  if (indexPages.length === 0) return [];

  const indexLines: string[] = [];
  for (const p of indexPages) {
    for (const rawLine of p.lines) {
      const line = rawLine;
      if (line === '' || /م البي|اللوطات|مزاد\s*\d/.test(line)) continue;
      if (/^\d{1,3}$/.test(line)) continue;
      indexLines.push(line);
    }
  }
  const joined = indexLines.join('\n');
  const pairRe = /(\d{1,3})\s+(\d{1,2})(?=[\s\n]|$)/g;
  const pairs: { page: number; lots: number; idx: number }[] = [];
  let m: RegExpExecArray | null;
  let lastPage = 0;
  while ((m = pairRe.exec(joined))) {
    const page = Number(m[1]);
    const lots = Number(m[2]);
    if (page >= 9 && page <= 200 && lots >= 1 && lots <= 30 && page >= lastPage) {
      pairs.push({ page, lots, idx: m.index });
      lastPage = page;
    }
  }
  if (pairs.length < 5) return [];

  const entries: IndexEntry[] = [];
  for (const [i, pr] of pairs.entries()) {
    const prev = i > 0 ? pairs[i - 1] : null;
    const prevEnd = prev
      ? prev.idx + String(prev.page).length + 1 + String(prev.lots).length
      : 0;
    let nameText = joined
      .slice(prevEnd, pr.idx)
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const si = nameText.indexOf('بضائع جهات حكومية');
    if (si >= 0) nameText = nameText.slice(si + 'بضائع جهات حكومية'.length).trim();
    entries.push({ name: nameText, startPage: pr.page, expectedLots: pr.lots });
  }
  return entries;
}

/** فهرس-driven: entity i owns pages [start_i .. start_{i+1} - 1]. Names from page headers. */
function segmentByIndex(
  entries: IndexEntry[],
  pageRecords: PageRecord[],
): EntityAcc[] {
  const accs: EntityAcc[] = [];
  for (const [i, entry] of entries.entries()) {
    const endPage =
      i + 1 < entries.length ? entries[i + 1].startPage - 1 : Number.MAX_SAFE_INTEGER;
    const segRecords = pageRecords.filter(
      (r) => r.page >= entry.startPage && r.page <= endPage,
    );
    if (segRecords.length === 0) continue;
    const best = segRecords.reduce(
      (acc, r) => (r.entityName.length > acc.entityName.length ? r : acc),
      segRecords[0],
    );
    accs.push({
      entityName: best.entityName,
      entityKey: best.entityKey,
      records: segRecords,
    });
  }
  return accs;
}

/** Fallback: merge consecutive pages of the same entity (OCR drift across page breaks). */
function segmentBySimilarity(pageRecords: PageRecord[]): EntityAcc[] {
  const accs: EntityAcc[] = [];
  for (const record of pageRecords) {
    const prev = accs[accs.length - 1];
    if (
      prev &&
      record.page - prev.records[prev.records.length - 1].page <= 2 &&
      similarity(prev.entityKey, record.entityKey) >= 0.8
    ) {
      if (record.entityName.length > prev.entityName.length) {
        prev.entityName = record.entityName;
        prev.entityKey = record.entityKey;
      }
      prev.records.push(record);
      continue;
    }
    accs.push({
      entityName: record.entityName,
      entityKey: record.entityKey,
      records: [record],
    });
  }
  return accs;
}

const SPEC_WORD_RE = /^(فولت|فول|امبير|أمبير|لتر|مكعب|واط|وات|سم\b|بوصة|حصان|A|فاز|×)/i;

/** Lines that continue a previous row (legal note / contact) — never a lot start. */
const NOISE_RE = /(لسنة|قانون|البيئة|للتواصل|التواصل)/;

/** The lot table header row (كل صفحة تفاصيل فيها: لوط الصنف الوحدة الكمية الحالة). */
function isTableHeader(line: string): boolean {
  return /الصنف/.test(line) && (/لو.?ط/.test(line) || /الوحدة|الكمية|الحالة/.test(line)) && line.length < 95;
}

/** Split page-marked text into {page, lines} records. */
function splitPages(rawText: string): { page: number; lines: string[] }[] {
  const markerRe = /--- PAGE (\d+)[^\n]*---/g;
  const records: { page: number; lines: string[] }[] = [];
  const matches = [...rawText.matchAll(markerRe)];
  for (let i = 0; i < matches.length; i += 1) {
    const page = Number(matches[i][1]);
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? rawText.length) : rawText.length;
    const lines = rawText
      .slice(start, end)
      .split('\n')
      .map(cleanLine)
      .filter((l) => l !== '');
    records.push({ page, lines });
  }
  return records;
}

/**
 * Extract the entity header + lot rows from ONE detail page.
 * Every detail page: [page#] [date] [entity header] [table header] [lot rows...].
 */
function readPage(record: { page: number; lines: string[] }): PageRecord | null {
  const { page, lines } = record;
  if (lines.length < 3) return null;
  /* Index pages (فهرس / تابع فهرس) list entity names + lot counts — not lot tables. */
  if (/فهرس/.test(lines.join(' '))) return null;
  const dateIdx = lines.findIndex((l) => /مزاد/.test(l));
  if (dateIdx < 0) return null;
  const tableIdx = lines.findIndex(isTableHeader);
  const stopIdx = tableIdx > dateIdx ? tableIdx : Math.min(dateIdx + 2, lines.length);
  const headerParts = lines.slice(dateIdx + 1, stopIdx).filter((l) => !/^\d{1,3}$/.test(l));
  const entityName = headerParts.join(' ').replace(/\s+/g, ' ').trim();
  if (entityName === '' || normalizeKey(entityName) === 'بضائع') return null;
  const lotLines = tableIdx > dateIdx ? lines.slice(tableIdx + 1) : lines.slice(stopIdx);
  return { page, entityName, entityKey: normalizeKey(entityName), lotLines };
}

/**
 * Parser for الهيئة العامة للخدمات الحكومية auction brochures.
 * Index-driven (الفهرس = مرجع تقسيم الجهات — user-verified counts):
 * 1. Parse the فهرس pages: entries = (entity name, startPage, expectedLots).
 * 2. Segment detail pages: entity i owns pages [start_i .. start_{i+1} - 1].
 *    Entity names come from the page headers (richer than the index text).
 * 3. Main lots: rows starting with a plausible sequential number; other rows are
 *    sub-rows of the last main lot (spec lines, notes, quantities).
 * Fallback: no usable فهرس → merge consecutive pages by name similarity (>= 0.8).
 */
export function parseBrochureText(
  rawText: string,
  defaultDate?: string,
): AuctionBrochureData {
  let auctionDate =
    defaultDate ?? new Date().toISOString().split('T')[0] ?? '';

  const dateMatchYMD = rawText.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  const dateMatchDMY = rawText.match(
    /(?:مزاد|جلسة)\s*(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})/,
  );

  if (dateMatchDMY?.[1] && dateMatchDMY[2] && dateMatchDMY[3]) {
    auctionDate = `${dateMatchDMY[3]}-${pad2(dateMatchDMY[2])}-${pad2(dateMatchDMY[1])}`;
  } else if (dateMatchYMD?.[1] && dateMatchYMD[2] && dateMatchYMD[3]) {
    auctionDate = `${dateMatchYMD[1]}-${pad2(dateMatchYMD[2])}-${pad2(dateMatchYMD[3])}`;
  }

  const pages = splitPages(rawText);
  const pageRecords: PageRecord[] = [];
  for (const record of pages) {
    if (record.page <= 3) continue; // cover pages
    const read = readPage(record);
    if (read) pageRecords.push(read);
  }

  // ── Pass 1: فهرس-driven segmentation (ground truth for entity boundaries) ──
  const indexEntries = parseIndexEntries(pages);
  let accs: EntityAcc[] = [];
  if (indexEntries.length >= 5) {
    accs = segmentByIndex(indexEntries, pageRecords);
  }
  // ── Fallback: no usable فهرس → similarity merge ──
  if (accs.length === 0) {
    accs = segmentBySimilarity(pageRecords);
  }

  const stamp = Date.now();
  const entities: ParsedEntity[] = accs.map((acc, entityIndex) => {
    const lots: ParsedLot[] = [];
    let lastNum = 0;
    let subRows: string[] = [];
    const flushSubs = (): void => {
      if (lots.length > 0 && subRows.length > 0) {
        const prev = lots[lots.length - 1];
        prev.notes = [prev.notes ?? '', ...subRows].join(' ').slice(0, 400) || prev.notes;
      }
      subRows = [];
    };
    for (const record of acc.records) {
      for (const line of record.lotLines) {
        const match = line.match(/^(\d{1,3})\s+(\S.*)/);
        if (match) {
          const text = match[2];
          const num = Number(match[1]);
          if (!NOISE_RE.test(text) && num <= 99 && !SPEC_WORD_RE.test(text)) {
            const plausible =
              lastNum === 0
                ? true
                : num === lastNum + 1 || (num > lastNum && num <= lastNum + 5);
            if (plausible) {
              flushSubs();
              lastNum = num;
              const qtyMatch = text.match(/بالعدد\s*(\d[\d.,ر]*)|عدد\s*(\d[\d.,ر]*)|([\d.,ر]+)\s*(?:طن|كيلو|كجم)/);
              const conditionMatch = text.match(/خردة|كهنة|كسر|راكد جديد|راكد|مستعمل|جديد/);
              lots.push({
                lotNumber: String(num),
                name: text.slice(0, 200),
                quantity: qtyMatch ? `${qtyMatch[1] ?? qtyMatch[2] ?? qtyMatch[3] ?? ''}`.trim() || 'حسب الكشف' : 'حسب الكشف',
                unit: /طن/.test(text) ? 'طن' : /كيلو|كجم/.test(text) ? 'كيلو' : 'عدد',
                condition: conditionMatch ? conditionMatch[0] : '',
              });
              continue;
            }
          }
        }
        subRows.push(line);
      }
    }
    flushSubs();
    return {
      id: `parsed-entity-${entityIndex + 1}-${stamp}`,
      entityName: acc.entityName,
      lots,
    };
  });

  if (entities.length === 0) {
    entities.push({
      id: `entity-general-${stamp}`,
      entityName: 'بضائع جهات حكومية - مزاد الهيئة العامة للخدمات الحكومية',
      lots: [
        {
          lotNumber: '1',
          name: 'لوط أصناف ومهمات متنوعة حسب الكراسة',
          quantity: '1 لوط',
          unit: 'لوط',
          condition: 'حسب المعاينة',
        },
      ],
    });
  }

  return {
    id: `auction-${auctionDate}-${stamp}`,
    auctionDate,
    title: `جلسة مزاد بضائع جهات حكومية بتاريخ ${auctionDate}`,
    hallLocation: AUCTION_HALL_DEFAULT,
    insuranceAmount: AUCTION_INSURANCE_DEFAULT,
    entities,
  };
}
