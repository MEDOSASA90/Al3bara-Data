import { Timestamp } from 'firebase/firestore';
import type { ImageRef } from '../domain/types';

export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '0.00';
  }
  try {
    return new Intl.NumberFormat('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

export function formatDate(timestamp: Timestamp | null | undefined): string {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'لا يوجد تاريخ';
  try {
    return timestamp.toDate().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'تاريخ غير صالح';
  }
}

export function formatSpecificDateTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp || !timestamp.toDate || typeof timestamp.toDate !== 'function') {
    return 'لا يوجد تاريخ';
  }
  try {
    const date = timestamp.toDate();
    if (Number.isNaN(date.getTime())) {
      return 'تاريخ غير صالح';
    }

    const year = date.toLocaleDateString('ar-EG', { year: 'numeric', numberingSystem: 'arab' });
    const month = date.toLocaleDateString('ar-EG', { month: '2-digit', numberingSystem: 'arab' });
    const day = date.toLocaleDateString('ar-EG', { day: '2-digit', numberingSystem: 'arab' });
    const time = date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      numberingSystem: 'arab',
    });

    return `${year}/${month}/${day} ${time}`;
  } catch (error) {
    console.error('Error in formatSpecificDateTime:', error);
    return 'خطأ في عرض التاريخ';
  }
}

export function getDirectImageUrl(url: string): string {
  if (!url) return url;

  try {
    if (url.includes('drive.google.com')) {
      let fileId = '';

      const viewMatch = url.match(/\/file\/d\/([^/\\?]+)/);
      if (viewMatch?.[1]) {
        fileId = viewMatch[1];
      }

      if (!fileId) {
        const openMatch = url.match(/[?&]id=([^&]+)/);
        if (openMatch?.[1]) {
          fileId = openMatch[1];
        }
      }

      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
    return url;
  } catch (error) {
    console.error('Error converting image URL:', error);
    return url;
  }
}

/** File -> raw base64 (without the data: prefix). */
export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error('Input is not a Blob/File'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file as data URL'));
        return;
      }
      resolve(result.includes(',') ? (result.split(',')[1] ?? result) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function imageRefFromUpload(name: string, url: string): ImageRef {
  return { name, url };
}

/**
 * Parses an `YYYY-MM-DD` date input into a Firestore Timestamp at local noon
 * (avoids off-by-one timezone shifts). All new writes use this helper.
 */
export function timestampFromDateInput(value: string): Timestamp {
  const [year, month, day] = value.split('-').map(Number);
  return Timestamp.fromDate(new Date(year, month - 1, day, 12, 0, 0));
}

/** Formats a Firestore Timestamp back to an `YYYY-MM-DD` date-input value. */
export function dateInputFromTimestamp(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateInput(): string {
  return dateInputFromTimestamp(Timestamp.now());
}
