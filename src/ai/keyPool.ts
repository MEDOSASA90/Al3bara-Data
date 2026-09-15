/* Gemini key pool: rotates across VITE_GEMINI_API_KEY + VITE_GEMINI_API_KEY_2..N.
 * The free tier allows 20 requests/min per key — large brochures need 11+
 * chunk requests, so rotating keys multiplies the effective quota.
 */

const pool: string[] = [];
let cursor = 0;

function addKey(value: string | undefined): void {
  if (value && value.trim() !== '' && !pool.includes(value.trim())) pool.push(value.trim());
}

addKey(import.meta.env.VITE_GEMINI_API_KEY as string | undefined);
addKey(import.meta.env.VITE_GEMINI_API_KEY_2 as string | undefined);
addKey(import.meta.env.VITE_GEMINI_API_KEY_3 as string | undefined);
addKey(import.meta.env.VITE_GEMINI_API_KEY_4 as string | undefined);

/** Next key in the pool (round-robin). Empty pool = no keys configured. */
export function nextGeminiKey(): string {
  if (pool.length === 0) return '';
  const key = pool[cursor % pool.length];
  cursor += 1;
  return key;
}

/** How many keys are configured (for UI hints). */
export function geminiKeyCount(): number {
  return pool.length;
}
