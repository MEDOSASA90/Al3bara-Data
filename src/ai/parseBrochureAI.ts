import { generateJson, generateText, splitBrochureText } from './geminiClient';
import type { BrochureAIResult } from './schemas';
import { validateBrochureAIResult } from './schemas';
import { asJson, getArray, isRecord, getString, getOptionalString } from './jsonGuard';

const BROCHURE_SYSTEM =
  'أنت محلل كراسات مزادات حكومية مصرية. استخرج البيانات بدقة وأعد JSON فقط ' +
  'بدون أي شرح أو markdown. حافظ على الأسماء العربية كما وردت تماماً. ' +
  'رقم اللوط lotNumber نص كما ورد، والكمية quantity نص كما وردت (مثال: "6.400 طن").';

/** Merge chunk results into one brochure result (dedupe entities by name). */
function mergeChunkResults(chunkResults: BrochureAIResult[]): BrochureAIResult {
  if (chunkResults.length === 1) return chunkResults[0];

  const merged: BrochureAIResult = {
    auctionDate: '',
    title: '',
    entities: [],
  };

  for (const result of chunkResults) {
    if (merged.auctionDate === '' && result.auctionDate !== '') merged.auctionDate = result.auctionDate;
    if (merged.title === '' && result.title !== '') merged.title = result.title;

    for (const entity of result.entities) {
      const existing = merged.entities.find(
        (candidate) => candidate.entityName.trim() === entity.entityName.trim(),
      );
      if (existing) {
        // Same entity across chunk boundary: append its lots (skip exact duplicate lot rows)
        for (const lot of entity.lots) {
          const duplicate = existing.lots.some(
            (candidate) =>
              candidate.lotNumber === lot.lotNumber &&
              candidate.name === lot.name &&
              candidate.quantity === lot.quantity,
          );
          if (!duplicate) existing.lots.push(lot);
        }
      } else {
        merged.entities.push({ ...entity, lots: [...entity.lots] });
      }
    }
  }
  return merged;
}

/**
 * Convert raw brochure text (OCR / PDF / pasted) into structured auction data.
 * `auctionDateHint` guides the model when the text omits the session date (YYYY-MM-DD).
 *
 * Long booklets are split into ~6-page chunks and analyzed separately, then merged —
 * each call stays small so a 185-page booklet no longer triggers 429 quota cascades.
 */
export async function brochureTextToData(rawText: string, auctionDateHint?: string): Promise<BrochureAIResult> {
  const text = rawText.trim();
  if (text === '') throw new Error('نص الكراسة فارغ. الصق النص أو استخرجه من PDF أولاً.');

  const chunks = splitBrochureText(text);
  if (chunks.length === 0) throw new Error('نص الكراسة فارغ. الصق النص أو استخرجه من PDF أولاً.');

  const chunkResults: BrochureAIResult[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const partLabel =
      chunks.length > 1 ? ` (الجزء ${index + 1} من ${chunks.length})` : '';
    const hintLine =
      auctionDateHint && auctionDateHint.trim() !== ''
        ? `تاريخ الجلسة المتوقع (استخدمه إذا لم يذكر النص تاريخاً): ${auctionDateHint.trim()}.\n`
        : '';
    const prompt =
      `${hintLine}حلل نص الكراسة التالي${partLabel} وأعد JSON بهذا الشكل فقط:\n` +
      `{"auctionDate":"YYYY-MM-DD","title":"عنوان الجلسة","entities":[{"entityName":"اسم الجهة","location":"المكان إن وجد","lots":[{"lotNumber":"1","name":"وصف اللوط","quantity":"الكمية كما وردت","unit":"الوحدة إن وجدت","condition":"الحالة إن وجدت"}]}]}\n\n` +
      `ملاحظة: هذا جزء من كراسة متعددة الصفحات — حلل فقط ما يظهر في هذا الجزء، وأعد entities فارغة إذا لم يوجد لوط كامل في الجزء.\n\n` +
      `نص الكراسة:\n${chunk}`;
    const chunkResult = await analyzeChunk(prompt, auctionDateHint);
    chunkResults.push(chunkResult);
  }

  return mergeChunkResults(chunkResults);
}

/**
 * Analyze one chunk tolerantly: chunk results may legitimately have empty entities
 * (a chunk of cover/legal pages). Strict validation would kill the whole chunk on
 * an empty auctionDate — so narrow leniently here; the merged result still gets
 * strict-validated by the caller's expectations (auctionDate falls back to the hint).
 */
async function analyzeChunk(prompt: string, auctionDateHint?: string): Promise<BrochureAIResult> {
  const fallbackDate = auctionDateHint && auctionDateHint.trim() !== '' ? auctionDateHint.trim() : '';
  try {
    const validated = await generateJson({
      system: BROCHURE_SYSTEM,
      prompt,
      validate: validateBrochureAIResult,
    });
    return validated;
  } catch (error) {
    // Tolerant retry path: parse the raw JSON manually and keep whatever entities exist
    const text = await generateText({
      system: BROCHURE_SYSTEM,
      prompt,
      jsonMode: true,
    });
    const parsed: unknown = asJson(text);
    if (!isRecord(parsed)) throw error;
    const entities = getArray(parsed, 'entities');
    const lotsOf = (rawLots: unknown[]): BrochureAIResult['entities'][number]['lots'] => {
      const lots: BrochureAIResult['entities'][number]['lots'] = [];
      for (const rawLot of rawLots) {
        if (!isRecord(rawLot)) continue;
        const name = getString(rawLot, 'name');
        if (name.trim() === '') continue;
        const lot: BrochureAIResult['entities'][number]['lots'][number] = {
          lotNumber: getString(rawLot, 'lotNumber', '1'),
          name,
          quantity: getString(rawLot, 'quantity'),
        };
        const unit = getOptionalString(rawLot, 'unit');
        const condition = getOptionalString(rawLot, 'condition');
        if (unit) lot.unit = unit;
        if (condition) lot.condition = condition;
        lots.push(lot);
      }
      return lots;
    };
    const tolerantEntities: BrochureAIResult['entities'] = [];
    for (const rawEntity of entities) {
      if (!isRecord(rawEntity)) continue;
      const entityName = getString(rawEntity, 'entityName');
      if (entityName.trim() === '') continue;
      const entity: BrochureAIResult['entities'][number] = {
        entityName,
        lots: lotsOf(getArray(rawEntity, 'lots')),
      };
      const location = getOptionalString(rawEntity, 'location');
      if (location) entity.location = location;
      tolerantEntities.push(entity);
    }
    const rawDate = getString(parsed, 'auctionDate');
    return {
      auctionDate: rawDate.trim() !== '' ? rawDate : fallbackDate,
      title: getString(parsed, 'title'),
      entities: tolerantEntities,
    };
  }
}
