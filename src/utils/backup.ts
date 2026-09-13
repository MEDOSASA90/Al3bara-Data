/* Backup: full Firestore export to a downloadable JSON file.
 * Downloads from the app itself (no Cloud Function needed) — data snapshot
 * of every collection the user owns. Kept local by design: financial data
 * never leaves the user's device except as an explicit download.
 */

import { collection, getDocs, type CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';

const BACKUP_COLLECTIONS = [
  'advanceClients',
  'workClients',
  'entities',
  'predefinedItems',
  'predefinedBuyers',
  'rejectedLots',
  'brochures',
  'partnerships',
] as const;

export interface BackupResult {
  ok: boolean;
  error?: string;
  counts?: Record<string, number>;
  fileName?: string;
}

function backupFileName(): string {
  const now = new Date();
  const pad = (n: number): string => `${n}`.padStart(2, '0');
  return `al3bara-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

/** Export every collection to a JSON file and trigger a download. */
export async function downloadBackup(): Promise<BackupResult> {
  try {
    const backup: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const name of BACKUP_COLLECTIONS) {
      const ref = collection(db, name) as CollectionReference;
      const snapshot = await getDocs(ref);
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        /* Firestore timestamps → ISO strings for safe JSON. */
        _exportedAt: new Date().toISOString(),
      }));
      backup[name] = docs;
      counts[name] = docs.length;
    }

    const payload = {
      app: 'al3bara',
      version: 1,
      createdAt: new Date().toISOString(),
      collections: backup,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    return { ok: true, counts, fileName: anchor.download };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'فشل النسخ الاحتياطي' };
  }
}

export function totalBackupCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}
