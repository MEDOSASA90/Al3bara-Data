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

/**
 * Parser for Egyptian General Authority for Government Services
 * (الهيئة العامة للخدمات الحكومية) auction brochures:
 * extracts the session date, entity headers, and lot rows
 * (lot number, description, quantity/unit, condition).
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

  const entities: ParsedEntity[] = [];
  const lines = rawText.split('\n');
  let currentEntity: ParsedEntity | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isEntityHeader =
      /^(محافظة|مديرية|إدارة|ادارة|مستشفى|مستشفي|الهيئة|وزارة|مجلس ومدينة|مجلس مدينة|رئاسة|مركز|البنك الزراعي|جامعة|قطاع|مصلحة|صندوق|الاتحاد|المجلس|الوحدة المحلية)/i.test(
        line,
      );

    if (
      isEntityHeader &&
      line.length > 8 &&
      line.length < 160 &&
      !line.includes('قانون') &&
      !line.includes('الرسوم')
    ) {
      if (currentEntity && currentEntity.lots.length > 0) {
        entities.push(currentEntity);
      }
      currentEntity = {
        id: `parsed-entity-${entities.length + 1}-${Date.now()}`,
        entityName: line,
        lots: [],
      };
      continue;
    }

    const lotMatch =
      line.match(/(?:لوط|اللوط)\s*[:-]?\s*(\d+)/i) ??
      line.match(/^(\d+)\s+(.+?)(?:عدد|طن|كيلو|كجم|متر)/);
    const looksLikeLot =
      lotMatch !== null ||
      line.includes('خردة') ||
      line.includes('كهنة') ||
      line.includes('كسر') ||
      line.includes('راكد');

    if (currentEntity && looksLikeLot) {
      const lotNum =
        lotMatch?.[1] != null && lotMatch[1] !== ''
          ? lotMatch[1]
          : `${currentEntity.lots.length + 1}`;

      let unit = 'عدد';
      if (line.includes('طن')) unit = 'طن';
      else if (line.includes('كيلو') || line.includes('كجم')) unit = 'كيلو';
      else if (line.includes('متر')) unit = 'متر';

      const qtyMatch = line.match(/([\d.,]+)\s*(طن|كيلو|كجم|عدد|متر|طقم)/);
      const quantity =
        qtyMatch?.[1] && qtyMatch[2]
          ? `${qtyMatch[1]} ${qtyMatch[2]}`
          : 'حسب الكشف';

      let condition = 'خردة';
      if (line.includes('كهنة')) condition = 'كهنة';
      else if (line.includes('كسر')) condition = 'كسر';
      else if (line.includes('جديد')) condition = 'راكد جديد';
      else if (line.includes('مستعمل')) condition = 'مستعمل';

      const lotDesc = line
        .replace(/^--- PAGE \d+ ---/g, '')
        .replace(/(?:لوط|اللوط)\s*[:-]?\s*\d+/g, '')
        .replace(/monaksat.*$/gi, '')
        .trim();

      if (lotDesc.length > 3) {
        const lot: ParsedLot = {
          lotNumber: lotNum,
          name: lotDesc.slice(0, 180),
          quantity,
          unit,
          condition,
        };
        currentEntity.lots.push(lot);
      }
    }
  }

  if (currentEntity && currentEntity.lots.length > 0) {
    entities.push(currentEntity);
  }

  if (entities.length === 0) {
    entities.push({
      id: `entity-general-${Date.now()}`,
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
    id: `auction-${auctionDate}-${Date.now()}`,
    auctionDate,
    title: `جلسة مزاد بضائع جهات حكومية بتاريخ ${auctionDate}`,
    hallLocation: AUCTION_HALL_DEFAULT,
    insuranceAmount: AUCTION_INSURANCE_DEFAULT,
    entities,
  };
}
