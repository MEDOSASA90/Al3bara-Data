import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CI guard: the codebase bans the `any` type.
 * Allows the HTML attribute step="any" (not a type annotation).
 */

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const TYPE_ANY = /:\s*any\b|<any\b|\bas\s+any\b|Array<any>|any\[\]/;

let violations = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    const lines = readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const code = line.split('//')[0];
      if (TYPE_ANY.test(code)) {
        console.error(`${full}:${index + 1}: forbidden 'any' -> ${line.trim()}`);
        violations += 1;
      }
    });
  }
}

walk(SRC);

if (violations > 0) {
  console.error(`\ncheck:no-any FAILED with ${violations} violation(s).`);
  process.exit(1);
} else {
  console.log('check:no-any passed: no explicit any in src.');
}
