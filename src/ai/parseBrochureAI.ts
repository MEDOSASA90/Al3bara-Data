import { generateJson, type InlineImage } from './geminiClient';
import type { BrochureAIResult } from './schemas';
import { validateBrochureAIResult } from './schemas';

const BROCHURE_SYSTEM =
  'أنت محلل كراسات مزادات حكومية مصرية. مهمتك استخراج كل الجهات وكل اللوطات من نص الكراسة ' +
  'بدون حذف أو اختصار أي لوط. أعد JSON فقط بدون أي شرح أو markdown. ' +
  'حافظ على الأسماء العربية كما وردت تماماً. ' +
  'رقم اللوط lotNumber نص كما ورد، والكمية quantity نص كما وردت (مثال: "6.400 طن"). ' +
  'كراسة المزاد الواحدة عادة تحتوي على عشرات اللوطات الموزعة على عدة جهات — ' +
  'إذا أعدت أقل من عدد اللوطات الموجود في النص فأنت أخطأت في مهمتك.';

/**
 * Vision extraction: render PDF pages to images and let Gemini read them.
 * Bypasses broken text layers entirely — the model sees the actual page.
 * `auctionDateHint` guides the model when the pages omit the session date (YYYY-MM-DD).
 */
export async function brochureImagesToData(
  images: InlineImage[],
  auctionDateHint?: string,
): Promise<BrochureAIResult> {
  if (images.length === 0) throw new Error('مفيش صور صفحات. جرب تاني.');
  const hintLine =
    auctionDateHint && auctionDateHint.trim() !== ''
      ? `تاريخ الجلسة المتوقع (استخدمه إذا الصور ما ذكرتش تاريخ): ${auctionDateHint.trim()}.\n`
      : '';
  const prompt =
    `${hintLine}` +
    `دي صور صفحات كراسة مزادات حكومية مصرية. اقرأ كل صفحة بعينك واستخرج كل الجهات وكل اللوطات المكتوبة فيها.\n` +
    `أعد JSON بهذا الشكل فقط:\n` +
    `{"auctionDate":"YYYY-MM-DD","title":"عنوان الجلسة","entities":[{"entityName":"اسم الجهة","location":"المكان إن وجد","lots":[{"lotNumber":"رقم اللوط كما هو مكتوب","name":"وصف اللوط كما هو مكتوب","quantity":"الكمية كما هي مكتوبة","unit":"الوحدة إن وجدت","condition":"الحالة إن وجدت"}]}]}\n\n` +
    `قواعد إلزامية:\n` +
    `1. اقرأ كل صفحة من الصور بالترتيب — الصور دي أجزاء من كراسة واحدة.\n` +
    `2. استخرج كل لوط مكتوب في أي صفحة واحدًا واحدًا — لا تتوقف عند أول لوط ولا أول صفحة.\n` +
    `3. كراسة المزاد فيها عادة عشرات اللوطات على عدة جهات — إذا رجعت أقل من الموجود فأنت أخطأت.\n` +
    `4. انسخ رقم اللوط ووصفه وكميته كما هو مكتوب حرفيًا في الصورة.\n` +
    `5. اجمع اللوطات تحت جهتها الصحيحة.\n\n` +
    `عدد الصور: ${images.length}`;
  return generateJson({
    system: BROCHURE_SYSTEM,
    prompt,
    images,
    validate: validateBrochureAIResult,
  });
}
export async function brochureTextToData(rawText: string, auctionDateHint?: string): Promise<BrochureAIResult> {
  const text = rawText.trim();
  if (text === '') throw new Error('نص الكراسة فارغ. الصق النص أو استخرجه من PDF أولاً.');
  const hintLine =
    auctionDateHint && auctionDateHint.trim() !== ''
      ? `تاريخ الجلسة المتوقع (استخدمه إذا لم يذكر النص تاريخاً): ${auctionDateHint.trim()}.\n`
      : '';
  const lotCountEstimate = (text.match(/(?:لوط|اللوط)\s*[:-]?\s*(\d+)/gi) ?? []).length;
  const countLine =
    lotCountEstimate > 0
      ? `تنبيه: النص يحتوي على ما لا يقل عن ${lotCountEstimate} لوط مذكور برقمه — أعد كل واحد منهم بالترتيب.\n`
      : '';
  const prompt =
    `${hintLine}${countLine}` +
    `حلل نص الكراسة التالي وأعد JSON بهذا الشكل فقط (المصفوفات entities و lots يجب أن تحتوي كل العناصر الموجودة في النص — هذا مجرد مثال للصيغة وليس المحتوى):\n` +
    `{"auctionDate":"YYYY-MM-DD","title":"عنوان الجلسة","entities":[{"entityName":"اسم الجهة","location":"المكان إن وجد","lots":[{"lotNumber":"رقم اللوط كما ورد","name":"وصف اللوط","quantity":"الكمية كما وردت","unit":"الوحدة إن وجدت","condition":"الحالة إن وجدت"}]}]}\n\n` +
    `قواعد إلزامية:\n` +
    `1. استخرج كل لوط مذكور في النص واحدًا واحدًا — لا تتوقف عند أول لوط.\n` +
    `2. لا تُرجع لوطًا واحدًا فقط أبدًا؛ كراسة المزاد فيها دائمًا لوطات متعددة.\n` +
    `3. اجمع اللوطات تحت جهتها الصحيحة (كل جهة entity مستقل).\n` +
    `4. انسخ رقم اللوط ووصفه وكميته كما وردت حرفيًا.\n\n` +
    `نص الكراسة:\n${text}`;
  return generateJson({
    system: BROCHURE_SYSTEM,
    prompt,
    validate: validateBrochureAIResult,
  });
}
