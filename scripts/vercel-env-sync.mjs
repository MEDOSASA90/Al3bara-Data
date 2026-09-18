import { readFileSync } from 'node:fs';

const TOKEN = process.env.VERCEL_TOKEN ?? '';
const PROJECT = 'prj_iEENjJdY2PPFkQW94ReCAinUB9S7';
const KEYS = ['VITE_GEMINI_API_KEY', 'VITE_GEMINI_MODEL', 'VITE_DRIVE_SCRIPT_URL', 'VITE_DRIVE_FOLDER_ID'];

if (TOKEN.trim() === '') {
  console.error('MISSING_TOKEN');
  process.exit(1);
}

const vals = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (t === '' || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  vals[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

async function call(path, method, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(`https://api.vercel.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

const existing = await call(`/v9/projects/${PROJECT}/env`, 'GET');
const ids = {};
try {
  const list = JSON.parse(existing.body).envs ?? [];
  for (const e of list) ids[e.key] = e.id;
} catch {
  console.error('LIST_FAIL', existing.status);
}

for (const key of KEYS) {
  const value = vals[key] ?? '';
  if (value === '') {
    console.log('SKIP_EMPTY', key);
    continue;
  }
  if (ids[key]) {
    const r = await call(`/v9/projects/${PROJECT}/env/${ids[key]}`, 'PATCH', { value });
    console.log(r.status === 200 ? 'UPDATED' : 'UPDATE_FAIL', key, r.status);
  } else {
    const r = await call(`/v10/projects/${PROJECT}/env`, 'POST', {
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview'],
    });
    console.log(r.status === 200 || r.status === 201 ? 'CREATED' : 'CREATE_FAIL', key, r.status);
  }
}
