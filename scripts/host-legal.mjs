// Generates readable bilingual plain-text Privacy Policy + Terms and uploads
// them to a public Supabase Storage bucket, returning real public URLs for
// App Store Connect / Google Play. (Supabase serves public files as text/plain,
// so we publish clean .txt that renders perfectly in any browser.)
// Run: node scripts/host-legal.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, SR, { auth: { persistSession: false } });

const legal = JSON.parse(readFileSync('data/legal.json', 'utf8'));
const RULE = '─'.repeat(60);

function section(s, i) {
  return `${i + 1}. ${s.title.toUpperCase()}\n${s.body}\n`;
}

function render(kind, titleEn, titleEs) {
  const head = `${legal.meta.appName} — ${legal.meta.entity}`;
  const sub = `Last updated: ${legal.meta.updated} · ${legal.meta.location} · ${legal.meta.contact}`;
  const en = legal[kind].en.map(section).join('\n');
  const es = legal[kind].es.map(section).join('\n');
  return [
    head,
    RULE,
    titleEn.toUpperCase(),
    sub,
    '',
    en,
    RULE,
    titleEs.toUpperCase() + '  (Español)',
    '',
    es,
  ].join('\n');
}

async function main() {
  const { error: bErr } = await sb.storage.createBucket('legal', {
    public: true,
    fileSizeLimit: '1MB',
  });
  if (bErr && !/already exists/i.test(bErr.message)) throw bErr;

  // remove any earlier .html versions
  await sb.storage.from('legal').remove(['privacy.html', 'terms.html']);

  const files = [
    { name: 'privacy.txt', text: render('privacy', 'Privacy Policy', 'Política de Privacidad') },
    { name: 'terms.txt', text: render('terms', 'Terms of Service', 'Términos de Servicio') },
  ];

  for (const f of files) {
    const up = await sb.storage
      .from('legal')
      .upload(f.name, Buffer.from(f.text, 'utf8'), {
        contentType: 'text/plain; charset=utf-8',
        upsert: true,
      });
    if (up.error) throw up.error;
    const { data } = sb.storage.from('legal').getPublicUrl(f.name);
    console.log(`✓ ${f.name} → ${data.publicUrl}`);
  }
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
