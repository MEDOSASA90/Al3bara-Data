/** Unique ids for nested Firestore objects (transactions, lots, items). */
export function uniqueId(suffix = ''): string {
  return suffix ? `${Date.now()}_${suffix}` : `${Date.now()}`;
}
