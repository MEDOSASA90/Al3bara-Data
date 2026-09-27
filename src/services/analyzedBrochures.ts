/**
 * analyzedBrochures service — عميل نظام الكراسات المستقل (على VPS)
 * النظام المستقل (gcs-results :8788) بيقيم التحليل كله بـ Gemini — التطبيق عميل يقرأ النتايج بس.
 * - GET  /list      → قايمة الكراسات المحللة
 * - GET  /file/<f>  → نتيجة كراسة واحدة (JSON: lots + entities)
 * - GET  /pdf/<f>   → ملف الكراسة الأصلي (كراسة الشروط PDF/DOCX)
 * - POST /upload/<f> → رفع كراسة PDF من الموبايل للتحليل (X-Write-Key)
 * الربط عبر vercel.json rewrite: /gcs/:path* → VPS (مفيش mixed content ولا CORS).
 */

const RESULTS_BASE: string = import.meta.env.VITE_GCS_RESULTS_URL ?? '/gcs';

export interface AnalyzedBrochureSummary {
  file: string;
  auctionDate: string;
  title: string;
  entityName: string;
  entitiesCount: number;
  lotsCount: number;
  sourcePdf: string;
  analyzedAt: string;
  source: string;
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
  file?: string;
  auctionDate: string;
  title: string;
  entityName?: string;
  location?: string;
  notes?: string;
  documentsRequired?: string[];
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

/** قايمة الكراسات المحللة — ownerUid اختياري: الكراسات الخاصة بصاحبها تظهر ليه هو بس. */
export async function listAnalyzedBrochures(ownerUid?: string): Promise<AnalyzedBrochureSummary[]> {
  const url = ownerUid ? `${RESULTS_BASE}/list?owner=${encodeURIComponent(ownerUid)}` : `${RESULTS_BASE}/list`;
  const response = await fetch(url, { method: 'GET' });
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
        entityName: asText(item, 'entityName'),
        entitiesCount: typeof item['entitiesCount'] === 'number' ? item['entitiesCount'] : 0,
        lotsCount: typeof item['lotsCount'] === 'number' ? item['lotsCount'] : 0,
        sourcePdf: asText(item, 'sourcePdf'),
        analyzedAt: asText(item, 'analyzedAt'),
        source: asText(item, 'source', 'gcs'),
      };
    })
    .filter((item): item is AnalyzedBrochureSummary => item !== null && item.file !== '');
}

