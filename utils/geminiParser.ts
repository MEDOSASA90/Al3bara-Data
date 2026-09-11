import { AuctionBrochureData } from './preloadedAuctions';

const STORAGE_KEY = 'al3bara_gemini_api_key';

export function getGeminiApiKey(): string {
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : '';
    if (fromStorage && fromStorage.trim()) return fromStorage.trim();
    
    // Check environment variable
    const fromEnv = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (fromEnv && fromEnv !== 'PLACEHOLDER_API_KEY') return fromEnv;

    return '';
}

export function saveGeminiApiKey(key: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, key.trim());
    }
}

/**
 * Call Gemini API directly via fetch to analyze auction brochure text and extract
 * 100% of all entities, lots, quantities, and conditions with high accuracy.
 */
export async function analyzeBrochureWithGemini(
    textOrBase64: string, 
    isPdf: boolean = false, 
    customKey?: string
): Promise<AuctionBrochureData> {
    const apiKey = customKey || getGeminiApiKey();

    if (!apiKey) {
        throw new Error('يرجى إدخال مفتاح Gemini API لإجراء التحليل الذكي فائق الدقة.');
    }

    const systemPrompt = `أنت خبير قانوني ومحاسبي في تفريغ كراسات شروط مزادات وزارة المالية المصرية (الهيئة العامة للخدمات الحكومية).
مهمتك استخراج وتفريغ كافة بيانات كراسة المزاد بدقة 100% بدون إهمال أو اختصار أي جهة أو أي لوط.

عليك استخراج ما يلي بشكل دقيق جداً:
1. تاريخ الجلسة بصيغة YYYY-MM-DD (مثلاً: 2026-09-16).
2. عنوان الجلسة بالكامل ومكان انعقادها (قاعة نادي الحضارات الرياضي - عين الصيرة...).
3. قائمة **جميع الجهات الحكومية** الواردة بالكراسة (مديريات التربية والتعليم، المستشفيات، مجالس المدن، الشون، الهيئات...).
4. تحت كل جهة، استخراج **كافة اللوطات التابعة لها كاملة بدون أي حذف**:
   - lotNumber: رقم اللوط المذكور.
   - name: البيان الدقيق للأصناف المكونة للوط.
   - quantity: الكمية المذكورة مع وحدتها (مثال: "5000 عدد" أو "10.5 طن" أو "1700 كيلو").
   - unit: وحدة القياس (عدد / طن / كيلو / متر).
   - condition: حالة اللوط (خردة / كسر / كهنة / راكد جديد على حالته / مستعمل / ملغاه).
   - notes: أي اشتراطات خاصة (مثل: شرط ترخيص بيئي، أو اسم وتليفون أمين المخزن والمعاينة إن وُجد).

يجب أن تكون النتيجة بتنسيق JSON حصراً متوافقاً مع هذا المخطط:
{
  "id": "auction-...",
  "auctionDate": "YYYY-MM-DD",
  "title": "...",
  "hallLocation": "...",
  "insuranceAmount": 50000,
  "entities": [
    {
      "id": "entity-1",
      "entityName": "اسم الجهة والمخزن",
      "location": "العنوان والمحافظة",
      "contactPerson": "اسم مسؤول المعاينة إن وجد",
      "contactPhone": "رقم التليفون إن وجد",
      "lots": [
        {
          "lotNumber": "1",
          "name": "...",
          "quantity": "...",
          "unit": "...",
          "condition": "...",
          "notes": "..."
        }
      ]
    }
  ]
}`;

    const requestBody: any = {
        contents: [
            {
                role: 'user',
                parts: isPdf
                    ? [
                        { text: systemPrompt },
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: textOrBase64
                            }
                        }
                    ]
                    : [
                        { text: systemPrompt + '\n\nنص كراسة الشروط المراد تفريغها بالكامل:\n\n' + textOrBase64 }
                    ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
        }
    };

    // Try gemini-2.5-flash, fallback to gemini-1.5-flash
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `HTTP ${response.status}: فشل الاتصال بخدمة Gemini`);
            }

            const data = await response.json();
            const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawOutput) {
                throw new Error('لم يتم استرجاع أي بيانات من النموذج');
            }

            // Parse clean JSON
            const cleanedJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedData: AuctionBrochureData = JSON.parse(cleanedJson);

            // Validate data integrity
            if (!parsedData.entities || !Array.isArray(parsedData.entities)) {
                throw new Error('البيانات المستخرجة لا تحتوي على قائمة جهات صالحة.');
            }

            // Ensure unique IDs
            parsedData.id = parsedData.id || `auction-${parsedData.auctionDate || Date.now()}`;
            parsedData.entities = parsedData.entities.map((e, idx) => ({
                ...e,
                id: e.id || `entity-${idx + 1}-${Date.now()}`,
                lots: (e.lots || []).map((l, lIdx) => ({
                    ...l,
                    lotNumber: l.lotNumber || `${lIdx + 1}`
                }))
            }));

            return parsedData;

        } catch (err: any) {
            console.warn(`Attempt with ${model} failed:`, err);
            lastError = err;
        }
    }

    throw lastError || new Error('فشلت محاولة التحليل الذكي عبر Gemini.');
}
