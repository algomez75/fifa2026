/* 11 Gol landing — live matches + scroll reveals + countdown + EN/ES. Vanilla JS. */
(function () {
  'use strict';

  // App Store listing — every element with [data-store-link] gets this href.
  const APP_STORE_URL = 'https://apps.apple.com/app/11-gol/id6775887761';

  // Public Supabase REST (anon key is safe to expose; RLS protects the data).
  // Football data lives in Supabase, populated from football-data.org — the app's API.
  const SB_URL = 'https://xqjupomaqomneqiugbft.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxanVwb21hcW9tbmVxaXVnYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjM1MjcsImV4cCI6MjA5NTg5OTUyN30.NsDoA5OKf3id16fPZHf4b8TaoHExbTOiejNl4ULTf5k';

  // ── i18n ────────────────────────────────────────────────────────────────
  const I18N = {
    en: {
      nav_matches: 'Matches', nav_features: 'Features', nav_download: 'Download',
      hero_eyebrow: 'Football 2026 · USA · MEX · CAN',
      hero_title: 'The 2026 tournament,<br>in your pocket.',
      tagline: 'Predict · Compete · Win',
      hero_lead: 'Schedule, live scores, squads, and a prediction game with friends. Free, dark, and bilingual.',
      store_apple_small: 'Download on the', store_google_small: 'Get it on',
      cd_label: 'Kickoff in', cd_d: 'Days', cd_h: 'Hours', cd_m: 'Min', cd_s: 'Sec',
      st_teams: 'Teams', st_matches: 'Matches', st_venues: 'Venues', st_hosts: 'Host nations',
      up_title: 'Upcoming matches', up_live: 'Live from the app',
      feat_title: 'Everything for the tournament',
      f1_t: 'Live scores', f1_d: 'Real-time updates with a breathing LIVE badge and goal animations.',
      f2_t: 'Full schedule', f2_d: 'All 104 matches in your local time, with filters by stage, group and host.',
      f3_t: 'Predictions', f3_d: 'Call the score before kickoff. Exact = 3 pts, right result = 1 pt.',
      f4_t: '1v1 Challenges', f4_d: 'Challenge a friend on a match — closest pick wins ranking points.',
      f5_t: 'Leaderboard', f5_d: 'Climb the global ranking with predictions and challenge wins.',
      f6_t: 'Teams & squads', f6_d: 'All 48 nations, full squads by position, and coaches.',
      how_title: 'Play in 3 steps',
      s1_t: 'Predict', s1_d: 'Pick the score of any match before it kicks off.',
      s2_t: 'Challenge', s2_d: 'Dare a friend head-to-head: who wins and by how many.',
      s3_t: 'Climb', s3_d: 'Earn points and rise on the global leaderboard.',
      banner_title: 'Ready for June 11?', banner_sub: "Download 11 Gol and don't miss a single match.",
      foot_privacy: 'Privacy', foot_terms: 'Terms', foot_contact: 'Contact',
      foot_disclaimer: 'An independent app, not affiliated with any football organization or competition. Match data by football-data.org.',
      live: 'The tournament is on!', vs: 'vs', noData: 'Schedule loads in the app.',
      stages: { group: 'Group', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', third: 'Third place', final: 'Final' }
    },
    es: {
      nav_matches: 'Partidos', nav_features: 'Funciones', nav_download: 'Descargar',
      hero_eyebrow: 'Fútbol 2026 · EE.UU. · MÉX · CAN',
      hero_title: 'El torneo 2026,<br>en tu bolsillo.',
      tagline: 'Predice · Compite · Gana',
      hero_lead: 'Calendario, marcadores en vivo, plantillas y un juego de predicciones con amigos. Gratis, oscuro y bilingüe.',
      store_apple_small: 'Descarga en el', store_google_small: 'Disponible en',
      cd_label: 'El torneo arranca en', cd_d: 'Días', cd_h: 'Horas', cd_m: 'Min', cd_s: 'Seg',
      st_teams: 'Equipos', st_matches: 'Partidos', st_venues: 'Sedes', st_hosts: 'Anfitriones',
      up_title: 'Próximos partidos', up_live: 'En vivo desde la app',
      feat_title: 'Todo para el torneo',
      f1_t: 'Marcadores en vivo', f1_d: 'Actualización en tiempo real con indicador EN VIVO y animaciones de gol.',
      f2_t: 'Calendario completo', f2_d: 'Los 104 partidos en tu hora local, con filtros por fase, grupo y sede.',
      f3_t: 'Predicciones', f3_d: 'Predice el marcador antes del pitazo. Exacto = 3 pts, resultado = 1 pt.',
      f4_t: 'Retos 1v1', f4_d: 'Reta a un amigo en un partido — el pronóstico más cercano gana puntos.',
      f5_t: 'Ranking', f5_d: 'Sube en el ranking global con predicciones y retos ganados.',
      f6_t: 'Equipos y plantillas', f6_d: 'Las 48 selecciones, plantillas por posición y entrenadores.',
      how_title: 'Juega en 3 pasos',
      s1_t: 'Predice', s1_d: 'Elige el marcador de cualquier partido antes de que empiece.',
      s2_t: 'Reta', s2_d: 'Desafía a un amigo: quién gana y por cuántos goles.',
      s3_t: 'Sube', s3_d: 'Gana puntos y escala en el ranking global.',
      banner_title: '¿Listo para el 11 de junio?', banner_sub: 'Descarga 11 Gol y no te pierdas ni un partido.',
      foot_privacy: 'Privacidad', foot_terms: 'Términos', foot_contact: 'Contacto',
      foot_disclaimer: 'App independiente, no afiliada a ninguna organización ni competición de fútbol. Datos de partidos por football-data.org.',
      live: '¡El torneo está en marcha!', vs: 'vs', noData: 'El calendario carga en la app.',
      stages: { group: 'Grupo', r32: 'Dieciseisavos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semifinal', third: 'Tercer puesto', final: 'Final' }
    }
  };

  let lang = (navigator.language || 'en').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  let locale = lang === 'es' ? 'es' : 'en';

  function apply(l) {
    lang = l; locale = l; document.documentElement.lang = l;
    const d = I18N[l];
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const k = el.getAttribute('data-i18n');
      if (d[k] != null) el.innerHTML = d[k];
    });
    const btn = document.getElementById('lang');
    btn.querySelectorAll('span').forEach(function (s) { s.classList.remove('on'); });
    btn.querySelectorAll('span')[l === 'en' ? 0 : 1].classList.add('on');
    if (window.__matches) renderMatches(window.__matches); // re-render in new lang
  }
  document.getElementById('lang').addEventListener('click', function () {
    apply(lang === 'en' ? 'es' : 'en');
  });

  // ── countdown ──────────────────────────────────────────────────────────
  const TARGET = Date.UTC(2026, 5, 11, 16, 0, 0);
  const cd = document.getElementById('cd');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    const diff = TARGET - Date.now();
    if (diff <= 0) { cd.innerHTML = '<div style="min-width:auto;padding:14px 22px"><b style="font-size:20px">⚽ ' + I18N[lang].live + '</b></div>'; return; }
    const s = Math.floor(diff / 1000);
    set('d', Math.floor(s / 86400)); set('h', Math.floor((s % 86400) / 3600));
    set('m', Math.floor((s % 3600) / 60)); set('s', s % 60);
  }
  function set(k, v) { const el = cd.querySelector('[data-cd="' + k + '"]'); if (el) el.textContent = pad(v); }

  // ── reveal on scroll ─────────────────────────────────────────────────────
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // ── live matches from the app's API (Supabase REST) ──────────────────────
  function stageLabel(m) {
    const s = I18N[lang].stages;
    if (m.stage === 'group') return (s.group + ' ' + (m.group_letter || '')).trim();
    return s[m.stage] || m.stage;
  }
  function esc(t) { return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // Real flag image via flagcdn (by ISO-3166 code); falls back to emoji.
  function flag(team) {
    const iso = team && team.iso2;
    if (iso) return '<img class="fl-img" loading="lazy" alt="" ' +
      'src="https://flagcdn.com/w40/' + iso.toLowerCase() + '.png" ' +
      'srcset="https://flagcdn.com/w80/' + iso.toLowerCase() + '.png 2x">';
    return '<span class="fl">' + ((team && team.flag_emoji) || '🏳️') + '</span>';
  }

  function renderMatches(list) {
    const box = document.getElementById('matchList');
    if (!list || !list.length) { box.innerHTML = '<p class="muted" style="grid-column:1/-1">' + I18N[lang].noData + '</p>'; return; }
    box.innerHTML = list.map(function (m, i) {
      const d = new Date(m.kickoff_utc);
      const day = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const venue = m.venue ? (m.venue.name + ' · ' + m.venue.city) : '';
      return '<div class="m-card" style="animation-delay:' + (i * 70) + 'ms">' +
        '<div class="m-top"><span>' + esc(stageLabel(m)) + '</span><span class="tag">' + day + '</span></div>' +
        '<div class="m-team">' + flag(m.home) + esc(m.home && m.home.name || 'TBD') + '</div>' +
        '<div class="m-vs">' + I18N[lang].vs + '</div>' +
        '<div class="m-team">' + flag(m.away) + esc(m.away && m.away.name || 'TBD') + '</div>' +
        '<div class="m-foot">📍 ' + esc(venue) + '  ·  ' + time + '</div>' +
      '</div>';
    }).join('');
  }

  function loadMatches() {
    const q = '/rest/v1/matches?select=id,kickoff_utc,stage,group_letter,' +
      'home:teams!home_team_id(name,flag_emoji,iso2),away:teams!away_team_id(name,flag_emoji,iso2),' +
      'venue:venues(name,city)&status=eq.scheduled&order=kickoff_utc.asc&limit=6';
    fetch(SB_URL + q, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { window.__matches = data; renderMatches(data); })
      .catch(function () { renderMatches([]); });
  }

  // ── App Store links ──────────────────────────────────────────────────────
  document.querySelectorAll('[data-store-link]').forEach(function (a) {
    a.setAttribute('href', APP_STORE_URL);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  // ── init ─────────────────────────────────────────────────────────────────
  document.getElementById('year').textContent = new Date().getFullYear();
  apply(lang);
  tick(); setInterval(tick, 1000);
  loadMatches();
})();
