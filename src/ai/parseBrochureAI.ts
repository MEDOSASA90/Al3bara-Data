import { generateJson } from './geminiClient';
import type { BrochureAIResult } from './schemas';
import { validateBrochureAIResult } from './schemas';

const BROCHURE_SYSTEM =
  'أنت محلل كراسات مزادات حكومية مصرية. استخرج البيانات بدقة وأعد JSON فقط ' +
  'بدون أي شرح أو markdown. حافظ على الأسماء العربية كما وردت تماماً. ' +
  'رقم اللوط lotNumber نص كما ورد، والكمية quantity نص كما وردت (مثال: "6.400 طن").';

/**
 * Convert raw brochure text (OCR / PDF / pasted) into structured auction data.
 * `auctionDateHint` guides the model when the text omits the session date (YYYY-MM-DD).
 */
export async function brochureTextToData(rawText: string, auctionDateHint?: string): Promise<BrochureAIResult> {
  const text = rawText.trim();
  if (text === '') throw new Error('نص الكراسة فارغ. الصق النص أو استخرجه من PDF أولاً.');
  const hintLine =
    auctionDateHint && auctionDateHint.trim() !== ''
      ? `تاريخ الجلسة المتوقع (استخدمه إذا لم يذكر النص تاريخاً): ${auctionDateHint.trim()}.\n`
      : '';
  const prompt =
    `${hintLine}حلل نص الكراسة التالي وأعد JSON بهذا الشكل فقط:\n` +
    `{"auctionDate":"YYYY-MM-DD","title":"عنوان الجلسة","entities":[{"entityName":"اسم الجهة","location":"المكان إن وجد","lots":[{"lotNumber":"1","name":"وصف اللوط","quantity":"الكمية كما وردت","unit":"الوحدة إن وجدت","condition":"الحالة إن وجدت"}]}]}\n\n` +
    `نص الكراسة:\n${text}`;
  return generateJson({
    system: BROCHURE_SYSTEM,
    prompt,
    validate: validateBrochureAIResult,
  });
}
