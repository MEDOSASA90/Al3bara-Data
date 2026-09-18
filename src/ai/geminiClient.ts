import { asJson, getArray, isRecord } from './jsonGuard';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

export function getGeminiApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY ?? '';
}

export function getGeminiModel(): string {
  const configured = import.meta.env.VITE_GEMINI_MODEL;
  return configured && configured.trim() !== '' ? configured : DEFAULT_GEMINI_MODEL;
}

export function getGeminiFallbackModel(): string {
  const configured = import.meta.env.VITE_GEMINI_FALLBACK_MODEL;
  const fallback = configured && configured.trim() !== '' ? configured : FALLBACK_GEMINI_MODEL;
  return fallback === getGeminiModel() ? '' : fallback;
}

export interface InlineImage {
  mimeType: string;
  base64: string;
}

export interface GenerateTextOptions {
  model?: string;
  system?: string;
  prompt: string;
  images?: InlineImage[];
  jsonMode?: boolean;
}

export interface GenerateJsonOptions<T> extends GenerateTextOptions {
  validate: (value: unknown) => T;
}

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

function requireApiKey(): string {
  const key = getGeminiApiKey();
  if (key.trim() === '') {
    throw new Error('مفتاح Gemini غير مضبوط. أضف VITE_GEMINI_API_KEY في ملف البيئة.');
  }
  return key;
}

function buildParts(options: GenerateTextOptions): Part[] {
  const parts: Part[] = [];
  if (options.images) {
    for (const image of options.images) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }
  }
  parts.push({ text: options.prompt });
  return parts;
}

function extractText(data: unknown): string {
  if (!isRecord(data)) throw new Error('رد غير متوقع من Gemini. حاول مرة أخرى.');
  const candidates = getArray(data, 'candidates');
  const first = candidates[0];
  if (!isRecord(first)) {
    const err = data['error'];
    if (isRecord(err)) {
      const message = typeof err['message'] === 'string' ? err['message'] : 'خطأ غير معروف';
      throw new Error(`خطأ من Gemini: ${message}`);
    }
    throw new Error('لم يرجع Gemini أي نتيجة. حاول مرة أخرى.');
  }
  const content = first['content'];
  if (!isRecord(content)) throw new Error('رد فارغ من Gemini. حاول مرة أخرى.');
  const parts = getArray(content, 'parts');
  const texts: string[] = [];
  for (const part of parts) {
    if (isRecord(part) && typeof part['text'] === 'string') texts.push(part['text']);
  }
  const joined = texts.join('').trim();
  if (joined === '') throw new Error('رد فارغ من Gemini. حاول مرة أخرى.');
  return joined;
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arabicHttpError(status: number): string {
  if (status === 400) return 'طلب مرفوض من Gemini (400). تحقق من صيغة الإدخال.';
  if (status === 401 || status === 403) return 'مفتاح Gemini مرفوض (تحقق من VITE_GEMINI_API_KEY).';
  if (status === 404) return 'موديل Gemini غير موجود. تحقق من VITE_GEMINI_MODEL.';
  if (status === 429) return 'تم تجاوز حد الاستخدام. انتظر قليلاً ثم حاول مجدداً.';
  if (status >= 500) return 'خدمة Gemini غير متاحة حالياً. حاول لاحقاً.';
  return `خطأ من Gemini (رمز ${status}). حاول مرة أخرى.`;
}

/**
 * Plain Arabic/structured text generation via Gemini REST v1beta.
 * NOTE: never sends temperature/top_p/top_k (rejected by 3.x models).
 * On persistent retryable failures it automatically falls back to the
 * fallback model once (see VITE_GEMINI_FALLBACK_MODEL).
 */
export async function generateText(options: GenerateTextOptions): Promise<string> {
  const primary = options.model ?? getGeminiModel();
  try {
    return await attemptGenerate(options, primary);
  } catch (error) {
    const fallback = !options.model ? getGeminiFallbackModel() : '';
    if (fallback === '' || !isOverloadError(error)) throw error;
    return attemptGenerate(options, fallback);
  }
}

function isOverloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('حد الاستخدام') || error.message.includes('غير متاحة');
}

async function attemptGenerate(options: GenerateTextOptions, model: string): Promise<string> {
  const apiKey = requireApiKey();
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: buildParts(options) }],
  };
  if (options.system && options.system.trim() !== '') {
    body['system_instruction'] = { parts: [{ text: options.system }] };
  }
  if (options.jsonMode === true) {
    body['generationConfig'] = { responseMimeType: 'application/json' };
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = new Error('تعذر الاتصال بخدمة Gemini. تحقق من الإنترنت وحاول مجدداً.');
      if (attempt < MAX_ATTEMPTS) await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as unknown;
      return extractText(data);
    }

    if (isRetryable(response.status) && attempt < MAX_ATTEMPTS) {
      lastError = new Error(arabicHttpError(response.status));
      await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      continue;
    }
    throw new Error(arabicHttpError(response.status));
  }
  throw lastError ?? new Error('فشل الاتصال بـ Gemini. حاول مرة أخرى.');
}

/** Structured generation: forces JSON mime type, parses, then narrows via `validate`. */
export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const text = await generateText({ ...options, jsonMode: true });
  const parsed: unknown = asJson(text);
  try {
    return options.validate(parsed);
  } catch {
    throw new Error('رد الذكاء الاصطناعي لا يطابق الصيغة المتوقعة. حاول مرة أخرى.');
  }
}

/** Maximum characters per brochure analysis chunk (~6 pages of extracted text). */
export const BROCHURE_CHUNK_CHARS = 12000;

/**
 * Split long brochure text into ~6-page chunks so each Gemini call stays small
 * (smaller calls = faster + far less likely to hit 429 quota on big booklets).
 */
export function splitBrochureText(rawText: string, chunkChars: number = BROCHURE_CHUNK_CHARS): string[] {
  const text = rawText.trim();
  if (text.length <= chunkChars) return text === '' ? [] : [text];

  // Preferred split points: the extracted page markers (--- PAGE n ---)
  const pageMarker = /\n--- PAGE \d+ ---\n/g;
  const chunks: string[] = [];
  let current = '';

  const segments = text.split(pageMarker).filter((segment) => segment.trim() !== '');
  for (const segment of segments) {
    if (current !== '' && (current.length + segment.length) > chunkChars) {
      chunks.push(current);
      current = '';
    }
    // A single segment larger than the limit: hard-split it on line boundaries
    if (segment.length > chunkChars) {
      let rest = segment;
      while (rest.length > chunkChars) {
        let cut = rest.lastIndexOf('\n', chunkChars);
        if (cut < chunkChars / 2) cut = chunkChars;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
      continue;
    }
    current += segment;
  }
  if (current.trim() !== '') chunks.push(current);
  return chunks;
}
