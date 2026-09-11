import { generateJson } from './geminiClient';
import type { BusinessInsights } from './schemas';
import { validateBusinessInsights } from './schemas';

const INSIGHTS_SYSTEM =
  'أنت مستشار مالي لتاجر مزادات خردة (العبارة). حلل الملخص وأعد JSON فقط ' +
  'بدون شرح أو markdown. رتب التنبيهات بالأهمية: المتأخرات أولاً ثم أكبر المديونيات. ' +
  'استخدم severity: "critical" للمتأخرات، "warning" للمديونيات الكبيرة، "info" لغيرها.';

/** Turn a business snapshot into prioritized alerts, top debtors, and a cash outlook. */
export async function getBusinessInsights(snapshot: string): Promise<BusinessInsights> {
  if (snapshot.trim() === '') throw new Error('ملخص النشاط فارغ. ابنِ الملخص أولاً.');
  const prompt =
    `حلل ملخص النشاط التالي وأعد JSON بهذا الشكل فقط:\n` +
    `{"alerts":[{"severity":"critical|warning|info","title":"عنوان قصير","detail":"تفصيل من سطرين كحد أقصى"}],"topDebtors":[{"name":"الاسم","amount":0}],"cashOutlook":"توقع السيولة في 3-4 أسطر"}\n\n` +
    `ملخص النشاط:\n${snapshot}`;
  return generateJson({
    system: INSIGHTS_SYSTEM,
    prompt,
    validate: validateBusinessInsights,
  });
}
