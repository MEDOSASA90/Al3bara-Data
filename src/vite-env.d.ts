/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_GEMINI_FALLBACK_MODEL?: string;
  /** نظام الكراسات المستقل على الـ VPS (vercel.json rewrite /gcs → VPS). */
  readonly VITE_GCS_RESULTS_URL?: string;
  /** مفتاح الرفع للنظام (رفع كراسة PDF للتحليل). */
  readonly VITE_GCS_WRITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
