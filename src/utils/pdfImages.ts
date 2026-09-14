/* PDF → images → Gemini Vision extraction.
 * Egyptian government auction brochures often have scrambled/offset text
 * layers that break text-based parsing. Rendering pages to canvas images
 * and letting Gemini read them visually extracts every lot reliably.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { InlineImage } from '../ai/geminiClient';

if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (error) {
    console.warn('PDF.js worker initialization notice:', error);
  }
}

const MAX_PAGES = 12;
const RENDER_SCALE = 2;

/** Render each PDF page to a JPEG base64 image (capped at MAX_PAGES). */
export async function renderPdfPagesToImages(file: File): Promise<InlineImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const images: InlineImage[] = [];
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      if (base64.length > 100) {
        images.push({ mimeType: 'image/jpeg', base64 });
      }
      canvas.width = 0;
      canvas.height = 0;
    } catch (pageError) {
      console.warn(`Error rendering page ${pageNum}:`, pageError);
    }
  }

  if (images.length === 0) {
    throw new Error('تعذر تحويل صفحات الـ PDF لصور. جرب ملف PDF تاني.');
  }
  return images;
}
