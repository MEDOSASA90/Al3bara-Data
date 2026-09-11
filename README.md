# العبارة للتجارة والتوريدات — نسخة نظيفة (Al3bara-Clean)

إعادة بناء كاملة ونظيفة للمشروع الأصلي بنفس القيمة والبيانات، بهندسة جاهزة للتوسع والأتمتة.

## التشغيل

```bash
npm install
npm run dev
```

متغيرات البيئة في `.env.local` (انسخ الشكل من `.env.example`):

- `GEMINI_API_KEY` — مفتاح Gemini (اختياري)
- `VITE_DRIVE_SCRIPT_URL` — رابط Apps Script للرفع على Drive
- `VITE_DRIVE_FOLDER_ID` — مجلد Drive للصور

البيانات تعيش على نفس مشروع Firebase ونفس أسماء الـ Collections
(`advanceClients`, `workClients`, `entities`, `predefinedItems`, `predefinedBuyers`)
— لا حاجة لأي ترحيل.

## البنية

```
src/
  domain/        القواعد المالية pure (بدون React/Firebase)
    constants.ts   الدمغة 10ج، العمولة 0.5%، مهلة 15 يوم، أسماء Collections
    types.ts       كل الأنواع (ممنوع any)
    finance.ts     حاسبة 30/70 ثنائية الاتجاه + العمولة + الأرصدة + المهل
  data/          طبقة Firestore فقط
    repositories.ts    اشتراكات live + كل عمليات CRUD بأنواع صريحة
    commissionSync.ts  مزامنة عمولة المشتري (نفس سلوك الأصلي بالظبط)
  hooks/         useAuth / useLiveQuery / useTheme
  utils/         format, images (ضغط), driveUpload, brochureParser, print, ids
  components/
    ui/          Modal, Header, MetricCard, BalanceDisplay, SummaryPanel, ...
    print/       reports.ts — كل تقارير HTML دوال pure بدون React
  features/      شاشة لكل دومين + المودالات الخاصة بها
    dashboard/ entities/ clients/ archive/ brochures/ auth/
  App.tsx        توصيل فقط: state للتنقل والمودالات + استدعاء data/domain
```

## القواعد الذهبية للمساهمين (والأتمتة مستقبلاً)

1. **ممنوع `any`** — البناء يفشل عبر `npm run check:no-any`. استخدم `unknown` + تضييق.
2. **الحسابات في `domain/` فقط** — دوال pure تقبل أنواع الدومين وتُختبر بمعزل عن Firebase.
3. **الـ UI يعرض فقط** — أي كتابة Firestore تتم عبر `data/repositories.ts`.
4. **التقارير pure** — `components/print/reports.ts` بدون React لتُستخدم في الطباعة والأتمتة.
5. **العقود بالإنجليزية، الواجهة بالعربية** — أسماء الدوال والأنواع إنجليزية، النصوص عربية RTL.

## قواعد الحسابات (مطابقة للأصلي)

- `base30 = round(total × 0.3)` ثم `value30 = base30 + 10 دمغة` و `value70 = total − base30`
- عكساً: من 30 → `total = round(base / 0.3)`، من 70 → `total = round(val / 0.7)`
- العمولة `0.5%` من اللوطات النشطة كحركة دائنة مرتبطة بالجهة (`entityId`)
- مهلة سداد الـ 70% = تاريخ المزاد + 15 يوم
- الموجب = مدين (مطلوب منه)، السالب = دائن (مدفوع مقدماً)
