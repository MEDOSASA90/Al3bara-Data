/** Safe narrowing helpers over unknown — zero `any` anywhere. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getString(record: Record<string, unknown>, key: string, fallback = ''): string {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

export function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function getNumber(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = record[key];
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,٬\s]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function getOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/[,٬\s]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

export function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

export function getOptionalArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : undefined;
}

/** Parse a JSON string into unknown. Throws an Arabic error on invalid JSON. */
export function asJson(text: string): unknown {
  const cleaned = extractJsonBody(text);
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error('تعذر فهم رد الذكاء الاصطناعي (JSON غير صالح). حاول مرة أخرى.');
  }
}

function extractJsonBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    return withoutFence.trim();
  }
  const firstBrace = trimmed.search(/[{[]/);
  const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}
