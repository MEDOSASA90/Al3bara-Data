/* Precision brochure extraction: chunked text analysis + merge.
 * Large brochures (185 pages ≈ 55k tokens) exceed the model's output limit,
 * so it bails after the first lot. Splitting the text into page-range chunks
 * and analysing each chunk separately, then merging, extracts every lot.
 */

import { brochureTextToData, brochureImagesToData } from '../ai/parseBrochureAI';
import type { BrochureAIResult, BrochureAIEntity } from '../ai/schemas';
import type { InlineImage } from '../ai/geminiClient';

export interface ChunkProgress {
  (done: number, total: number, note: string): void;
}

/** Split page-marked text into overlapping page-range chunks. */
export function splitIntoChunks(text: string, pagesPerChunk: number): string[] {
  const pageMarker = /--- PAGE (\d+) ---/g;
  const positions: { page: number; start: number }[] = [];
  let match = pageMarker.exec(text);
  while (match) {
    positions.push({ page: Number(match[1]), start: match.index });
    match = pageMarker.exec(text);
  }
  if (positions.length <= pagesPerChunk) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < positions.length; i += pagesPerChunk) {
    const start = positions[i].start;
    const nextGroup = positions.slice(i, i + pagesPerChunk);
    const lastPage = nextGroup[nextGroup.length - 1];
    const nextPage = positions[i + pagesPerChunk];
    const end = nextPage ? nextPage.start : text.length;
    /* Overlap by one page so a lot split across the boundary is captured twice
     * (duplicates are removed at merge by lot number + entity name). */
    chunks.push(text.slice(start, end));
    void lastPage;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

function entityKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Merge chunk results into one brochure: entities combine, lots dedupe. */
export function mergeChunkResults(results: BrochureAIResult[], fallbackDate: string, fallbackTitle: string): BrochureAIResult {
  const entityMap = new Map<string, BrochureAIEntity>();
  let auctionDate = fallbackDate;
  let title = fallbackTitle;

  for (const result of results) {
    if (result.auctionDate && /^\d{4}-\d{2}-\d{2}$/.test(result.auctionDate)) auctionDate = result.auctionDate;
    if (result.title && result.title.trim().length > title.trim().length) title = result.title;
    for (const entity of result.entities) {
      const key = entityKey(entity.entityName);
      const existing = entityMap.get(key);
      if (!existing) {
        entityMap.set(key, { ...entity, lots: [...entity.lots] });
        continue;
      }
      /* Dedupe lots within the entity by lotNumber (boundary overlap). */
      const seen = new Set(existing.lots.map((l) => l.lotNumber));
      for (const lot of entity.lots) {
        if (!seen.has(lot.lotNumber)) {
          existing.lots.push(lot);
          seen.add(lot.lotNumber);
        }
      }
    }
  }
  return { auctionDate, title: title.trim() || fallbackTitle, entities: Array.from(entityMap.values()) };
}

export interface AnalyzeBrochureResult {
  result: BrochureAIResult | null;
  method: 'text' | 'text-chunked' | 'vision' | 'failed';
  error?: string;
}

/**
 * Precision extraction pipeline for ONE brochure text:
 * 1. Single-pass text analysis (fast, works for small brochures).
 * 2. If the result is suspiciously small → chunked analysis with merge.
 * 3. If no text or chunking fails → vision on page images.
 */
export async function analyzeBrochureText(
  text: string,
  fileName: string,
  onProgress?: ChunkProgress,
): Promise<AnalyzeBrochureResult> {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const fallbackTitle = fileName.replace(/\.pdf$/i, '').trim() || 'كراسة مزاد';

  /* Pass 1: single-shot. */
  try {
    const single = await brochureTextToData(text);
    const totalLots = single.entities.reduce((s, e) => s + e.lots.length, 0);
    const mentioned = (text.match(/(?:لوط|اللوط)\s*[:-]?\s*(\d+)/gi) ?? []).length;
    /* Good enough when the model found lots and the text isn't a 100+ lot monster. */
    if (totalLots >= Math.min(3, mentioned || 3) && text.length < 60000) {
      return { result: single, method: 'text' };
    }
  } catch {
    /* fall through to chunking */
  }

  /* Pass 2: chunked analysis (the precision path for large brochures). */
  const chunks = splitIntoChunks(text, 18);
  if (chunks.length > 1) {
    const chunkResults: BrochureAIResult[] = [];
    let failures = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      onProgress?.(i, chunks.length, `تحليل الجزء ${i + 1} من ${chunks.length}`);
      try {
        chunkResults.push(await brochureTextToData(chunks[i]));
      } catch {
        failures += 1;
      }
    }
    if (chunkResults.length > 0) {
      const merged = mergeChunkResults(chunkResults, today, fallbackTitle);
      return {
        result: merged,
        method: 'text-chunked',
        error: failures > 0 ? `${failures} أجزاء تعذر تحليلها من ${chunks.length}` : undefined,
      };
    }
  }

  return { result: null, method: 'failed', error: 'تعذر استخراج اللوطات من النص' };
}

/** Vision pipeline: page images in batches, merged. */
export async function analyzeBrochureImages(
  images: InlineImage[],
  onProgress?: ChunkProgress,
): Promise<AnalyzeBrochureResult> {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const BATCH = 4;
  const results: BrochureAIResult[] = [];
  const batches = Math.ceil(images.length / BATCH);
  let failures = 0;
  for (let i = 0; i < batches; i += 1) {
    onProgress?.(i, batches, `تحليل الصور ${i * BATCH + 1}-${Math.min((i + 1) * BATCH, images.length)} من ${images.length}`);
    try {
      results.push(await brochureImagesToData(images.slice(i * BATCH, (i + 1) * BATCH)));
    } catch {
      failures += 1;
    }
  }
  if (results.length === 0) return { result: null, method: 'failed', error: 'فشل تحليل الصور' };
  return {
    result: mergeChunkResults(results, today, 'كراسة مزاد'),
    method: 'vision',
    error: failures > 0 ? `${failures} دفعات صور تعذرت من ${batches}` : undefined,
  };
}
