/* Access allowlist: only approved emails may open the app.
 * Enforced twice: at login (before Firebase auth) and on session restore.
 * The list lives in Firestore `appConfig/allowedEmails` (owner-maintained)
 * with a hard-coded emergency fallback so the owner never locks himself out.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/** Emergency fallback — the owner accounts. Always allowed. */
const HARDCODED_ALLOWED = ['waledanter2026@gmail.com', 'medosasa90@gmail.com'];

const APP_CONFIG_DOC = 'appConfig';

let cachedAllowlist: { emails: string[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchAllowlist(): Promise<string[]> {
  if (cachedAllowlist && Date.now() - cachedAllowlist.fetchedAt < CACHE_TTL_MS) {
    return cachedAllowlist.emails;
  }
  try {
    const snapshot = await getDoc(doc(db, APP_CONFIG_DOC, 'allowedEmails'));
    const data = snapshot.data() as { allowedEmails?: string[] } | undefined;
    const emails = (data?.allowedEmails ?? []).map(normalizeEmail).filter((e) => e !== '');
    cachedAllowlist = { emails, fetchedAt: Date.now() };
    return emails;
  } catch {
    /* Config missing/unreadable → fall back to the hard-coded list only. */
    cachedAllowlist = { emails: [], fetchedAt: Date.now() };
    return [];
  }
}

/** Full allowlist (config + fallback). Used by the login gate. */
export async function getAllowedEmails(): Promise<string[]> {
  const fromConfig = await fetchAllowlist();
  return Array.from(new Set([...fromConfig, ...HARDCODED_ALLOWED.map(normalizeEmail)]));
}

/** Can this email open the app? */
export async function isEmailAllowed(email: string): Promise<boolean> {
  if (!email) return false;
  const allowed = await getAllowedEmails();
  return allowed.includes(normalizeEmail(email));
}
