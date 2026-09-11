import * as pdfjsLib from 'pdfjs-dist';
import { AuctionBrochureData, ParsedEntity, ParsedLot } from './preloadedAuctions';

// Configure pdfjs worker if in browser
if (typeof window !== 'undefined' && 'Worker' in window) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
    } catch (e) {
        console.warn('PDF.js worker initialization notice:', e);
    }
}

/**
 * Extract all text content from a PDF file
 */
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
                .map((item: any) => item.str || '')
                .join(' ');
            fullText += `\n--- PAGE ${pageNum} ---\n` + pageStrings;
        } catch (pageErr) {
            console.warn(`Error extracting page ${pageNum}:`, pageErr);
        }
    }

    return fullText;
}

/**
 * Intelligent parser for Egyptian General Authority for Government Services (الهيئة العامة للخدمات الحكومية)
 * extracts session date, entities, lots, quantities, and condition.
 */
export function parseBrochureText(rawText: string, defaultDate?: string): AuctionBrochureData {
    // 1. Find auction date
    let auctionDate = defaultDate || new Date().toISOString().split('T')[0];
    
    // Check for patterns like جلسة مزاد 16 / 9 / 2026 or 2026/09/16 or 16/9/2026
    const dateMatch1 = rawText.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const dateMatch2 = rawText.match(/(?:مزاد|جلسة)\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/);

    if (dateMatch2) {
        const day = dateMatch2[1].padStart(2, '0');
        const month = dateMatch2[2].padStart(2, '0');
        const year = dateMatch2[3];
        auctionDate = `${year}-${month}-${day}`;
    } else if (dateMatch1) {
        const year = dateMatch1[1];
        const month = dateMatch1[2].padStart(2, '0');
        const day = dateMatch1[3].padStart(2, '0');
        auctionDate = `${year}-${month}-${day}`;
    }

    // 2. Extract Entities and Lots
    const entities: ParsedEntity[] = [];
    const lines = rawText.split('\n');
    let currentEntity: ParsedEntity | null = null;
    let lotCounter = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check if line indicates a government department / entity header
        const isEntityHeader = /^(محافظة|مديرية|إدارة|ادارة|مستشفى|مستشفي|الهيئة|اهليئة|وزارة|مجلس ومدينة|مجلس مدينة|رئاسة|مركز|البنك الزراعي|جامعة|قطاع|مصلحة|صندوق|الاتحاد|المجلس|الوحدة المحلية)/i.test(line);

        if (isEntityHeader && line.length > 8 && line.length < 160 && !line.includes('قانون') && !line.includes('الرسوم')) {
            if (currentEntity && currentEntity.lots.length > 0) {
                entities.push(currentEntity);
            }
            currentEntity = {
                id: `parsed-entity-${entities.length + 1}-${Date.now()}`,
                entityName: line,
                lots: []
            };
            continue;
        }

        // Check for lot row
        const lotMatch = line.match(/(?:لوط|اللوط)\s*[:\-\s]?\s*(\d+)/i) || line.match(/^(\d+)\s+(.+?)(?:عدد|طن|كيلو|كجم|متر)/);
        if (currentEntity && (lotMatch || line.includes('خردة') || line.includes('كهنة') || line.includes('كسر') || line.includes('راكد'))) {
            let lotNum = (lotMatch && lotMatch[1]) ? lotMatch[1] : `${currentEntity.lots.length + 1}`;
            
            // Extract quantity & unit
            let unit = 'عدد';
            if (line.includes('طن')) unit = 'طن';
            else if (line.includes('كيلو') || line.includes('كجم')) unit = 'كيلو';
            else if (line.includes('متر')) unit = 'متر';

            const qtyMatch = line.match(/([\d.,]+)\s*(طن|كيلو|كجم|عدد|متر|طقم)/);
            const quantity = qtyMatch ? `${qtyMatch[1]} ${qtyMatch[2]}` : 'حسب الكشف';

            // Condition
            let condition = 'خردة';
            if (line.includes('كهنة')) condition = 'كهنة';
            else if (line.includes('كسر')) condition = 'كسر';
            else if (line.includes('جديد')) condition = 'راكد جديد';
            else if (line.includes('مستعمل')) condition = 'مستعمل';

            // Cleanup lot description
            let lotDesc = line
                .replace(/^--- PAGE \d+ ---/g, '')
                .replace(/(?:لوط|اللوط)\s*[:\-\s]?\s*\d+/g, '')
                .replace(/monaksat.*$/gi, '')
                .trim();

            if (lotDesc.length > 3) {
                currentEntity.lots.push({
                    lotNumber: lotNum,
                    name: lotDesc.slice(0, 180),
                    quantity,
                    unit,
                    condition
                });
            }
        }
    }

    if (currentEntity && currentEntity.lots.length > 0) {
        entities.push(currentEntity);
    }

    // Fallback if parsing didn't structure everything: create at least one entity
    if (entities.length === 0) {
        entities.push({
            id: `entity-general-${Date.now()}`,
            entityName: "بضائع جهات حكومية - مزاد الهيئة العامة للخدمات الحكومية",
            lots: [
                { lotNumber: "1", name: "لوط أصناف ومهمات متنوعة حسب الكراسة", quantity: "1 لوط", unit: "لوط", condition: "حسب المعاينة" }
            ]
        });
    }

    return {
        id: `auction-${auctionDate}-${Date.now()}`,
        auctionDate,
        title: `جلسة مزاد بضائع جهات حكومية بتاريخ ${auctionDate}`,
        hallLocation: "قاعة نادي الحضارات الرياضي - شارع صلاح سالم أمام مرور عين الصيرة",
        insuranceAmount: 50000,
        entities
    };
}
