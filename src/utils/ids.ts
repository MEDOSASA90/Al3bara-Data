/** Unique ids for nested Firestore objects (transactions, lots, items). */

function randomPart(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().split('-')[0] ?? '';
    }
  } catch {
    // fall through to the time-based fallback
  }
  return Math.random().toString(36).slice(2, 10);
}

export function uniqueId(suffix = ''): string {
  const base = `${Date.now()}_${randomPart()}`;
  return suffix ? `${base}_${suffix}` : base;
}
