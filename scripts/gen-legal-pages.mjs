// Generates landing/privacy.html and landing/terms.html from data/legal.json —
// the SAME source the in-app legal screens render — styled like the landing
// (reuses landing/styles.css + the EN·ES toggle). Re-run after editing legal.json:
//   node scripts/gen-legal-pages.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'data', 'legal.json'), 'utf8'));
const { meta } = legal;

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sections = (items) =>
  items
    .map(
      (s) => `      <section class="legal-sec">
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.body)}</p>
      </section>`,
    )
    .join('\n');

const PAGES = [
  {
    file: 'privacy.html',
    key: 'privacy',
    title: { en: 'Privacy Policy', es: 'Política de Privacidad' },
    other: { href: 'terms.html', en: 'Terms of Service', es: 'Términos de Servicio' },
  },
  {
    file: 'terms.html',
    key: 'terms',
    title: { en: 'Terms of Service', es: 'Términos de Servicio' },
    other: { href: 'privacy.html', en: 'Privacy Policy', es: 'Política de Privacidad' },
  },
];

const page = (p) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${p.title.en} — 11 Gol</title>
  <meta name="description" content="${p.title.en} for the 11 Gol app by ${meta.entity}." />
  <meta name="theme-color" content="#0A0E1A" />
  <meta name="robots" content="index,follow" />
  <link rel="icon" type="image/png" href="favicon.png" />
  <link rel="stylesheet" href="styles.css" />
  <style>
    .legal-wrap{max-width:760px;margin:0 auto;padding:clamp(32px,6vw,64px) clamp(18px,5vw,40px)}
    .legal-wrap .eyebrow{margin-bottom:10px}
    .legal-wrap h1{font-size:clamp(30px,5vw,44px);font-weight:900;letter-spacing:-.5px;line-height:1.05}
    .legal-updated{color:var(--muted);font-size:13px;margin:10px 0 34px}
    .legal-sec{margin-bottom:26px;padding:20px 22px;background:var(--surface);
      border:1px solid var(--line);border-radius:16px}
    .legal-sec h2{color:var(--gold);font-size:15px;font-weight:800;letter-spacing:.04em;
      text-transform:uppercase;margin-bottom:8px}
    .legal-sec p{color:var(--text);font-size:15px;white-space:pre-line}
    .legal-foot-link{display:inline-block;margin-top:8px;color:var(--gold);font-weight:700}
    .legal-foot-link:hover{text-decoration:underline}
    [data-lang]{display:none}
    html[data-active="en"] [data-lang="en"]{display:block}
    html[data-active="es"] [data-lang="es"]{display:block}
  </style>
</head>
<body>
  <header class="nav">
    <a class="brand" href="index.html" aria-label="11 Gol home">
      <span class="ball" aria-hidden="true"></span>
      <span>11&nbsp;Gol</span>
    </a>
    <nav class="nav-links">
      <a href="index.html#features" data-i18n="nav_back">App</a>
      <button id="lang" class="lang" type="button" aria-label="Toggle language">
        <span class="on">EN</span> · <span>ES</span>
      </button>
    </nav>
  </header>

  <main>
    <div class="legal-wrap" data-lang="en">
      <p class="eyebrow">11 Gol · ${meta.entity}</p>
      <h1>${p.title.en}</h1>
      <p class="legal-updated">Last updated: ${meta.updated}</p>
${sections(legal[p.key].en)}
      <a class="legal-foot-link" href="${p.other.href}">${p.other.en} →</a>
    </div>

    <div class="legal-wrap" data-lang="es">
      <p class="eyebrow">11 Gol · ${meta.entity}</p>
      <h1>${p.title.es}</h1>
      <p class="legal-updated">Última actualización: ${meta.updated}</p>
${sections(legal[p.key].es)}
      <a class="legal-foot-link" href="${p.other.href}">${p.other.es} →</a>
    </div>
  </main>

  <footer class="footer">
    <div class="foot-brand"><span class="ball small"></span> 11&nbsp;Gol</div>
    <nav class="foot-links">
      <a href="privacy.html" data-i18n="foot_privacy">Privacy</a>
      <a href="terms.html" data-i18n="foot_terms">Terms</a>
      <a href="mailto:${meta.contact}" data-i18n="foot_contact">Contact</a>
    </nav>
    <p class="disclaimer">© <span id="year"></span> ${meta.entity} ·
      <span data-i18n="foot_disclaimer">An independent app, not affiliated with any football organization or competition.</span>
    </p>
  </footer>

  <script>
    (function () {
      'use strict';
      var I18N = {
        en: { nav_back: 'App', foot_privacy: 'Privacy', foot_terms: 'Terms', foot_contact: 'Contact',
          foot_disclaimer: 'An independent app, not affiliated with any football organization or competition.' },
        es: { nav_back: 'App', foot_privacy: 'Privacidad', foot_terms: 'Términos', foot_contact: 'Contacto',
          foot_disclaimer: 'App independiente, no afiliada a ninguna organización ni competición de fútbol.' }
      };
      var lang = (navigator.language || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
      function apply(l) {
        lang = l;
        document.documentElement.lang = l;
        document.documentElement.setAttribute('data-active', l);
        var d = I18N[l];
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
          var k = el.getAttribute('data-i18n');
          if (d[k] != null) el.innerHTML = d[k];
        });
        var btn = document.getElementById('lang');
        btn.querySelectorAll('span').forEach(function (s) { s.classList.remove('on'); });
        btn.querySelectorAll('span')[l === 'en' ? 0 : 1].classList.add('on');
      }
      document.getElementById('lang').addEventListener('click', function () {
        apply(lang === 'en' ? 'es' : 'en');
      });
      document.getElementById('year').textContent = new Date().getFullYear();
      apply(lang);
    })();
  </script>
</body>
</html>
`;

for (const p of PAGES) {
  writeFileSync(join(root, 'landing', p.file), page(p));
  console.log('wrote landing/' + p.file);
}
