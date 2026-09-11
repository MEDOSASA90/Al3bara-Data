import { generateJson } from './geminiClient';
import type { LotImageAnalysis } from './schemas';
import { validateLotImageAnalysis } from './schemas';

const IMAGE_SYSTEM =
  'أنت خبير تقييم خردة وكهنة في المزادات الحكومية المصرية. ' +
  'حلل الصورة وأعد JSON فقط بدون شرح أو markdown. ' +
  'كن متحفظاً في تقدير السعر واذكر أنه استرشادي.';

/**
 * Analyze a lot photo sent as base64 (strip any data: URL prefix first).
 * `mimeType` is usually "image/jpeg". `lotHint` adds context (lot name/quantity).
 */
export async function analyzeLotImage(
  base64: string,
  mimeType: string,
  lotHint?: string,
): Promise<LotImageAnalysis> {
  const cleaned = base64.trim().replace(/^data:[^;]+;base64,/, '');
  if (cleaned === '') throw new Error('صورة اللوط فارغة. التقط صورة أو اختر ملفاً أولاً.');
  const hintLine =
    lotHint && lotHint.trim() !== '' ? `سياق اللوط: ${lotHint.trim()}.\n` : '';
  const prompt =
    `${hintLine}حلل صورة اللوط وأعد JSON بهذا الشكل فقط:\n` +
    `{"condition":"وصف الحالة بالعربية","estimatedCategory":"التصنيف (حديد خردة/ورق دشت/خشب كسر/بلاستيك/أجهزة كهنة/غيره)","suggestedPrice":0,"notes":"ملاحظات قصيرة"}\n` +
    `حقل suggestedPrice اختياري (جنيه مصري استرشادي) — احذفه إن تعذر التقدير.`;
  return generateJson({
    system: IMAGE_SYSTEM,
    prompt,
    images: [{ mimeType, base64: cleaned }],
    validate: validateLotImageAnalysis,
  });
}