/** نتيجة تحليل كراسة واحدة (لوطات + جهات) — fileName هو اسم الملف المطلوب (النتيجة مش بترجعه دايمًا). */
export async function fetchAnalyzedBrochure(fileName: string): Promise<AnalyzedBrochure> {
  const response = await fetch(`${RESULTS_BASE}/file/${encodeURIComponent(fileName)}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`تعذر جلب نتيجة التحليل (${response.status})`);
  }
  const data: unknown = await response.json();
  const record = requireRecord(data);

  /* صيغة v3 القديمة: entities[] جوه بعض. */
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
                  const name = asText(lot, 'name') || asText(lot, 'description');
                  if (name.trim() === '') return null;
                  const lotResult: AnalyzedLot = {
                    lotNumber: asText(lot, 'lotNumber', '1'),
                    name,
                    quantity: asText(lot, 'quantity') || asText(lot, 'qty') || 'حسب الكشف',
                  };
                  const unit = asText(lot, 'unit');
                  const condition = asText(lot, 'condition') || asText(lot, 'conditions');
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

  /* صيغة worker الجديدة: lots flat جذر + entityName جذر (كراسة واحدة). */
  if (entities.length === 0) {
    const rawLots = record['lots'];
    const flatLots: AnalyzedLot[] = Array.isArray(rawLots)
      ? rawLots
          .map((rawLot): AnalyzedLot | null => {
            if (typeof rawLot !== 'object' || rawLot === null) return null;
            const lot = rawLot as Record<string, unknown>;
            const name = asText(lot, 'name') || asText(lot, 'description');
            if (name.trim() === '') return null;
            const lotResult: AnalyzedLot = {
              lotNumber: asText(lot, 'lotNumber', '1'),
              name,
              quantity: asText(lot, 'quantity') || 'حسب الكشف',
            };
            const unit = asText(lot, 'unit');
            const condition = asText(lot, 'condition') || asText(lot, 'conditions');
            if (unit !== '') lotResult.unit = unit;
            if (condition !== '') lotResult.condition = condition;
            return lotResult;
          })
          .filter((lot): lot is AnalyzedLot => lot !== null)
      : [];
    const rootEntityName = asText(record, 'entityName');
    if (flatLots.length > 0 || rootEntityName.trim() !== '') {
      const location = asText(record, 'location');
      const entity: AnalyzedEntity = { entityName: rootEntityName || 'بضائع كراسة المزاد', lots: flatLots };
      if (location !== '') entity.location = location;
      entities.push(entity);
    }
  }

  const analyzed: AnalyzedBrochure = {
    file: fileName,
    auctionDate: asText(record, 'auctionDate'),
    title: asText(record, 'title') || (asText(record, 'entityName') !== '' ? `كراسة ${asText(record, 'entityName')}` : 'كراسة محللة (ن8ن)'),
    entities,
  };
  const entityName = asText(record, 'entityName');
  if (entityName !== '') analyzed.entityName = entityName;
  const location = asText(record, 'location');
  if (location !== '') analyzed.location = location;
  const notes = asText(record, 'notes');
  if (notes !== '') analyzed.notes = notes;
  const rawDocs = record['documentsRequired'];
  if (Array.isArray(rawDocs)) {
    const docs = rawDocs.filter((d): d is string => typeof d === 'string' && d.trim() !== '');
    if (docs.length > 0) analyzed.documentsRequired = docs;
  }
  const sourcePdf = asText(record, 'sourcePdf') || asText(record, 'source_pdf') || asText(record, 'booklet');
  if (sourcePdf !== '') analyzed.sourcePdf = sourcePdf;
  const analyzedAt = asText(record, 'analyzedAt') || asText(record, 'analyzed_at');
  if (analyzedAt !== '') analyzed.analyzedAt = analyzedAt;
  if (typeof record['chunks'] === 'number') analyzed.chunks = record['chunks'];
  return analyzed;
}

/** رابط ملف الكراسة الأصلي (PDF/DOCX) — كراسة الشروط جنب التحليل. */
export function brochurePdfUrl(fileName: string): string {
  return `${RESULTS_BASE}/pdf/${encodeURIComponent(fileName)}`;
}

/**
 * رفع كراسة PDF/DOCX من التطبيق → النظام يحللها والنتيجة ترجع لصاحبها بس.
 * ownerUid (Firebase uid) إلزامي — الكراسة الخاصة بيه: مش بتظهر في القايمة العامة
 * ولا لباقي التطبيقات، وبينزل له إشعار FCM خاص.
 * محتاج X-Write-Key (متخزن في VITE_GCS_WRITE_KEY وقت البناء).
 */
export async function uploadExternalBrochure(file: File, ownerUid: string): Promise<{ ok: boolean; fileName: string }> {
  const writeKey: string = import.meta.env.VITE_GCS_WRITE_KEY ?? '';
  if (writeKey === '') throw new Error('مشكلة إعداد: مفتاح الرفع مش موجود (VITE_GCS_WRITE_KEY)');
  if (ownerUid.trim() === '') throw new Error('لازم تسجل دخول الأول — الكراسة بتتحلل باسمك');
  const safeName = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, '_');
  const response = await fetch(`${RESULTS_BASE}/upload/${encodeURIComponent(safeName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Write-Key': writeKey,
      'X-Owner-Uid': ownerUid,
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`فشل رفع الكراسة (${response.status})`);
  }
  const data = (await response.json()) as { ok?: boolean; file?: string };
  return { ok: data.ok === true, fileName: data.file ?? safeName };
}
