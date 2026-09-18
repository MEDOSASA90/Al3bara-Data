/**
 * Analyzed brochures service — يقرأ نتايج تحليل الكراسات الجاهزة من الـ VPS
 * (التحليل بيحصل في n8n/الموبايل — التطبيق بيقرأ النتيجة النهائية فقط).
 */

const RESULTS_BASE = import.meta.env.VITE_GCS_RESULTS_URL ?? 'http://143.246.43.27:8788';

export interface AnalyzedBrochureSummary {
  file: string;
  auctionDate: string;
  title: string;
  entitiesCount: number;
  lotsCount: number;
  sourcePdf: string;
  analyzedAt: string;
}

export interface AnalyzedLot {
  lotNumber: string;
  name: string;
  quantity: string;
  unit?: string;
  condition?: string;
}

export interface AnalyzedEntity {
  entityName: string;
  location?: string;
  lots: AnalyzedLot[];
}

export interface AnalyzedBrochure {
  auctionDate: string;
  title: string;
  entities: AnalyzedEntity[];
  sourcePdf?: string;
  analyzedAt?: string;
  chunks?: number;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('صيغة النتيجة غير متوقعة');
  }
  return value as Record<string, unknown>;
}

function asText(record: Record<string, unknown>, key: string, fallback = ''): string {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

/** Fetch the list of analyzed brochures available on the VPS. */
export async function listAnalyzedBrochures(): Promise<AnalyzedBrochureSummary[]> {
  const response = await fetch(`${RESULTS_BASE}/list`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`تعذر جلب قايمة التحليلات (${response.status})`);
  }
  const data: unknown = await response.json();
  const record = requireRecord(data);
  const items = record['items'];
  if (!Array.isArray(items)) return [];
  return items
    .map((raw): AnalyzedBrochureSummary | null => {
      if (typeof raw !== 'object' || raw === null) return null;
      const item = raw as Record<string, unknown>;
      return {
        file: asText(item, 'file'),
        auctionDate: asText(item, 'auctionDate'),
        title: asText(item, 'title'),
        entitiesCount: typeof item['entitiesCount'] === 'number' ? item['entitiesCount'] : 0,
        lotsCount: typeof item['lotsCount'] === 'number' ? item['lotsCount'] : 0,
        sourcePdf: asText(item, 'sourcePdf'),
        analyzedAt: asText(item, 'analyzedAt'),
      };
    })
    .filter((item): item is AnalyzedBrochureSummary => item !== null && item.file !== '');
}

/** Fetch one analyzed brochure result by file name. */
export async function fetchAnalyzedBrochure(fileName: string): Promise<AnalyzedBrochure> {
  const response = await fetch(`${RESULTS_BASE}/file/${encodeURIComponent(fileName)}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`تعذر جلب نتيجة التحليل (${response.status})`);
  }
  const data: unknown = await response.json();
  const record = requireRecord(data);
  const rawEntities = record['entities'];
  const entities: AnalyzedEntity[] = Array.isArray(rawEntities)
    ? rawEntities
        .map((raw): AnalyzedEntity | null => {
          if (typeof raw !== 'object' || raw === null) return null;
          const entity = raw as Record<string, unknown>;
          const entityName = asText(entity, 'entityName');
          if (entityName.trim() === '') return null;
          const rawLots = entity['lots'];
          const lots: AnalyzedLot[] = Array.isArray(rawLots)
            ? rawLots
                .map((rawLot): AnalyzedLot | null => {
                  if (typeof rawLot !== 'object' || rawLot === null) return null;
                  const lot = rawLot as Record<string, unknown>;
                  const name = asText(lot, 'name');
                  if (name.trim() === '') return null;
                  const lotResult: AnalyzedLot = {
                    lotNumber: asText(lot, 'lotNumber', '1'),
                    name,
                    quantity: asText(lot, 'quantity'),
                  };
                  const unit = asText(lot, 'unit');
                  const condition = asText(lot, 'condition');
                  if (unit !== '') lotResult.unit = unit;
                  if (condition !== '') lotResult.condition = condition;
                  return lotResult;
                })
                .filter((lot): lot is AnalyzedLot => lot !== null)
            : [];
          const location = asText(entity, 'location');
          const result: AnalyzedEntity = { entityName, lots };
          if (location !== '') result.location = location;
          return result;
        })
        .filter((entity): entity is AnalyzedEntity => entity !== null)
    : [];

  const analyzed: AnalyzedBrochure = {
    auctionDate: asText(record, 'auctionDate'),
    title: asText(record, 'title'),
    entities,
  };
  const sourcePdf = asText(record, 'sourcePdf') || asText(record, 'source_pdf');
  if (sourcePdf !== '') analyzed.sourcePdf = sourcePdf;
  const analyzedAt = asText(record, 'analyzedAt') || asText(record, 'analyzed_at');
  if (analyzedAt !== '') analyzed.analyzedAt = analyzedAt;
  if (typeof record['chunks'] === 'number') analyzed.chunks = record['chunks'];
  return analyzed;
}

/**
 * رفع كراسة خارجية (شركة خارجية) — يبعتها لـ n8n يحللها والنتيجة ترجع لصاحبها بس.
 * التطبيق يبعت الـ PDF على VPS endpoint → تتكتب في pending/ → worker يحللها.
 */
export async function uploadExternalBrochure(file: File): Promise<{ ok: boolean; fileName: string }> {
  const uploadBase = import.meta.env.VITE_GCS_RESULTS_URL as string;
  if (!uploadBase) throw new Error('مشكلة إعداد: رابط الرفع مش موجود');
  const safeName = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, '_');
  const response = await fetch(`${uploadBase}/upload/${encodeURIComponent(safeName)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`فشل رفع الكراسة (${response.status})`);
  }
  const data = (await response.json()) as { ok?: boolean; file?: string };
  return { ok: data.ok === true, fileName: data.file ?? safeName };
}
