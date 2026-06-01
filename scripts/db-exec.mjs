// Executes SQL files against a Supabase project via the Management API.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_REF=xxx node scripts/db-exec.mjs file1.sql file2.sql
import { readFileSync } from 'node:fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_REF;
if (!token || !ref) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_REF');
  process.exit(1);
}

const files = process.argv.slice(2);

async function runSql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ ${label} → ${res.status}: ${text}`);
    throw new Error(`Failed: ${label}`);
  }
  console.log(`✓ ${label}`);
}

for (const f of files) {
  const sql = readFileSync(f, 'utf8');
  await runSql(sql, f);
}
console.log('Done.');
